import { defineStore } from 'pinia'
import { ref, watch, computed } from 'vue'
import { useNewsStore } from './news'
import { useTimeFilterStore } from './timeFilter'
import { useRealtimeSearchStore } from './realtimeSearch'

const STORAGE_KEY = 'nein_ai_config'
const HISTORY_KEY = 'nein_ai_history'

export const useAiStore = defineStore('ai', () => {
  // Config - 模式：mimo（MIMO分析）| external（外部模型）| internal（内部模型）
  const mode = ref('mimo')
  const externalApiUrl = ref('https://api.deepseek.com/v1/chat/completions')
  const externalApiKey = ref('')
  const externalModel = ref('deepseek-chat')
  const internalApiUrl = ref('')
  const internalModel = ref('')
  const internalApiKey = ref('')

  // Chat state
  const messages = ref([])
  const isLoading = ref(false)
  const isOpen = ref(false)

  // Load config from localStorage
  function loadConfig() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const cfg = JSON.parse(saved)
        mode.value = cfg.mode || 'mimo'
        externalApiUrl.value = cfg.externalApiUrl || 'https://api.deepseek.com/v1/chat/completions'
        externalApiKey.value = cfg.externalApiKey || ''
        externalModel.value = cfg.externalModel || 'deepseek-chat'
        internalApiUrl.value = cfg.internalApiUrl || ''
        internalModel.value = cfg.internalModel || ''
        internalApiKey.value = cfg.internalApiKey || ''
      }
    } catch (e) { /* ignore */ }
  }

  function saveConfig() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      mode: mode.value,
      externalApiUrl: externalApiUrl.value,
      externalApiKey: externalApiKey.value,
      externalModel: externalModel.value,
      internalApiUrl: internalApiUrl.value,
      internalModel: internalModel.value,
      internalApiKey: internalApiKey.value
    }))
  }

  function loadHistory() {
    try {
      const saved = localStorage.getItem(HISTORY_KEY)
      if (saved) messages.value = JSON.parse(saved)
    } catch (e) { /* ignore */ }
  }

  function saveHistory() {
    const toSave = messages.value.slice(-50)
    localStorage.setItem(HISTORY_KEY, JSON.stringify(toSave))
  }

  function clearHistory() {
    messages.value = []
    localStorage.removeItem(HISTORY_KEY)
  }

  // 获取当前数据范围内的新闻（时间筛选 + 搜索结果）
  function getScopedArticles() {
    const newsStore = useNewsStore()
    const timeFilter = useTimeFilterStore()
    const rtStore = useRealtimeSearchStore()

    // 时间筛选范围内的新闻
    const timeFiltered = newsStore.articles.filter(a =>
      a.publishedAt >= timeFilter.startDate && a.publishedAt <= timeFilter.endDate
    )

    // 用户AI搜索到的新闻
    const searchResults = rtStore.results || []

    // 合并去重
    const seen = new Set()
    const combined = []
    for (const a of [...searchResults, ...timeFiltered]) {
      const key = (a.title || '').slice(0, 20)
      if (!seen.has(key)) {
        seen.add(key)
        combined.push(a)
      }
    }

    return combined
  }

  // 构建 MIMO 分析的 system prompt
  function buildMimoPrompt() {
    const timeFilter = useTimeFilterStore()
    const articles = getScopedArticles()

    const articleList = articles.slice(0, 30).map((a, i) => {
      const tags = a.tags ? ` | 地点:${a.tags['地点'] || '-'} | 企业:${(a.tags['涉及企业'] || []).join(',')}` : ''
      return `${i + 1}. [${a.source}] ${a.title}（${a.publishedAt}）${tags}\n   ${a.summary}`
    }).join('\n\n')

    return `你是新能源行业资讯分析助手（NEIN AI）。你的职责是基于提供的新闻数据库回答用户问题。

数据范围：${timeFilter.startDate} ~ ${timeFilter.endDate}
数据库中共有 ${articles.length} 条相关新闻。

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

  // 构建通用 system prompt（external/internal 模式）
  function buildGenericPrompt() {
    const articles = getScopedArticles()
    const recentNews = articles.slice(0, 10).map(a =>
      `- [${a.publishedAt}] ${a.title}（${a.source}）: ${a.summary.slice(0, 80)}...`
    ).join('\n')

    return `你是新能源行业资讯助手，专注于锂电池材料、固态电池、磷酸铁锂、三元锂、快充技术、新能源事故、储能、氢能等领域。

你的职责：
1. 基于提供的资讯数据回答用户问题
2. 总结归纳行业动态和趋势
3. 对比分析不同技术路线和市场变化
4. 回答时标注信息来源

你不应该：
1. 回答与新能源行业无关的问题
2. 编造不在数据中的信息
3. 提供投资建议

以下是近期资讯数据：
${recentNews}

当用户提问时，请基于以上数据进行分析和回答。如果数据不足以回答，请说明。回答请使用 Markdown 格式。`
  }

  async function sendMessage(userMessage) {
    messages.value.push({ role: 'user', content: userMessage })
    isLoading.value = true
    saveHistory()

    try {
      let reply = ''

      if (mode.value === 'mimo') {
        reply = await callMimoAnalysis(userMessage)
      } else if (mode.value === 'external') {
        reply = await callLLM(externalApiUrl.value, externalApiKey.value, externalModel.value, userMessage, buildGenericPrompt())
      } else {
        reply = await callLLM(internalApiUrl.value, internalApiKey.value, internalModel.value, userMessage, buildGenericPrompt())
      }

      messages.value.push({ role: 'assistant', content: reply })
    } catch (err) {
      messages.value.push({
        role: 'assistant',
        content: `⚠️ 请求失败：${err.message}\n\n请检查 API 配置是否正确。`
      })
    } finally {
      isLoading.value = false
      saveHistory()
    }
  }

  // 调用 MIMO v2.5-pro 进行分析
  async function callMimoAnalysis(userMessage) {
    const apiUrl = internalApiUrl.value || 'https://token-plan-cn.xiaomimimo.com/v1/chat/completions'
    const apiKey = internalApiKey.value
    const model = internalModel.value || 'mimo-v2.5-pro'

    if (!apiKey) {
      throw new Error('请先在设置中配置 MIMO API Key')
    }

    const body = {
      model: model,
      messages: [
        { role: 'system', content: buildMimoPrompt() },
        ...messages.value.slice(-10)
      ],
      temperature: 0.7,
      max_tokens: 2000,
      stream: false
    }

    const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` }
    const resp = await fetch(apiUrl, { method: 'POST', headers, body: JSON.stringify(body) })

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '')
      throw new Error(`MIMO API 错误 ${resp.status}: ${errText.slice(0, 200)}`)
    }

    const data = await resp.json()
    return data.choices?.[0]?.message?.content || '未收到有效回复'
  }

  // 通用 LLM 调用
  async function callLLM(apiUrl, apiKey, model, userMessage, systemPrompt) {
    const body = {
      model: model,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.value.slice(-10)
      ],
      temperature: 0.7,
      max_tokens: 2000,
      stream: false
    }

    const headers = { 'Content-Type': 'application/json' }
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`

    const resp = await fetch(apiUrl, { method: 'POST', headers, body: JSON.stringify(body) })

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

  watch([mode, externalApiUrl, externalApiKey, externalModel, internalApiUrl, internalModel, internalApiKey], saveConfig)

  return {
    mode, externalApiUrl, externalApiKey, externalModel,
    internalApiUrl, internalModel, internalApiKey,
    messages, isLoading, isOpen,
    sendMessage, clearHistory, saveConfig,
    getScopedArticles
  }
})
