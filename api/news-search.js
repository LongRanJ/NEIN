// Vercel Serverless Function - 15源新闻搜索 + MIMO智能兜底
// 支持 POST (JSON) 和 GET+SSE 两种模式
// 依赖：cheerio, MIMO_API_KEY 环境变量

import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import * as cheerio from 'cheerio'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const sourcesConfig = JSON.parse(
  readFileSync(join(__dirname, 'config', 'sources.json'), 'utf-8')
)

// ─── 缓存 ───────────────────────────────────────────────

const cache = new Map()
const CACHE_TTL = 30 * 60 * 1000
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

// ─── 去重（SequenceMatcher 相似度 ≥ 0.6） ───────────────

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
    const countA = (a.title.match(new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length
    const countB = (b.title.match(new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length
    return countB - countA
  })
}

// ─── 随机 UA ─────────────────────────────────────────────

function randomUA() {
  const agents = sourcesConfig.global.user_agents
  return agents[Math.floor(Math.random() * agents.length)]
}

// ─── cheerio 选择器提取（按源配置） ──────────────────────

function extractByCheerio(html, selectors) {
  const $ = cheerio.load(html)
  const results = []
  const seen = new Set()

  // 尝试所有标题选择器
  for (const sel of selectors.title) {
    $(sel).each((_, el) => {
      const title = $(el).text().trim()
      if (!title || title.length < 5) return
      const key = title.slice(0, 20)
      if (seen.has(key)) return
      seen.add(key)

      // 提取链接
      const linkEl = $(el).closest('a').length ? $(el).closest('a') : $(el).find('a').first()
      let url = linkEl.attr('href') || ''
      if (url.startsWith('//')) url = 'https:' + url
      if (url && !url.startsWith('http')) url = ''
      if (!url) {
        // 尝试链接选择器
        for (const lSel of selectors.link) {
          const found = $(lSel).filter((_, e) => $(e).text().trim().includes(title.slice(0, 15)))
          if (found.length) {
            url = found.first().attr('href') || ''
            if (url.startsWith('//')) url = 'https:' + url
            if (url && !url.startsWith('http')) url = ''
            if (url) break
          }
        }
      }

      // 提取摘要
      let summary = ''
      // 优先 meta description
      const metaDesc = $('meta[name="description"]').attr('content')
      if (metaDesc && results.length === 0) {
        summary = metaDesc.trim().slice(0, 150)
      }
      // 从选择器提取
      if (!summary) {
        for (const sSel of selectors.summary) {
          if (sSel.startsWith('meta')) continue
          const parent = $(el).closest('.news-item, .list-item, .result, .search-item, .article-item, .card, li, div')
          const descEl = parent.find(sSel).first()
          if (descEl.length) {
            summary = descEl.text().trim().replace(/\s+/g, ' ').slice(0, 150)
            if (summary) break
          }
        }
      }
      // 最后兜底：取父元素的文本
      if (!summary) {
        const parent = $(el).closest('div, li, article')
        const fullText = parent.text().replace(title, '').trim().replace(/\s+/g, ' ')
        summary = fullText.slice(0, 150)
      }

      results.push({ title, summary, url, source: '' })
    })
    if (results.length > 0) break // 命中一个选择器就够了
  }

  return results
}

// ─── meta description 兜底 ──────────────────────────────

function extractFromMeta(html) {
  const $ = cheerio.load(html)
  const results = []
  const ogTitle = $('meta[property="og:title"]').attr('content')
  const metaDesc = $('meta[name="description"]').attr('content')
  if (ogTitle && ogTitle.trim().length > 3) {
    results.push({
      title: ogTitle.trim(),
      summary: metaDesc ? metaDesc.trim().slice(0, 150) : '',
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
  "title": ["选择器1", "选择器2"],
  "link": ["选择器1", "选择器2"],
  "summary": ["选择器1", "选择器2"]
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

// ─── HTTP 请求（带重试） ─────────────────────────────────

async function fetchWithRetry(url, options, maxRetries = 1) {
  let lastError
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), options.timeout || 10000)

      const resp = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          ...options.headers,
          'User-Agent': randomUA()
        }
      })

      clearTimeout(timeoutId)

      // 403/429 时重试一次
      if ((resp.status === 403 || resp.status === 429) && attempt < maxRetries) {
        continue
      }

      return resp
    } catch (err) {
      lastError = err
      if (attempt < maxRetries && err.name === 'AbortError') continue
      throw err
    }
  }
  throw lastError
}

// ─── 单源爬虫 ────────────────────────────────────────────

async function scrapeSource(source, keyword, sendStatus) {
  const url = source.url_template.replace('{keyword}', encodeURIComponent(keyword))

  sendStatus(source.name, 'loading', 0)

  try {
    const resp = await fetchWithRetry(url, {
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Referer': new URL(url).origin + '/'
      },
      timeout: sourcesConfig.global.timeout_per_source
    })

    if (!resp.ok) {
      sendStatus(source.name, 'error', 0)
      return []
    }

    const html = await resp.text()
    let items = []

    // 第1层：cheerio 选择器提取（按源配置）
    items = extractByCheerio(html, source.selectors)
    items.forEach(item => { item.source = source.name })

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

      // 自愈：LLM 成功则生成新选择器（异步，不阻塞返回）
      if (items.length > 0) {
        generateNewSelectors(html, source.name).then(newSelectors => {
          if (newSelectors) {
            // 可以将新选择器写入缓存供下次使用
            console.log(`[${source.name}] Generated new selectors via LLM`)
          }
        }).catch(() => {})
      }
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

// ─── 主处理函数 ──────────────────────────────────────────

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()

  const keyword = req.method === 'GET'
    ? req.query.keyword?.trim()
    : req.body?.keyword?.trim()

  if (!keyword) return res.status(400).json({ error: '请输入搜索关键词' })
  if (keyword.length > 100) return res.status(400).json({ error: '关键词过长' })

  const isSSE = req.query.stream === '1' || req.method === 'GET'

  // 检查缓存
  const cached = getFromCache(keyword)
  if (cached) {
    return res.status(200).json({
      success: true,
      keyword,
      data: cached.newsList,
      total: cached.newsList.length,
      sourceStatus: cached.sourceStatus,
      cached: true
    })
  }

  // SSE 模式
  if (isSSE) {
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')
  }

  const collectedStatus = {}

  const sendEvent = (data) => {
    if (data.source) collectedStatus[data.source] = data.status
    if (isSSE) {
      res.write(`data: ${JSON.stringify(data)}\n\n`)
    }
  }

  const sendStatus = (source, status, count) => {
    sendEvent({ source, status, count })
  }

  try {
    const sources = sourcesConfig.sources.filter(s => s.enabled)

    // 全局超时 30 秒
    const globalTimeout = new Promise(resolve => {
      setTimeout(() => resolve('timeout'), 30000)
    })

    const scrapeAll = Promise.allSettled(
      sources.map(source => scrapeSource(source, keyword, sendStatus))
    )

    const result = await Promise.race([scrapeAll, globalTimeout])

    if (result === 'timeout') {
      const msg = '搜索超时'
      if (isSSE) {
        sendEvent({ type: 'error', message: msg })
        res.end()
      } else {
        res.status(504).json({ success: false, error: msg })
      }
      return
    }

    // 收集结果
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

    // 去重 + 排序
    const deduplicated = sortByRelevance(dedup(allItems), keyword)

    // 写入缓存
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
    const msg = `搜索失败: ${err.message}`
    if (isSSE) {
      sendEvent({ type: 'error', message: msg })
      res.end()
    } else {
      res.status(500).json({ success: false, error: msg })
    }
  }
}
