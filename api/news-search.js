// Vercel Serverless Function - 15源新闻搜索 + MIMO智能兜底
// SSE 实时推送每个源的抓取状态
// 环境变量：MIMO_API_KEY

import { createRequire } from 'module'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { readFileSync } from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// 读取新闻源配置
const sourcesConfig = JSON.parse(
  readFileSync(join(__dirname, 'config', 'sources.json'), 'utf-8')
)

// ─── 缓存 ───────────────────────────────────────────────

const cache = new Map()
const CACHE_TTL = 30 * 60 * 1000 // 30 分钟
const CACHE_MAX = 100

function getCacheKey(keyword) {
  return keyword.trim().toLowerCase().replace(/\s+/g, ' ')
}

function getFromCache(keyword) {
  const key = getCacheKey(keyword)
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    cache.delete(key)
    return null
  }
  return entry.data
}

function setCache(keyword, data) {
  const key = getCacheKey(keyword)
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value
    cache.delete(oldest)
  }
  cache.set(key, { data, timestamp: Date.now() })
}

// ─── 去重（SequenceMatcher 相似度） ──────────────────────

function similarity(a, b) {
  if (a === b) return 1
  if (a.length < 2 || b.length < 2) return 0
  const pairs1 = [], pairs2 = []
  for (let i = 0; i < a.length - 1; i++) pairs1.push(a.substring(i, i + 2))
  for (let i = 0; i < b.length - 1; i++) pairs2.push(b.substring(i, i + 2))
  let matches = 0
  const copy = [...pairs2]
  for (const p of pairs1) {
    const idx = copy.indexOf(p)
    if (idx !== -1) { matches++; copy.splice(idx, 1) }
  }
  return (2.0 * matches) / (a.length + b.length - 2)
}

function dedup(items) {
  const result = []
  for (const item of items) {
    const isDup = result.some(existing => similarity(existing.title, item.title) >= 0.6)
    if (!isDup) result.push(item)
  }
  return result
}

function sortByRelevance(items, keyword) {
  return items.sort((a, b) => {
    const countA = (a.title.match(new RegExp(keyword, 'g')) || []).length
    const countB = (b.title.match(new RegExp(keyword, 'g')) || []).length
    return countB - countA
  })
}

// ─── HTML 解析（CSS选择器 + meta 兜底） ──────────────────

function extractBySelectors(html, selectors) {
  const results = []
  const containers = selectors.container || []
  const titleSels = selectors.title || []
  const summarySels = selectors.summary || []
  const linkSels = selectors.link || []

  // 简化：用正则模拟选择器提取（Vercel Node.js 无 DOM 环境）
  // 提取所有 <a> 标签及其上下文
  const linkRegex = /<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  const seen = new Set()
  let match

  while ((match = linkRegex.exec(html)) !== null) {
    const url = match[1]
    const titleText = match[2].replace(/<[^>]+>/g, '').trim()

    // 过滤非新闻链接
    if (!titleText || titleText.length < 5) continue
    if (seen.has(titleText.slice(0, 20))) continue
    if (url.startsWith('javascript:') || url === '#') continue
    if (url.includes('login') || url.includes('register')) continue

    seen.add(titleText.slice(0, 20))

    // 提取摘要：从链接周围的文本
    const contextStart = Math.max(0, match.index - 300)
    const contextEnd = Math.min(html.length, match.index + match[0].length + 500)
    const context = html.substring(contextStart, contextEnd)
    const summaryText = context.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
    const summary = summaryText.length > 150 ? summaryText.slice(0, 150) + '...' : summaryText

    // 处理相对链接
    let fullUrl = url
    if (url.startsWith('//')) fullUrl = 'https:' + url
    else if (url.startsWith('/')) fullUrl = '' // 需要基URL，暂时跳过

    if (!fullUrl.startsWith('http')) continue

    results.push({
      title: titleText,
      summary,
      url: fullUrl,
      source: ''
    })
  }

  return results
}

function extractFromMeta(html) {
  const results = []
  const metaDesc = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i)
  const ogTitle = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i)

  if (ogTitle && ogTitle[1]) {
    results.push({
      title: ogTitle[1].trim(),
      summary: metaDesc ? metaDesc[1].trim().slice(0, 150) : '',
      url: '',
      source: ''
    })
  }
  return results
}

// ─── LLM 智能解析兜底 ───────────────────────────────────

async function llmExtract(htmlFragment, sourceName) {
  const apiKey = process.env.MIMO_API_KEY
  if (!apiKey) return []

  try {
    const resp = await fetch('https://token-plan-cn.xiaomimimo.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'mimo-v2.5',
        messages: [
          {
            role: 'system',
            content: `你是一个网页内容提取器。从以下 HTML 中提取新闻列表。

要求：
1. 提取新闻标题、摘要（前150字）、原文链接
2. 只返回 JSON 数组，格式：[{"title": "标题", "summary": "摘要", "url": "链接"}]
3. 去掉广告、导航等非新闻内容
4. 如果没有新闻内容，返回空数组 []

来源网站：${sourceName}
HTML 内容：
${htmlFragment.slice(0, 8000)}`
          }
        ],
        temperature: 0.1,
        max_tokens: 3000
      })
    })

    if (!resp.ok) return []

    const data = await resp.json()
    const content = data.choices?.[0]?.message?.content || ''
    const jsonMatch = content.match(/\[[\s\S]*\]/)
    if (!jsonMatch) return []

    const parsed = JSON.parse(jsonMatch[0])
    return Array.isArray(parsed)
      ? parsed.filter(item => item.title && item.title.length >= 3).slice(0, 10)
      : []
  } catch {
    return []
  }
}

// ─── 自愈式选择器生成 ────────────────────────────────────

async function generateNewSelectors(html, sourceName) {
  const apiKey = process.env.MIMO_API_KEY
  if (!apiKey) return null

  try {
    const resp = await fetch('https://token-plan-cn.xiaomimimo.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'mimo-v2.5',
        messages: [
          {
            role: 'system',
            content: `分析以下网页 HTML 结构，生成用于提取新闻的 CSS 选择器。

返回 JSON 格式：
{
  "container": ["选择器1", "选择器2"],
  "title": ["选择器1", "选择器2"],
  "summary": ["选择器1", "选择器2"],
  "link": ["选择器1", "选择器2"]
}

只返回 JSON，不要其他文字。来源：${sourceName}
HTML（前6000字符）：
${html.slice(0, 6000)}`
          }
        ],
        temperature: 0.1,
        max_tokens: 1000
      })
    })

    if (!resp.ok) return null
    const data = await resp.json()
    const content = data.choices?.[0]?.message?.content || ''
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null
    return JSON.parse(jsonMatch[0])
  } catch {
    return null
  }
}

// ─── 单源爬虫 ────────────────────────────────────────────

async function scrapeSource(source, keyword, sendStatus) {
  const url = source.url_template.replace('{keyword}', encodeURIComponent(keyword))
  const ua = sourcesConfig.global.user_agents[
    Math.floor(Math.random() * sourcesConfig.global.user_agents.length)
  ]

  sendStatus(source.name, 'loading', 0)

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), sourcesConfig.global.timeout_per_source)

    const resp = await fetch(url, {
      headers: {
        'User-Agent': ua,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Referer': 'https://www.google.com/'
      },
      signal: controller.signal,
      redirect: 'follow'
    })

    clearTimeout(timeoutId)

    if (!resp.ok) {
      sendStatus(source.name, 'error', 0)
      return []
    }

    const html = await resp.text()
    let items = []

    // 第1层：CSS 选择器提取
    if (source.type === 'api_json') {
      // 新华网 API：直接解析 JSON
      try {
        const jsonData = JSON.parse(html)
        const newsItems = jsonData?.content || jsonData?.data || jsonData?.results || []
        items = (Array.isArray(newsItems) ? newsItems : []).slice(0, 10).map(item => ({
          title: (item.title || '').replace(/<[^>]+>/g, '').trim(),
          summary: (item.summary || item.desc || item.digest || '').replace(/<[^>]+>/g, '').trim().slice(0, 150),
          url: item.url || item.linkUrl || '',
          source: source.name
        })).filter(i => i.title.length >= 5)
      } catch {
        // JSON 解析失败，跳过
      }
    } else {
      items = extractBySelectors(html, source.selectors)
      items.forEach(item => { item.source = source.name })
    }

    // 第2层：meta description 提取
    if (items.length === 0) {
      items = extractFromMeta(html)
      items.forEach(item => { item.source = source.name })
    }

    // 第3层：LLM 智能解析兜底
    if (items.length === 0) {
      sendStatus(source.name, 'llm_fallback', 0)
      items = await llmExtract(html, source.name)
      items.forEach(item => { item.source = item.source || source.name })
    }

    // 自愈：如果选择器失败但 LLM 成功，生成新选择器缓存（异步，不阻塞）
    if (items.length > 0 && source.type !== 'api_json') {
      // 这里可以将新选择器写入缓存供下次使用
      // 暂时记录日志
    }

    sendStatus(source.name, items.length > 0 ? 'success' : 'empty', items.length)
    return items

  } catch (err) {
    if (err.name === 'AbortError') {
      sendStatus(source.name, 'timeout', 0)
    } else {
      sendStatus(source.name, 'error', 0)
    }
    return []
  }
}

// ─── SSE 主处理函数 ──────────────────────────────────────

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()

  // 支持 GET (SSE) 和 POST (JSON) 两种方式
  const keyword = req.method === 'GET'
    ? req.query.keyword?.trim()
    : req.body?.keyword?.trim()

  if (!keyword) return res.status(400).json({ error: '请输入搜索关键词' })
  if (keyword.length > 100) return res.status(400).json({ error: '关键词过长' })

  const isSSE = req.query.stream === '1' || req.method === 'GET'

  // 缓存命中时，直接返回 JSON（两种模式通用）
  const cached = getFromCache(keyword)
  if (cached) {
    res.setHeader('Content-Type', 'application/json')
    return res.status(200).json({
      success: true,
      keyword,
      data: cached.newsList,
      total: cached.newsList.length,
      sourceStatus: cached.sourceStatus,
      cached: true
    })
  }

  // SSE 模式：设置流式响应头
  if (isSSE) {
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')
  }

  const collectedStatus = {}

  const sendEvent = (data) => {
    collectedStatus[data.source] = data.status
    if (isSSE) {
      res.write(`data: ${JSON.stringify(data)}\n\n`)
    }
  }

  const sendStatus = (source, status, count) => {
    sendEvent({ source, status, count })
  }

  try {
    const sources = sourcesConfig.sources.filter(s => s.enabled)

    const globalTimeout = new Promise(resolve => {
      setTimeout(() => resolve('timeout'), 25000)
    })

    const scrapeAll = Promise.allSettled(
      sources.map(source => scrapeSource(source, keyword, sendStatus))
    )

    const result = await Promise.race([scrapeAll, globalTimeout])

    if (result === 'timeout') {
      if (isSSE) {
        sendEvent({ type: 'error', message: '搜索超时' })
        res.end()
      } else {
        res.status(504).json({ success: false, error: '搜索超时' })
      }
      return
    }

    const allItems = []
    const sourceStatus = {}

    result.forEach((settled, index) => {
      const source = sources[index]
      if (settled.status === 'fulfilled') {
        allItems.push(...settled.value)
        sourceStatus[source.name] = settled.value.length > 0 ? 'success' : 'empty'
      } else {
        sourceStatus[source.name] = 'error'
      }
    })

    const deduplicated = sortByRelevance(dedup(allItems), keyword)
    setCache(keyword, { newsList: deduplicated, sourceStatus })

    if (isSSE) {
      sendEvent({
        type: 'complete',
        total: allItems.length,
        deduplicated: deduplicated.length,
        keyword,
        data: deduplicated,
        sourceStatus
      })
      res.end()
    } else {
      res.status(200).json({
        success: true,
        keyword,
        data: deduplicated,
        total: deduplicated.length,
        sourceStatus
      })
    }
  } catch (err) {
    if (isSSE) {
      sendEvent({ type: 'error', message: `搜索失败: ${err.message}` })
      res.end()
    } else {
      res.status(500).json({ success: false, error: `搜索失败: ${err.message}` })
    }
  }
}
