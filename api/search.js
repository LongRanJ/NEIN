// Vercel Serverless Function - RSS 实时抓取 + MIMO 分析
// 环境变量：MIMO_API_KEY

// RSS 源列表
const RSS_FEEDS = [
  { name: '36氪', url: 'https://36kr.com/feed', keywords: ['锂电池', '固态电池', '储能', '氢能', '新能源', '电池', '充电', '磷酸铁锂', '三元锂', '快充'] },
  { name: 'IT之家', url: 'https://www.ithome.com/rss/', keywords: ['新能源', '电池', '充电', '氢能', '储能', '电动'] },
  { name: '虎嗅', url: 'https://www.huxiu.com/rss/0.xml', keywords: ['新能源', '电池', '储能', '锂', '氢能', '充电'] },
  { name: '界面新闻', url: 'https://www.jiemian.com/rss', keywords: ['新能源', '电池', '储能', '锂', '氢能', '充电', '光伏'] },
  { name: '财联社', url: 'https://www.cls.cn/rss', keywords: ['新能源', '电池', '储能', '锂', '氢能', '充电'] },
]

// Google News RSS（按关键词搜索）
async function fetchGoogleNews(keyword, limit = 5) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(keyword + ' 新能源')}&hl=zh-CN&gl=CN&ceid=CN:zh-Hans`
  return await fetchRSSItems(url, limit, 'Google News', keyword)
}

// 通用 RSS 抓取
async function fetchRSSItems(url, limit, sourceName, keyword) {
  try {
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NEIN/1.0)' },
      signal: AbortSignal.timeout(10000)
    })
    if (!resp.ok) return []
    const xml = await resp.text()

    // 简单 XML 解析（不依赖外部库）
    const items = []
    const itemMatches = xml.match(/<item>([\s\S]*?)<\/item>/gi) || []

    for (const item of itemMatches.slice(0, limit)) {
      const title = extractTag(item, 'title')
      const link = extractTag(item, 'link')
      const description = extractTag(item, 'description')
      const pubDate = extractTag(item, 'pubDate')
      const source = extractTag(item, 'source') || sourceName

      if (title) {
        items.push({
          title: cleanText(title),
          summary: cleanText(description || '').slice(0, 200),
          source: source,
          url: link || '',
          date: parseDate(pubDate),
          keywords: keyword ? [keyword] : []
        })
      }
    }
    return items
  } catch (err) {
    console.error(`RSS fetch failed: ${url} - ${err.message}`)
    return []
  }
}

// 从直接 RSS 源搜索
async function fetchDirectRSS(feed, query, limit = 5) {
  try {
    const resp = await fetch(feed.url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NEIN/1.0)' },
      signal: AbortSignal.timeout(10000)
    })
    if (!resp.ok) return []
    const xml = await resp.text()

    const items = []
    const itemMatches = xml.match(/<item>([\s\S]*?)<\/item>/gi) || []

    for (const item of itemMatches) {
      const title = extractTag(item, 'title') || ''
      const description = extractTag(item, 'description') || ''
      const text = title + description

      // 关键词匹配：用户查询词 或 源预设关键词
      const queryMatch = query.split(/\s+/).some(q => q && text.includes(q))
      const kwMatch = feed.keywords.some(kw => text.includes(kw))

      if (queryMatch || kwMatch) {
        items.push({
          title: cleanText(title),
          summary: cleanText(description).slice(0, 200),
          source: feed.name,
          url: extractTag(item, 'link') || '',
          date: parseDate(extractTag(item, 'pubDate')),
          keywords: feed.keywords.filter(kw => text.includes(kw))
        })
      }

      if (items.length >= limit) break
    }
    return items
  } catch (err) {
    console.error(`RSS fetch failed: ${feed.name} - ${err.message}`)
    return []
  }
}

// XML 辅助函数
function extractTag(xml, tag) {
  // 处理 CDATA
  const cdataMatch = xml.match(new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${tag}>`, 'i'))
  if (cdataMatch) return cdataMatch[1].trim()

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

function dedup(items) {
  const seen = new Set()
  return items.filter(item => {
    const key = item.title.slice(0, 15)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// ─── 主处理函数 ─────────────────────────────────────────

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { query, sources, limit = 5 } = req.body
  if (!query?.trim()) return res.status(400).json({ error: '请输入搜索关键词' })

  const apiKey = process.env.MIMO_API_KEY
  if (!apiKey) return res.status(500).json({ error: '服务端未配置 MIMO API Key' })

  try {
    // ─── 第一步：从多个 RSS 源抓取实时数据 ───
    console.log(`Searching RSS for: ${query}, sources: ${sources?.join(',')}, limit: ${limit}`)

    let allItems = []

    // Google News RSS（主要搜索渠道）
    const googleResults = await fetchGoogleNews(query, limit * 2)
    allItems.push(...googleResults)

    // 直接 RSS 源
    const feedsToSearch = sources?.length > 0
      ? RSS_FEEDS.filter(f => sources.includes(f.name))
      : RSS_FEEDS

    for (const feed of feedsToSearch) {
      const results = await fetchDirectRSS(feed, query, limit)
      allItems.push(...results)
    }

    // 去重
    allItems = dedup(allItems)

    // 按日期排序
    allItems.sort((a, b) => b.date.localeCompare(a.date))

    // 取前 N*3 条给 MIMO 筛选（RSS 结果可能不够精准）
    const candidates = allItems.slice(0, limit * 3)

    console.log(`Found ${allItems.length} RSS items, ${candidates.length} candidates for MIMO`)

    // 如果 RSS 完全没有结果，回退到纯 MIMO 搜索
    if (candidates.length === 0) {
      console.log('No RSS results, falling back to pure MIMO search')
      const fallbackResults = await mimoPureSearch(apiKey, query, sources, limit)
      return res.status(200).json({ success: true, query, count: fallbackResults.length, results: fallbackResults, source: 'ai' })
    }

    // ─── 第二步：用 MIMO 筛选和总结 ───
    const sourceText = sources?.length > 0 ? `用户偏好的来源：${sources.join('、')}` : ''

    const systemPrompt = `你是新能源行业资讯分析助手。你收到了一批从 RSS 抓取的实时新闻数据，请根据用户的搜索关键词进行筛选和总结。

任务：
1. 从候选数据中筛选出与用户关键词最相关的结果
2. 如果候选数据中有高度相关的结果，直接使用，不要编造
3. 如果候选数据中没有足够相关的，可以基于你的知识补充，但必须标注来源为"AI 补充"
4. ${sourceText}

返回要求：
- 返回 JSON 数组，最多 ${limit} 条
- 每条包含：title, summary(50-100字), source, url, date, keywords(数组)
- 优先保留有原文链接的结果
- 按相关性排序`

    const userPrompt = `搜索关键词：${query}

以下是 RSS 实时抓取的候选数据：
${candidates.map((c, i) => `${i + 1}. [${c.source}] ${c.title} (${c.date})\n   ${c.summary}\n   链接: ${c.url || '无'}`).join('\n\n')}

请从以上数据中筛选最相关的结果，返回 JSON 数组。`

    const mimoResp = await fetch('https://token-plan-cn.xiaomimimo.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'mimo-v2.5',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 3000
      })
    })

    if (!mimoResp.ok) {
      // MIMO 调用失败，直接返回 RSS 原始结果
      console.error('MIMO API error, returning raw RSS results')
      const rawResults = candidates.slice(0, limit)
      return res.status(200).json({ success: true, query, count: rawResults.length, results: rawResults, source: 'rss' })
    }

    const mimoData = await mimoResp.json()
    const content = mimoData.choices?.[0]?.message?.content || ''

    // 解析 MIMO 返回的 JSON
    let results = []
    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        results = JSON.parse(jsonMatch[0])
      }
    } catch {
      // 解析失败，返回 RSS 原始结果
      results = candidates.slice(0, limit)
    }

    // 确保结果不为空
    if (results.length === 0) {
      results = candidates.slice(0, limit)
    }

    return res.status(200).json({
      success: true,
      query,
      count: results.length,
      results,
      source: 'rss+ai'
    })

  } catch (err) {
    console.error('Search error:', err.message)
    return res.status(500).json({ error: `搜索失败: ${err.message}` })
  }
}

// 纯 MIMO 搜索（RSS 无结果时的回退方案）
async function mimoPureSearch(apiKey, query, sources, limit) {
  const sourceText = sources?.length > 0 ? `优先从以下来源获取：${sources.join('、')}` : ''

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
          content: `你是新能源行业资讯搜索助手。根据用户关键词搜索最新资讯。${sourceText}。返回 JSON 数组，每条包含 title, summary, source, url, date, keywords 字段。最多 ${limit} 条。只返回 JSON，不要其他文字。`
        },
        { role: 'user', content: query }
      ],
      temperature: 0.3,
      max_tokens: 3000
    })
  })

  if (!resp.ok) return []

  const data = await resp.json()
  const content = data.choices?.[0]?.message?.content || ''

  try {
    const jsonMatch = content.match(/\[[\s\S]*\]/)
    return jsonMatch ? JSON.parse(jsonMatch[0]) : []
  } catch {
    return []
  }
}
