import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { useNewsStore } from './news'

const STORAGE_KEY = 'nein-ai-config'
const HISTORY_KEY = 'nein-ai-history'

export const useAiStore = defineStore('ai', () => {
  // Config
  const mode = ref('frontend') // 'external' | 'internal' | 'frontend'
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
        mode.value = cfg.mode || 'frontend'
        externalApiUrl.value = cfg.externalApiUrl || 'https://api.deepseek.com/v1/chat/completions'
        externalApiKey.value = cfg.externalApiKey || ''
        externalModel.value = cfg.externalModel || 'deepseek-chat'
        internalApiUrl.value = cfg.internalApiUrl || ''
        internalModel.value = cfg.internalModel || ''
        internalApiKey.value = cfg.internalApiKey || ''
      }
    } catch (e) { /* ignore */ }
  }

  // Save config
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

  // Load chat history
  function loadHistory() {
    try {
      const saved = localStorage.getItem(HISTORY_KEY)
      if (saved) messages.value = JSON.parse(saved)
    } catch (e) { /* ignore */ }
  }

  function saveHistory() {
    // Keep last 50 messages
    const toSave = messages.value.slice(-50)
    localStorage.setItem(HISTORY_KEY, JSON.stringify(toSave))
  }

  function clearHistory() {
    messages.value = []
    localStorage.removeItem(HISTORY_KEY)
  }

  // Build system prompt with news context
  function buildSystemPrompt() {
    const newsStore = useNewsStore()
    const recentNews = newsStore.articles.slice(0, 10).map(a =>
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

  // Send message and get AI response
  async function sendMessage(userMessage) {
    messages.value.push({ role: 'user', content: userMessage })
    isLoading.value = true
    saveHistory()

    try {
      let reply = ''

      if (mode.value === 'frontend') {
        reply = frontendSearch(userMessage)
      } else if (mode.value === 'external') {
        reply = await callLLM(externalApiUrl.value, externalApiKey.value, externalModel.value, userMessage)
      } else {
        reply = await callLLM(internalApiUrl.value, internalApiKey.value, internalModel.value, userMessage)
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

  // Frontend-only search mode
  function frontendSearch(query) {
    const newsStore = useNewsStore()
    newsStore.setSearchQuery(query)
    const results = newsStore.searchResults

    if (results.length === 0) {
      // Try keyword matching
      const kwMatch = newsStore.keywords.filter(kw =>
        query.includes(kw) || kw.includes(query)
      )
      if (kwMatch.length > 0) {
        const articles = newsStore.getArticlesForKeywords(kwMatch)
        return formatArticlesAsResponse(articles, `为您找到与"${kwMatch.join('、')}"相关的 ${articles.length} 条资讯：`)
      }
      return `未找到与"${query}"相关的资讯。请尝试使用其他关键词，如：固态电池、磷酸铁锂、储能等。`
    }

    return formatArticlesAsResponse(results.slice(0, 5), `为您找到 ${results.length} 条相关资讯（显示前5条）：`)
  }

  function formatArticlesAsResponse(articles, header) {
    let md = header + '\n\n'
    articles.forEach((a, i) => {
      md += `**${i + 1}. ${a.title}**\n`
      md += `📰 ${a.source} | 📅 ${a.publishedAt} | 🏷️ ${a.keywords.join(', ')}\n`
      md += `${a.summary}\n\n`
    })
    return md
  }

  // Call external/internal LLM API
  async function callLLM(apiUrl, apiKey, model, userMessage) {
    const body = {
      model: model,
      messages: [
        { role: 'system', content: buildSystemPrompt() },
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

  // Auto-save config on change
  watch([mode, externalApiUrl, externalApiKey, externalModel, internalApiUrl, internalModel, internalApiKey], saveConfig)

  return {
    mode, externalApiUrl, externalApiKey, externalModel,
    internalApiUrl, internalModel, internalApiKey,
    messages, isLoading, isOpen,
    sendMessage, clearHistory, saveConfig
  }
})
