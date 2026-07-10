import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { useNewsStore } from './news'
import { useTimeFilterStore } from './timeFilter'
import { useRealtimeSearchStore } from './realtimeSearch'
import { useNewsReportStore } from './newsReport'

const CONFIG_KEY = 'nein_ai_config'
const HISTORY_KEY = 'nein_ai_history'

export const useAiStore = defineStore('ai', () => {
  // Config
  const mode = ref('mimo') // 'mimo' | 'external' | 'internal'
  const externalApiUrl = ref('')
  const externalApiKey = ref('')
  const externalModel = ref('')
  const internalApiUrl = ref('')
  const internalApiKey = ref('')
  const internalModel = ref('')

  // Chat state
  const messages = ref([])
  const isLoading = ref(false)
  const isOpen = ref(false)
  const aiContextLimit = ref(80) // system prompt 中注入的最大新闻条数

  // Load config
  function loadConfig() {
    try {
      const saved = localStorage.getItem(CONFIG_KEY)
      if (saved) {
        const cfg = JSON.parse(saved)
        mode.value = cfg.mode || 'mimo'
        externalApiUrl.value = cfg.externalApiUrl || ''
        externalApiKey.value = cfg.externalApiKey || ''
        externalModel.value = cfg.externalModel || ''
        internalApiUrl.value = cfg.internalApiUrl || ''
        internalApiKey.value = cfg.internalApiKey || ''
        internalModel.value = cfg.internalModel || ''
      }
    } catch (e) { /* ignore */ }
  }

  function saveConfig() {
    localStorage.setItem(CONFIG_KEY, JSON.stringify({
      mode: mode.value,
      externalApiUrl: externalApiUrl.value,
      externalApiKey: externalApiKey.value,
      externalModel: externalModel.value,
      internalApiUrl: internalApiUrl.value,
      internalApiKey: internalApiKey.value,
      internalModel: internalModel.value
    }))
  }

  function loadHistory() {
    try {
      const saved = localStorage.getItem(HISTORY_KEY)
      if (saved) messages.value = JSON.parse(saved)
    } catch (e) { /* ignore */ }
  }

  function saveHistory() {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(messages.value.slice(-50)))
  }

  function clearHistory() {
    messages.value = []
    localStorage.removeItem(HISTORY_KEY)
  }

  // URL 自动补全
  function normalizeApiUrl(url) {
    if (!url) return url
    url = url.trim().replace(/\/+$/, '') // 去掉末尾斜杠
    // 如果已经以 /chat/completions 结尾，不处理
    if (url.endsWith('/chat/completions')) return url
    // 如果以 /v1 结尾，补 /chat/completions
    if (url.endsWith('/v1')) return url + '/chat/completions'
    // 如果以 /v1/ 开头但不是 chat，补 chat/completions
    if (/\/v1\/?$/.test(url)) return url + '/chat/completions'
    // 其他情况，补 /v1/chat/completions
    return url + '/v1/chat/completions'
  }

  // 获取数据范围内的新闻（合并三个数据源）
  function getScopedArticles() {
    const newsStore = useNewsStore()
    const timeFilter = useTimeFilterStore()
    const rtStore = useRealtimeSearchStore()
    const reportStore = useNewsReportStore()

    // 1. 资讯页静态数据（时间筛选）
    const timeFiltered = newsStore.articles.filter(a =>
      a.publishedAt >= timeFilter.startDate && a.publishedAt <= timeFilter.endDate
    )
    // 2. 实时搜索结果（api/search）
    const searchResults = rtStore.results || []
    // 3. 报告页搜索结果（api/news-search）
    const reportResults = (reportStore.newsList || []).map(item => ({
      title: item.title,
      summary: item.summary,
      source: item.source,
      publishedAt: item.date,
      sourceUrl: item.url,
      keywords: []
    }))

    // 合并去重（标题前20字）
    const seen = new Set()
    const combined = []
    for (const a of [...reportResults, ...searchResults, ...timeFiltered]) {
      const key = (a.title || '').slice(0, 20)
      if (!seen.has(key)) {
        seen.add(key)
        combined.push(a)
      }
    }
    return combined
  }

  // 构建 system prompt
  function buildSystemPrompt() {
    const timeFilter = useTimeFilterStore()
    const articles = getScopedArticles()

    const articleList = articles.slice(0, aiContextLimit.value).map((a, i) => {
      const tags = a.tags ? ` | 地点:${a.tags['地点'] || '-'} | 企业:${(a.tags['涉及企业'] || []).join(',')}` : ''
      return `${i + 1}. [${a.source}] ${a.title}（${a.publishedAt}）${tags}\n   ${a.summary}`
    }).join('\n\n')

    return `你是新能源行业资讯分析助手（NEIN AI）。你的职责是基于提供的新闻数据库回答用户问题。

数据范围：${timeFilter.startDate} ~ ${timeFilter.endDate}
数据来源：资讯页静态数据 + 实时搜索 + 报告页搜索
数据库中共有 ${articles.length} 条相关新闻（展示前 ${Math.min(articles.length, aiContextLimit.value)} 条）。

以下是数据库中的新闻数据：
${articleList}

回答规则：
1. 仅基于以上数据回答，不要编造不在数据中的信息
2. 如果数据不足以回答，明确告知用户
3. 回答时引用具体新闻来源，如"据36氪报道..."
4. 使用 Markdown 格式，适当使用加粗、列表等
5. 对比分析不同信息源的观点
6. 总结归纳行业趋势时要有数据支撑
7. 回答简洁专业，避免废话`
  }

  async function sendMessage(userMessage) {
    messages.value.push({ role: 'user', content: userMessage })
    isLoading.value = true
    saveHistory()

    try {
      let reply = ''

      if (mode.value === 'mimo') {
        reply = await callViaBackend(userMessage)
      } else if (mode.value === 'external') {
        reply = await callDirect(externalApiUrl.value, externalApiKey.value, externalModel.value, userMessage)
      } else {
        reply = await callDirect(internalApiUrl.value, internalApiKey.value, internalModel.value, userMessage)
      }

      messages.value.push({ role: 'assistant', content: reply })
    } catch (err) {
      messages.value.push({
        role: 'assistant',
        content: `⚠️ 请求失败：${err.message}`
      })
    } finally {
      isLoading.value = false
      saveHistory()
    }
  }

  // MIMO 模式：通过后端 API 调用
  async function callViaBackend(userMessage) {
    const apiMessages = [
      { role: 'system', content: buildSystemPrompt() },
      ...messages.value.slice(-10)
    ]

    const resp = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: apiMessages })
    })

    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({}))
      throw new Error(errData.error || `请求失败: ${resp.status}`)
    }

    const data = await resp.json()
    return data.content || '未收到有效回复'
  }

  // 外部/内部模型：直接调用（自动补全 URL）
  async function callDirect(apiUrl, apiKey, model, userMessage) {
    const fullUrl = normalizeApiUrl(apiUrl)
    if (!fullUrl) throw new Error('请先配置 API URL')

    const body = {
      model: model || 'default',
      messages: [
        { role: 'system', content: buildSystemPrompt() },
        ...messages.value.slice(-10)
      ],
      temperature: 0.7,
      max_tokens: 2000
    }

    const headers = { 'Content-Type': 'application/json' }
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`

    const resp = await fetch(fullUrl, { method: 'POST', headers, body: JSON.stringify(body) })

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '')
      throw new Error(`API 错误 ${resp.status}: ${errText.slice(0, 200)}`)
    }

    const data = await resp.json()
    return data.choices?.[0]?.message?.content || '未收到有效回复'
  }

  // Init
  loadConfig()
  loadHistory()

  watch([mode, externalApiUrl, externalApiKey, externalModel, internalApiUrl, internalApiKey, internalModel], saveConfig)

  return {
    mode, externalApiUrl, externalApiKey, externalModel,
    internalApiUrl, internalApiKey, internalModel,
    messages, isLoading, isOpen, aiContextLimit,
    sendMessage, clearHistory
  }
})
