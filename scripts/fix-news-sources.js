#!/usr/bin/env node
// 脚本：通过 MIMO 大模型修正超时/失败的新闻源 URL
// 输入：JSON string { "failedSources": ["源名称", ...], "keyword": "关键词" }
// 输出：更新 api/config/sources.json 中对应源的 url_template

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
try {
  input = JSON.parse(inputRaw)
} catch {
  console.error('Invalid JSON input')
  process.exit(1)
}

const { failedSources, keyword = '新能源' } = input
if (!failedSources || failedSources.length === 0) {
  console.log('No failed sources to fix')
  process.exit(0)
}

// ─── 读取 sources.json ───────────────────────────────────

const sourcesPath = join(ROOT, 'api', 'config', 'sources.json')
const config = JSON.parse(readFileSync(sourcesPath, 'utf-8'))

// ─── 调用 MIMO 分析并修正 URL ────────────────────────────

async function fixUrls(sources, keyword) {
  if (!MIMO_API_KEY) {
    console.error('MIMO_API_KEY not set')
    process.exit(1)
  }

  const sourceList = sources.map(s => {
    return `- ${s.name} (id: ${s.id})，当前URL: ${s.url_template}`
  }).join('\n')

  const prompt = `你是网页爬虫专家。以下新闻网站的搜索URL已失效（超时或无法访问），请为每个网站找出正确的搜索URL格式。

要求：
1. 搜索关键词用 {keyword} 占位
2. URL 必须是该网站的真实搜索页面
3. 优先使用站内搜索，其次用搜索引擎 site: 限定
4. 只返回 JSON 数组，格式：[{"id":"源id","name":"源名称","url_template":"修正后的URL"}]
5. 如果某个网站确实无法找到可用搜索URL，跳过该条

需要修正的源：
${sourceList}

搜索关键词参考：${keyword}

请逐个分析每个网站，给出修正后的搜索URL。只返回 JSON，不要其他文字。`

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
          { role: 'system', content: '你是 URL 分析专家。只返回 JSON 数组，不要其他文字。' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.1,
        max_tokens: 3000
      })
    })

    if (!resp.ok) {
      console.error('MIMO API error:', resp.status)
      return []
    }

    const data = await resp.json()
    const content = data.choices?.[0]?.message?.content || ''
    const jsonMatch = content.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      console.error('Failed to parse MIMO response as JSON')
      return []
    }

    return JSON.parse(jsonMatch[0])
  } catch (err) {
    console.error('MIMO call failed:', err.message)
    return []
  }
}

// ─── 验证 URL 是否可访问 ─────────────────────────────────

async function verifyUrl(url) {
  try {
    const testUrl = url.replace('{keyword}', encodeURIComponent('新能源'))
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 8000)

    const resp = await fetch(testUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,*/*'
      },
      signal: controller.signal,
      redirect: 'follow'
    })
    clearTimeout(timeoutId)

    if (!resp.ok) return false
    const html = await resp.text()
    // HTML 太短说明页面无效
    return html.length > 500
  } catch {
    return false
  }
}

// ─── 主流程 ──────────────────────────────────────────────

async function main() {
  console.log(`Fixing ${failedSources.length} sources for keyword: ${keyword}`)

  // 找到失败源的配置
  const sourcesToFix = config.sources.filter(s =>
    failedSources.includes(s.name)
  )

  if (sourcesToFix.length === 0) {
    console.log('No matching sources found in config')
    process.exit(0)
  }

  console.log(`Found ${sourcesToFix.length} sources to fix: ${sourcesToFix.map(s => s.name).join(', ')}`)

  // 调用 MIMO 获取修正后的 URL
  const fixedUrls = await fixUrls(sourcesToFix, keyword)
  console.log(`MIMO returned ${fixedUrls.length} fixed URLs`)

  let updatedCount = 0

  for (const fix of fixedUrls) {
    if (!fix.url_template || !fix.id) continue

    // 验证新 URL
    console.log(`Verifying: ${fix.name} -> ${fix.url_template}`)
    const isValid = await verifyUrl(fix.url_template)

    if (isValid) {
      // 更新配置
      const source = config.sources.find(s => s.id === fix.id)
      if (source) {
        const oldUrl = source.url_template
        source.url_template = fix.url_template
        console.log(`✅ Fixed: ${fix.name}`)
        console.log(`   Old: ${oldUrl}`)
        console.log(`   New: ${fix.url_template}`)
        updatedCount++
      }
    } else {
      console.log(`❌ Skipped: ${fix.name} (new URL also unreachable)`)
    }
  }

  // 写回 sources.json
  if (updatedCount > 0) {
    writeFileSync(sourcesPath, JSON.stringify(config, null, 2) + '\n')
    console.log(`\nUpdated ${updatedCount} source(s) in sources.json`)
  } else {
    console.log('\nNo sources were updated')
  }
}

main().catch(err => {
  console.error('Script failed:', err)
  process.exit(1)
})
