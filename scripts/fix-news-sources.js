#!/usr/bin/env node
// 脚本：修正超时/失败的新闻源 URL
// 策略：MIMO 生成候选 URL → 逐个验证 → 更新 sources.json
// 对每个源尝试多种搜索 URL 模式，直到找到可用的

import { readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = join(__dirname, '..')

const MIMO_API_URL = 'https://token-plan-cn.xiaomimimo.com/v1/chat/completions'
const MIMO_API_KEY = process.env.MIMO_API_KEY

// ─── 读取输入 ────────────────────────────────────────────

const inputRaw = process.argv[2]
if (!inputRaw) {
  console.error('Usage: node fix-news-sources.js \'{"failedSources":[...],"keyword":"..."}\'')
  process.exit(1)
}

let input
try { input = JSON.parse(inputRaw) } catch { console.error('Invalid JSON'); process.exit(1) }

const { failedSources, keyword = '新能源' } = input
if (!failedSources?.length) { console.log('No failed sources'); process.exit(0) }

// ─── 读取 sources.json ───────────────────────────────────

const sourcesPath = join(ROOT, 'api', 'config', 'sources.json')
const config = JSON.parse(readFileSync(sourcesPath, 'utf-8'))

// ─── 候选 URL 模式（不依赖 MIMO，直接穷举） ─────────────

const SEARCH_PATTERNS = [
  'https://{domain}/search?keyword={keyword}',
  'https://{domain}/search?q={keyword}',
  'https://{domain}/search?word={keyword}',
  'https://{domain}/search/{keyword}',
  'https://{domain}/?s={keyword}',
  'https://{domain}/news?keyword={keyword}',
  'https://www.{domain}/search?keyword={keyword}',
  'https://www.{domain}/search?q={keyword}',
]

// 搜索引擎兜底（只在所有自身 URL 都失败后使用）
const FALLBACK_PATTERNS = [
  'https://www.bing.com/search?q=site:{domain}+{keyword}',
  'https://www.baidu.com/s?wd=site:{domain}+{keyword}',
]

function getDomain(urlTemplate) {
  try {
    const m = urlTemplate.match(/https?:\/\/([^/]+)/)
    return m ? m[1].replace('www.', '') : ''
  } catch { return '' }
}

function buildCandidateUrls(domain, keyword) {
  const kw = encodeURIComponent(keyword)
  const ownUrls = SEARCH_PATTERNS.map(p =>
    p.replace('{domain}', domain).replace('{keyword}', kw)
  )
  const fallbackUrls = FALLBACK_PATTERNS.map(p =>
    p.replace('{domain}', domain).replace('{keyword}', kw)
  )
  return { ownUrls, fallbackUrls }
}

async function verifyUrl(url, expectedDomain) {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 6000)

    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,*/*',
        'Accept-Language': 'zh-CN,zh;q=0.9'
      },
      signal: controller.signal,
      redirect: 'follow'
    })
    clearTimeout(timeoutId)

    if (!resp.ok) return false
    const html = await resp.text()
    if (html.length < 1000) return false

    // 验证：最终 URL 必须属于目标域名（不能是搜索引擎）
    const finalUrl = resp.url || url
    const finalDomain = new URL(finalUrl).hostname.replace('www.', '')
    if (!finalDomain.includes(expectedDomain) && !expectedDomain.includes(finalDomain)) {
      return false
    }

    const hasChinese = /[\u4e00-\u9fff]/.test(html)
    const hasKeyword = html.includes(keyword) || html.includes(decodeURIComponent(keyword))
    return hasChinese || hasKeyword
  } catch {
    return false
  }
}

// ─── 调用 MIMO 获取 URL 建议（容错处理） ──────────────────

async function getMimoSuggestions(failedSources, keyword) {
  if (!MIMO_API_KEY) {
    console.log('MIMO_API_KEY not set, skipping MIMO suggestions')
    return []
  }

  const sourceList = failedSources.map(s => `- ${s.name} (当前URL: ${s.url_template})`).join('\n')

  const prompt = `以下新闻网站的搜索URL失效了，请给出每个网站正确的搜索URL。

要求：
- 用 {keyword} 作为搜索关键词占位符
- 给出你最有把握的URL
- 每行一个，格式：源名称 | https://xxx/search?q={keyword}

源列表：
${sourceList}`

  try {
    const resp = await fetch(MIMO_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MIMO_API_KEY}`
      },
      body: JSON.stringify({
        model: 'mimo-v2.5',
        messages: [
          { role: 'system', content: '你是URL分析专家。每行给出一个URL，格式：名称 | URL。不要其他内容。' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.1,
        max_tokens: 2000
      })
    })

    if (!resp.ok) {
      console.error('MIMO API error:', resp.status)
      return []
    }

    const data = await resp.json()
    const content = data.choices?.[0]?.message?.content || ''
    console.log('MIMO response:', content.slice(0, 500))

    // 解析 "名称 | URL" 格式（一行一个）
    const results = []
    for (const line of content.split('\n')) {
      const match = line.match(/^(.+?)\s*[|｜]\s*(https?:\/\/\S+)/)
      if (match) {
        const name = match[1].trim().replace(/^[-•*]\s*/, '')
        const url = match[2].trim()
        results.push({ name, url_template: url })
      }
    }

    return results
  } catch (err) {
    console.error('MIMO call failed:', err.message)
    return []
  }
}

// ─── 主流程 ──────────────────────────────────────────────

async function main() {
  console.log(`Fixing ${failedSources.length} sources for keyword: ${keyword}`)

  const sourcesToFix = config.sources.filter(s => failedSources.includes(s.name))
  if (!sourcesToFix.length) {
    console.log('No matching sources found')
    process.exit(0)
  }

  console.log(`Found ${sourcesToFix.length} sources to fix`)

  // 第一步：调 MIMO 获取建议
  const mimoSuggestions = await getMimoSuggestions(sourcesToFix, keyword)
  console.log(`MIMO returned ${mimoSuggestions.length} suggestions`)

  let updatedCount = 0

  for (const source of sourcesToFix) {
    console.log(`\n--- Fixing: ${source.name} ---`)
    const domain = getDomain(source.url_template)
    if (!domain) {
      console.log(`  ❌ Cannot extract domain from: ${source.url_template}`)
      continue
    }

    // 收集候选 URL
    const candidates = []

    // MIMO 建议的 URL
    const mimoMatch = mimoSuggestions.find(s =>
      source.name.includes(s.name) || s.name.includes(source.name)
    )
    if (mimoMatch) candidates.push({ url: mimoMatch.url_template, isFallback: false })

    // 穷举网站自身搜索模式
    const { ownUrls, fallbackUrls } = buildCandidateUrls(domain, keyword)
    ownUrls.forEach(u => candidates.push({ url: u, isFallback: false }))

    let found = false

    // 第一轮：验证网站自身的搜索 URL（必须属于目标域名）
    for (const { url } of candidates.filter(c => !c.isFallback)) {
      const isValid = await verifyUrl(url, domain)
      if (isValid) {
        console.log(`  ✅ Found working URL: ${url}`)
        source.url_template = url
        updatedCount++
        found = true
        break
      }
    }

    // 第二轮：搜索引擎兜底（不再验证域名）
    if (!found) {
      console.log(`  ⚠️ Site URLs failed, trying search engine fallbacks...`)
      for (const fbUrl of fallbackUrls) {
        try {
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), 6000)
          const resp = await fetch(fbUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'text/html' },
            signal: controller.signal, redirect: 'follow'
          })
          clearTimeout(timeoutId)
          if (resp.ok) {
            const html = await resp.text()
            if (html.length > 1000) {
              console.log(`  ⚠️ Using search engine fallback: ${fbUrl}`)
              source.url_template = fbUrl
              updatedCount++
              found = true
              break
            }
          }
        } catch {}
      }
    }

    if (!found) {
      console.log(`  ❌ No working URL found for ${source.name}`)
    }
  }

  // 写回
  if (updatedCount > 0) {
    writeFileSync(sourcesPath, JSON.stringify(config, null, 2) + '\n')
    console.log(`\n✅ Updated ${updatedCount} source(s)`)
  } else {
    console.log('\n❌ No sources were updated')
  }
}

main().catch(err => {
  console.error('Script failed:', err)
  process.exit(1)
})
