import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { useNewsStore } from './news'
import { useTimeFilterStore } from './timeFilter'
import { useRealtimeSearchStore } from './realtimeSearch'

const HISTORY_KEY = 'nein_ai_history'

export const useAiStore = defineStore('ai', () => {
  // Chat state
  const messages = ref([])
  const isLoading = ref(false)
  const isOpen = ref(false)

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

  // 构建 system prompt
  function buildSystemPrompt() {
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

  async function sendMessage(userMessage) {
    messages.value.push({ role: 'user', content: userMessage })
    isLoading.value = true
    saveHistory()

    try {
      const apiMessages = [
        { role: 'system', content: buildSystemPrompt() },
        ...messages.value.slice(-10)
      ]

      const resp = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: apiMessages,
          model: 'mimo-v2.5-pro',
          temperature: 0.7,
          max_tokens: 2000
        })
      })

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}))
        throw new Error(errData.error || `请求失败: ${resp.status}`)
      }

      const data = await resp.json()
      const reply = data.content || '未收到有效回复'

      messages.value.push({ role: 'assistant', content: reply })
    } catch (err) {
      messages.value.push({
        role: 'assistant',
        content: `⚠️ 请求失败：${err.message}\n\n请检查后端 API 配置是否正确。`
      })
    } finally {
      isLoading.value = false
      saveHistory()
    }
  }

  // Init
  loadHistory()

  return {
    messages, isLoading, isOpen,
    sendMessage, clearHistory
  }
})
