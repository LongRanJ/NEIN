// Vercel Serverless Function - 15源新闻搜索 + MIMO智能兜底
// 支持 POST (JSON) 和 GET+SSE 两种模式
// 优化：5s单源超时 + 8s全局超时 + 提前返回 + 智能MIMO兜底

import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import * as cheerio from 'cheerio'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const sourcesConfig = JSON.parse(
  readFileSync(join(__dirname, 'config', 'sources.json'), 'utf-8')
)

// ─── 常量 ────────────────────────────────────────────────

const PER_SOURCE_TIMEOUT = 5000   // 单源 5 秒
const GLOBAL_TIMEOUT = 8000       // 全局 8 秒（Vercel hobby 限制 10s）
const MIN_HTML_LENGTH = 500       // HTML 太短说明页面无效，跳过 MIMO
const EARLY_RETURN_COUNT = 5      // 收集到 5 条即提前返回

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
  if (Date.now() - entry.timestamp > CACHE_TTL) { cache.delete(key); return null }
  return entry.data
}

function setCache(keyword, data) {
  const key = getCacheKey(keyword)
  if (cache.size >= CACHE_MAX) { cache.delete(cache.keys().next().value) }
  cache.set(key, { data, timestamp: Date.now() })
}

// ─── 去重 + 排序 ────────────────────────────────────────

function similarity(a, b) {
  if (a === b) return 1
  if (a.length < 2 || b.length < 2) return 0
  const p1 = [], p2 = []
  for (let i = 0; i < a.length - 1; i++) p1.push(a.substring(i, i + 2))
  for (let i = 0; i < b.length - 1; i++) p2.push(b.substring(i, i + 2))
  let m = 0; const c = [...p2]
  for (const p of p1) { const i = c.indexOf(p); if (i !== -1) { m++; c.splice(i, 1) } }
  return (2.0 * m) / (a.length + b.length - 2)
}

function dedup(items) {
  const r = []
  for (const item of items) {
    if (!r.some(e => similarity(e.title, item.title) >= 0.6)) r.push(item)
  }
  return r
}

function sortByRelevance(items, keyword) {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return items.sort((a, b) => {
    const ca = (a.title.match(new RegExp(escaped, 'g')) || []).length
    const cb = (b.title.match(new RegExp(escaped, 'g')) || []).length
    return cb - ca
  })
}

// ─── 随机 UA ─────────────────────────────────────────────

function randomUA() {
  const a = sourcesConfig.global.user_agents
  return a[Math.floor(Math.random() * a.length)]
}

// ─── cheerio 选择器提取 ─────────────────────────────────

function extractByCheerio(html, selectors) {
  const $ = cheerio.load(html)
  const results = []
  const seen = new Set()

  for (const sel of selectors.title) {
    $(sel).each((_, el) => {
      const title = $(el).text().trim()
      if (!title || title.length < 5) return
      const key = title.slice(0, 20)
      if (seen.has(key)) return
      seen.add(key)

      const linkEl = $(el).closest('a').length ? $(el).closest('a') : $(el).find('a').first()
      let url = linkEl.attr('href') || ''
      if (url.startsWith('//')) url = 'https:' + url
      if (url && !url.startsWith('http')) url = ''

      let summary = ''
      const parent = $(el).closest('.news-item, .list-item, .result, .search-item, .article-item, .card, li, div')
      for (const sSel of selectors.summary) {
        if (sSel.startsWith('meta')) continue
        const descEl = parent.find(sSel).first()
        if (descEl.length) { summary = descEl.text().trim().replace(/\s+/g, ' ').slice(0, 150); break }
      }
      if (!summary) {
        summary = parent.text().replace(title, '').trim().replace(/\s+/g, ' ').slice(0, 150)
      }

      results.push({ title, summary, url, source: '' })
    })
    if (results.length > 0) break
  }

  return results
}

function extractFromMeta(html) {
  const $ = cheerio.load(html)
  const ogTitle = $('meta[property="og:title"]').attr('content')
  const metaDesc = $('meta[name="description"]').attr('content')
  if (ogTitle && ogTitle.trim().length > 3) {
    return [{ title: ogTitle.trim(), summary: metaDesc ? metaDesc.trim().slice(0, 150) : '', url: '', source: '' }]
  }
  return []
}

// ─── LLM 智能解析兜底（仅对有效页面调用） ──────────────

async function llmExtract(htmlFragment, sourceName) {
  const apiKey = process.env.MIMO_API_KEY
  if (!apiKey || htmlFragment.length < MIN_HTML_LENGTH) return []

  try {
    const resp = await fetch('https://token-plan-cn.xiaomimimo.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'mimo-v2.5',
        messages: [{
          role: 'system',
          content: `从以下 HTML 中提取新闻列表。只返回 JSON 数组：[{"title":"标题","summary":"摘要","url":"链接"}]。无新闻返回 []。来源：${sourceName}\nHTML：\n${htmlFragment.slice(0, 6000)}`
        }],
        temperature: 0.1,
        max_tokens: 2000
      })
    })
    if (!resp.ok) return []
    const data = await resp.json()
    const content = data.choices?.[0]?.message?.content || ''
    // 去除 markdown 代码块
    const cleaned = content.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim()
    const jsonMatch = cleaned.match(/\[[\s\S]*?\]/)
    if (!jsonMatch) return []
    try {
      const parsed = JSON.parse(jsonMatch[0])
      return Array.isArray(parsed) ? parsed.filter(i => i.title?.length >= 3).slice(0, 10) : []
    } catch { return [] }
  } catch { return [] }
}

// ─── 单源爬虫（5s超时 + 智能MIMO） ─────────────────────

async function scrapeSource(source, keyword, sendStatus) {
  const url = source.url_template.replace('{keyword}', encodeURIComponent(keyword))
  sendStatus(source.name, 'loading', 0)

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), PER_SOURCE_TIMEOUT)

    const resp = await fetch(url, {
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Referer': new URL(url).origin + '/',
        'User-Agent': randomUA()
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

    // 第1层：cheerio 选择器
    items = extractByCheerio(html, source.selectors)
    items.forEach(i => { i.source = source.name })

    // 第2层：meta description
    if (items.length === 0) {
      items = extractFromMeta(html)
      items.forEach(i => { i.source = source.name })
    }

    // 第3层：MIMO 兜底（仅当页面有效且有一定内容时）
    if (items.length === 0 && html.length >= MIN_HTML_LENGTH) {
      sendStatus(source.name, 'llm_fallback', 0)
      items = await llmExtract(html, source.name)
      items.forEach(i => { i.source = i.source || source.name })
    }

    sendStatus(source.name, items.length > 0 ? 'success' : 'empty', items.length)
    return items

  } catch (err) {
    sendStatus(source.name, err.name === 'AbortError' ? 'timeout' : 'error', 0)
    return []
  }
}

// ─── 主处理函数（提前返回机制） ──────────────────────────

export default async function handler(req, res) {
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

  // 缓存命中
  const cached = getFromCache(keyword)
  if (cached) {
    return res.status(200).json({ success: true, keyword, data: cached.newsList, total: cached.newsList.length, sourceStatus: cached.sourceStatus, cached: true })
  }

  if (isSSE) {
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')
  }

  const sendEvent = (data) => {
    if (isSSE) res.write(`data: ${JSON.stringify(data)}\n\n`)
  }

  const sendStatus = (source, status, count) => {
    sendEvent({ source, status, count })
  }

  try {
    const sources = sourcesConfig.sources.filter(s => s.enabled)
    const allItems = []
    const sourceStatus = {}
    let completedCount = 0
    let earlyReturned = false

    // 创建一个可取消的全局超时
    let globalTimer
    const globalTimeout = new Promise(resolve => {
      globalTimer = setTimeout(() => resolve('timeout'), GLOBAL_TIMEOUT)
    })

    // 每个源完成后立即收集结果
    const scrapePromises = sources.map(async (source) => {
      const items = await scrapeSource(source, keyword, sendStatus)
      sourceStatus[source.name] = items.length > 0 ? 'success' : 'empty'
      allItems.push(...items)
      completedCount++

      // 提前返回：收集到足够结果且至少一半源完成
      if (!earlyReturned && allItems.length >= EARLY_RETURN_COUNT && completedCount >= Math.ceil(sources.length / 2)) {
        earlyReturned = true
        clearTimeout(globalTimer)

        const deduplicated = sortByRelevance(dedup([...allItems]), keyword)
        setCache(keyword, { newsList: deduplicated, sourceStatus })

        sendEvent({
          type: 'complete',
          total: allItems.length,
          deduplicated: deduplicated.length,
          keyword,
          data: deduplicated,
          sourceStatus,
          early: true
        })
        if (isSSE) res.end()
      }

      return items
    })

    // 等待全部完成或超时
    const raceResult = await Promise.race([
      Promise.allSettled(scrapePromises).then(() => 'done'),
      globalTimeout
    ])

    // 如果已经提前返回，直接结束
    if (earlyReturned) return

    // 超时或全部完成，返回已收集的结果
    clearTimeout(globalTimer)

    const deduplicated = sortByRelevance(dedup(allItems), keyword)
    setCache(keyword, { newsList: deduplicated, sourceStatus })

    if (isSSE) {
      sendEvent({
        type: raceResult === 'timeout' ? 'complete' : 'complete',
        total: allItems.length,
        deduplicated: deduplicated.length,
        keyword,
        data: deduplicated,
        sourceStatus,
        timeout: raceResult === 'timeout'
      })
      res.end()
    } else {
      res.status(200).json({
        success: true,
        keyword,
        data: deduplicated,
        total: deduplicated.length,
        sourceStatus,
        timeout: raceResult === 'timeout'
      })
    }
  } catch (err) {
    const msg = `搜索失败: ${err.message}`
    if (isSSE) { sendEvent({ type: 'error', message: msg }); res.end() }
    else { res.status(500).json({ success: false, error: msg }) }
  }
}
