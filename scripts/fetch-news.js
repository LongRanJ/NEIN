/**
 * NEIN News Fetch Script
 * 
 * Fetches news from multiple sources:
 * 1. Google News RSS (keyword-based aggregation)
 * 2. 36Kr / IT之家 / 虎嗅 RSS feeds
 * 3. NewsAPI (optional, requires API key)
 * 
 * Output: src/data/news.json
 */

import { writeFileSync, readFileSync, existsSync } from 'fs'
import { parseStringPromise } from 'xml2js'

const KEYWORDS = ['锂电池材料', '固态电池', '磷酸铁锂', '三元锂', '快充技术', '新能源事故', '储能', '氢能']
const SOURCES = ['36氪', '第一财经', '界面新闻', '财联社', 'OFweek', '高工锂电', '汽车之家', '电车通', '北极星储能网', '能源杂志']
const MAX_PER_SOURCE = 5
const NEWSAPI_KEY = process.env.NEWSAPI_KEY || ''

// ─── RSS Fetch ─────────────────────────────────────────────

async function fetchRSS(url) {
  try {
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NEIN/1.0)' },
      signal: AbortSignal.timeout(15000)
    })
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    const xml = await resp.text()
    const result = await parseStringPromise(xml)
    return result?.rss?.channel?.[0]?.item || []
  } catch (err) {
    console.error(`  ✗ RSS fetch failed: ${url} - ${err.message}`)
    return []
  }
}

// ─── Google News RSS ───────────────────────────────────────

async function fetchGoogleNews(keyword) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(keyword + ' 新能源')}&hl=zh-CN&gl=CN&ceid=CN:zh-Hans`
  const items = await fetchRSS(url)
  return items.slice(0, MAX_PER_SOURCE).map(item => ({
    id: `gn-${hashStr(item.link?.[0] || item.title?.[0] || '')}`,
    title: cleanText(item.title?.[0] || ''),
    summary: cleanText(item.description?.[0] || '').slice(0, 300),
    source: extractSource(item.title?.[0] || item.source?.[0] || 'Google News'),
    sourceUrl: item.link?.[0] || '',
    publishedAt: parseRSSDate(item.pubDate?.[0]),
    keywords: [keyword],
    category: categorize(item.title?.[0] || ''),
    importance: assessImportance(item.title?.[0] || '')
  }))
}

// ─── Direct RSS Sources ────────────────────────────────────

const RSS_FEEDS = [
  { name: '36氪', url: 'https://36kr.com/feed', keywords: ['锂电池', '固态电池', '储能', '氢能', '新能源'] },
  { name: 'IT之家', url: 'https://www.ithome.com/rss/', keywords: ['新能源', '电池', '充电', '氢能'] },
  { name: '虎嗅', url: 'https://www.huxiu.com/rss/0.xml', keywords: ['新能源', '电池', '储能'] },
]

async function fetchDirectRSS(feed) {
  const items = await fetchRSS(feed.url)
  const relevant = items.filter(item => {
    const text = (item.title?.[0] || '') + (item.description?.[0] || '')
    return feed.keywords.some(kw => text.includes(kw))
  })
  return relevant.slice(0, MAX_PER_SOURCE).map(item => ({
    id: `rss-${hashStr(item.link?.[0] || item.title?.[0] || '')}`,
    title: cleanText(item.title?.[0] || ''),
    summary: cleanText(stripHtml(item.description?.[0] || '')).slice(0, 300),
    source: feed.name,
    sourceUrl: item.link?.[0] || '',
    publishedAt: parseRSSDate(item.pubDate?.[0]),
    keywords: matchKeywords(item.title?.[0] || '', item.description?.[0] || ''),
    category: categorize(item.title?.[0] || ''),
    importance: assessImportance(item.title?.[0] || '')
  }))
}

// ─── NewsAPI ───────────────────────────────────────────────

async function fetchNewsAPI(keyword) {
  if (!NEWSAPI_KEY) return []
  try {
    const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(keyword + ' 新能源')}&language=zh&sortBy=publishedAt&pageSize=${MAX_PER_SOURCE}&apiKey=${NEWSAPI_KEY}`
    const resp = await fetch(url, { signal: AbortSignal.timeout(10000) })
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    const data = await resp.json()
    return (data.articles || []).map(a => ({
      id: `api-${hashStr(a.url || a.title || '')}`,
      title: cleanText(a.title || ''),
      summary: cleanText(a.description || '').slice(0, 300),
      source: a.source?.name || 'NewsAPI',
      sourceUrl: a.url || '',
      publishedAt: (a.publishedAt || '').split('T')[0],
      keywords: [keyword],
      category: categorize(a.title || ''),
      importance: assessImportance(a.title || '')
    }))
  } catch (err) {
    console.error(`  ✗ NewsAPI failed for "${keyword}": ${err.message}`)
    return []
  }
}

// ─── Helpers ───────────────────────────────────────────────

function cleanText(text) {
  return text.replace(/<[^>]+>/g, '').replace(/&[^;]+;/g, ' ').replace(/\s+/g, ' ').trim()
}

function stripHtml(html) {
  return html.replace(/<[^>]+>/g, '')
}

function hashStr(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash).toString(36)
}

function parseRSSDate(dateStr) {
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return new Date().toISOString().split('T')[0]
    return d.toISOString().split('T')[0]
  } catch {
    return new Date().toISOString().split('T')[0]
  }
}

function extractSource(title) {
  for (const src of SOURCES) {
    if (title.includes(src)) return src
  }
  return '综合来源'
}

function matchKeywords(title, desc) {
  const text = title + desc
  return KEYWORDS.filter(kw => text.includes(kw))
}

function categorize(title) {
  const cats = [
    { pattern: /突破|创新|研发|专利|首发/, label: '技术突破' },
    { pattern: /事故|安全|起火|自燃|召回/, label: '安全事件' },
    { pattern: /政策|标准|法规|补贴/, label: '政策法规' },
    { pattern: /市场|出货|装车|销量|份额/, label: '市场动态' },
    { pattern: /产能|工厂|投产|扩产/, label: '产能布局' },
    { pattern: /投资|融资|上市|收购/, label: '资本动态' },
    { pattern: /储能|电站|并网/, label: '储能应用' },
  ]
  for (const c of cats) {
    if (c.pattern.test(title)) return c.label
  }
  return '行业资讯'
}

function assessImportance(title) {
  const high = /突破|首[次款]|事故|安全|政策|重大|全球|领先|里程碑/
  const low = /日常|常规|小幅|微调/
  if (high.test(title)) return 'high'
  if (low.test(title)) return 'low'
  return 'medium'
}

function dedup(articles) {
  const seen = new Set()
  return articles.filter(a => {
    const key = a.title.slice(0, 20)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// ─── Main ──────────────────────────────────────────────────

async function main() {
  console.log('🔋 NEIN News Fetcher starting...')
  console.log(`📅 ${new Date().toISOString()}`)
  console.log(`🔑 NewsAPI: ${NEWSAPI_KEY ? 'configured' : 'not configured'}\n`)

  let allArticles = []

  // 1. Google News RSS
  console.log('📰 Fetching Google News RSS...')
  for (const kw of KEYWORDS) {
    console.log(`  → ${kw}`)
    const articles = await fetchGoogleNews(kw)
    allArticles.push(...articles)
  }

  // 2. Direct RSS feeds
  console.log('\n📰 Fetching direct RSS feeds...')
  for (const feed of RSS_FEEDS) {
    console.log(`  → ${feed.name}`)
    const articles = await fetchDirectRSS(feed)
    allArticles.push(...articles)
  }

  // 3. NewsAPI
  if (NEWSAPI_KEY) {
    console.log('\n📰 Fetching from NewsAPI...')
    for (const kw of KEYWORDS.slice(0, 3)) {
      const articles = await fetchNewsAPI(kw)
      allArticles.push(...articles)
    }
  }

  // Dedup
  allArticles = dedup(allArticles)

  // Sort by date descending
  allArticles.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))

  // Build output
  const output = {
    lastUpdated: new Date().toISOString(),
    keywords: KEYWORDS,
    sources: SOURCES,
    articles: allArticles
  }

  // Read existing data for fallback
  const outputPath = 'src/data/news.json'
  if (allArticles.length === 0 && existsSync(outputPath)) {
    console.log('\n⚠️ No new articles fetched, keeping existing data.')
    return
  }

  writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8')
  console.log(`\n✅ Done! ${allArticles.length} articles saved to ${outputPath}`)
  console.log(`   Keywords: ${KEYWORDS.length}`)
  console.log(`   Sources used: ${[...new Set(allArticles.map(a => a.source))].join(', ')}`)
}

main().catch(err => {
  console.error('❌ Fatal error:', err)
  process.exit(1)
})
