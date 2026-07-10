// Vercel Serverless Function - Google News RSS + MIMO 筛选
// 参考 api/search.js 的 RSS 方案
// 环境变量：MIMO_API_KEY

// 目标来源（优先展示）
const TARGET_SOURCES = [
  '中国能源网', '北极星储能网', '电动汽车网', '盖世汽车网', '第一电动网',
  'OFWeek锂电网', '高工氢电网', '中国储能网', '索比储能网', '国际能源网',
  '北极星电池网', '新能源网', '电池网', '百度新闻', 'Bing新闻'
]

// ─── RSS 解析工具 ────────────────────────────────────────

function extractTag(xml, tag) {
  const cdata = xml.match(new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${tag}>`, 'i'))
  if (cdata) return cdata[1].trim()
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'))
  return match ? match[1].trim() : ''
}

function cleanText(text) {
  return text.replace(/<[^>]+>/g, '').replace(/&[^;]+;/g, ' ').replace(/\s+/g, ' ').trim()
}

function parseDate(dateStr) {
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return new Date().toISOString().split('T')[0]
    return d.toISOString().split('T')[0]
  } catch {
    return new Date().toISOString().split('T')[0]
  }
}

// 30天前的日期
function thirtyDaysAgo() {
  const d = new Date()
  d.setDate(d.getDate() - 30)
  return d.toISOString().split('T')[0]
}

// ─── Google News RSS 抓取 ────────────────────────────────

async function fetchGoogleNews(keyword, limit = 50) {
  const queries = [
    `${keyword} 新能源`,
    `${keyword} 电池`,
    `${keyword} 储能`
  ]

  const allItems = []

  for (const q of queries) {
    try {
      const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=zh-CN&gl=CN&ceid=CN:zh-Hans`
      const resp = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NEIN/1.0)' },
        signal: AbortSignal.timeout(8000)
      })
      if (!resp.ok) continue
      const xml = await resp.text()
      const items = xml.match(/<item>([\s\S]*?)<\/item>/gi) || []

      for (const item of items.slice(0, limit)) {
        const title = cleanText(extractTag(item, 'title'))
        const link = extractTag(item, 'link')
        const description = cleanText(extractTag(item, 'description') || '').slice(0, 200)
        const pubDate = extractTag(item, 'pubDate')
        const source = cleanText(extractTag(item, 'source') || '未知来源')
        const cutoff = thirtyDaysAgo()
        const date = parseDate(pubDate)

        if (title && title.length >= 5 && date >= cutoff) {
          allItems.push({ title, summary: description, source, url: link || '', date })
        }
      }
    } catch {}
  }

  return allItems
}

// ─── 去重 ────────────────────────────────────────────────

function dedup(items) {
  const seen = new Set()
  return items.filter(item => {
    const key = item.title.slice(0, 20)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// ─── MIMO 筛选排序 ──────────────────────────────────────

async function mimoFilter(keyword, items, apiKey, candidateLimit = 80) {
  if (items.length === 0) return { results: [], overview: '' }

  const candidates = items.slice(0, candidateLimit)

  const prompt = `你是新能源行业资讯分析助手。从以下新闻中筛选与"${keyword}"最相关的结果。

要求：
1. 按相关性排序
2. 保留 title、summary、source、url、date 字段
3. 最多返回50条
4. 只返回JSON数组

新闻列表：
${candidates.map((c, i) => `${i+1}. [${c.source}] ${c.title} (${c.date})\n   ${c.summary}\n   链接: ${c.url}`).join('\n\n')}`

  try {
    const resp = await fetch('https://token-plan-cn.xiaomimimo.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'mimo-v2.5',
        messages: [
          { role: 'system', content: '你是新能源行业资讯筛选助手。只返回JSON数组，不要其他文字。' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.2,
        max_tokens: 8000
      })
    })

    if (!resp.ok) return { results: candidates.slice(0, 50), overview: '' }

    const data = await resp.json()
    const content = data.choices?.[0]?.message?.content || ''

    let results = []
    try {
      const cleaned = content.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim()
      const jsonMatch = cleaned.match(/\[[\s\S]*?\]/)
      if (jsonMatch) results = JSON.parse(jsonMatch[0])
    } catch {}

    if (results.length === 0) results = candidates.slice(0, 50)

    results = results
      .filter(r => r.title && r.title.length >= 3)
      .map(r => ({
        title: r.title.trim(),
        summary: (r.summary || '').trim().slice(0, 200),
        source: (r.source || '未知来源').trim(),
        url: r.url || '',
        date: r.date || ''
      }))

    // 生成概述
    let overview = ''
    try {
      const ovResp = await fetch('https://token-plan-cn.xiaomimimo.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'mimo-v2.5',
          messages: [{ role: 'user', content: `用50-100字概括以下新闻的核心要点：\n${results.map(r => `- ${r.title}`).join('\n')}` }],
          temperature: 0.3, max_tokens: 300
        })
      })
      if (ovResp.ok) {
        overview = (await ovResp.json()).choices?.[0]?.message?.content || ''
      }
    } catch {}

    return { results, overview }
  } catch {
    return { results: candidates.slice(0, 50), overview: '' }
  }
}

// ─── 主处理函数 ──────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { keyword, candidateLimit } = req.body
  if (!keyword?.trim()) return res.status(400).json({ error: '请输入搜索关键词' })
  if (keyword.length > 100) return res.status(400).json({ error: '关键词过长' })
  const limit = Math.min(Math.max(parseInt(candidateLimit) || 80, 20), 150)

  const apiKey = process.env.MIMO_API_KEY

  try {
    // 第一步：从 Google News RSS 抓取真实新闻
    console.log(`Searching Google News RSS for: ${keyword}, candidateLimit: ${limit}`)
    const rawItems = await fetchGoogleNews(keyword, Math.min(limit, 50))
    console.log(`Found ${rawItems.length} raw items from Google News RSS`)

    // 去重
    const uniqueItems = dedup(rawItems)
    console.log(`After dedup: ${uniqueItems.length} items`)

    // 如果没有 RSS 结果，直接返回空
    if (uniqueItems.length === 0) {
      return res.status(200).json({
        success: true, keyword, data: [], total: 0, overview: '',
        sources: { target: [], other: [] }
      })
    }

    // 第二步：MIMO 筛选排序
    let results = uniqueItems
    let overview = ''

    if (apiKey) {
      const filtered = await mimoFilter(keyword, uniqueItems, apiKey, limit)
      results = filtered.results
      overview = filtered.overview
    }

    // 第三步：统计来源
    const sourceCount = {}
    for (const item of results) {
      sourceCount[item.source] = (sourceCount[item.source] || 0) + 1
    }

    // 目标来源（有结果的排前面）
    const target = TARGET_SOURCES
      .filter(s => sourceCount[s])
      .sort((a, b) => sourceCount[b] - sourceCount[a])

    // 其他来源（按数量排序）
    const other = Object.keys(sourceCount)
      .filter(s => !TARGET_SOURCES.includes(s))
      .sort((a, b) => sourceCount[b] - sourceCount[a])

    return res.status(200).json({
      success: true,
      keyword,
      data: results,
      total: results.length,
      overview,
      sources: { target, other, count: sourceCount }
    })

  } catch (err) {
    console.error('Search error:', err.message)
    return res.status(500).json({ error: `搜索失败: ${err.message}` })
  }
}
