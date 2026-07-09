import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useNewsReportStore = defineStore('newsReport', () => {
  const keyword = ref('')
  const newsList = ref([])
  const selectedIds = ref(new Set())
  const sourceStatus = ref({})
  const isSearching = ref(false)
  const isGenerating = ref(false)
  const error = ref('')
  const hasSearched = ref(false)
  const overview = ref('')
  const suggestedKeywords = ref([])
  const isFixing = ref(false)
  const fixMessage = ref('')

  const selectedItems = computed(() =>
    newsList.value.filter((_, i) => selectedIds.value.has(i))
  )

  const allSelected = computed(() =>
    newsList.value.length > 0 && selectedIds.value.size === newsList.value.length
  )

  // ─── 搜索（SSE） ─────────────────────────────────────

  async function search(kw) {
    const q = (kw || keyword.value).trim()
    if (!q) return

    keyword.value = q
    isSearching.value = true
    error.value = ''
    hasSearched.value = true
    newsList.value = []
    selectedIds.value = new Set()
    sourceStatus.value = {}
    overview.value = ''
    suggestedKeywords.value = []

    try {
      const resp = await fetch('/api/news-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: q })
      })

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}))
        throw new Error(errData.error || `请求失败: ${resp.status}`)
      }

      const data = await resp.json()
      newsList.value = data.data || []
      sourceStatus.value = data.sourceStatus || {}
    } catch (err) {
      error.value = err.message
    } finally {
      isSearching.value = false
    }
  }

  // ─── MIMO 内容增强 ────────────────────────────────────

  async function enhanceContent() {
    if (selectedItems.value.length === 0) return

    const items = selectedItems.value
    const prompt = `你是新能源行业资讯分析助手。以下是一批新闻数据，请为每条新闻生成简洁的 PPT 演示要点。

要求：
1. 为整个报告生成一段 50-100 字的概述导语
2. 为每条新闻生成 2-3 个要点（bullet points），每个要点 15-30 字
3. 只返回 JSON，格式：
{
  "overview": "导语内容",
  "enhanced": [
    { "index": 0, "bullets": ["要点1", "要点2"] }
  ]
}

新闻数据：
${items.map((item, i) => `${i + 1}. [${item.source}] ${item.title}\n   ${item.summary}`).join('\n\n')}`

    try {
      const resp = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: '你是 PPT 内容优化助手。只返回 JSON，不要其他文字。' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.3,
          max_tokens: 3000
        })
      })

      if (!resp.ok) return null
      const data = await resp.json()
      const content = data.content || ''
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (!jsonMatch) return null
      return JSON.parse(jsonMatch[0])
    } catch {
      return null
    }
  }

  // ─── 生成 PPT ─────────────────────────────────────────

  async function generatePpt() {
    if (selectedItems.value.length === 0) {
      error.value = '请先选择要生成PPT的新闻'
      return
    }

    isGenerating.value = true
    error.value = ''

    try {
      // MIMO 内容增强
      const enhanced = await enhanceContent()

      const slides = selectedItems.value.map((item, i) => {
        const enhancedItem = enhanced?.enhanced?.find(e => e.index === i)
        return {
          title: item.title,
          summary: item.summary,
          bullets: enhancedItem?.bullets || [],
          source: item.source,
          url: item.url
        }
      })

      const resp = await fetch('/api/generate-ppt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: keyword.value,
          overview: enhanced?.overview || '',
          slides
        })
      })

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}))
        throw new Error(errData.error || `生成失败: ${resp.status}`)
      }

      // 触发下载
      const blob = await resp.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${keyword.value.replace(/[\\/:*?"<>|]/g, '_')}_新闻简报.pptx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

    } catch (err) {
      error.value = err.message
    } finally {
      isGenerating.value = false
    }
  }

  // ─── 失败源列表 ──────────────────────────────────────

  const failedSources = computed(() => {
    return Object.entries(sourceStatus.value)
      .filter(([, status]) => status === 'timeout' || status === 'error' || status === 'empty')
      .map(([name]) => name)
  })

  // ─── 修正失败源链接 ──────────────────────────────────

  async function fixSources() {
    if (failedSources.value.length === 0) return

    isFixing.value = true
    fixMessage.value = ''
    error.value = ''

    try {
      const resp = await fetch('/api/fix-sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          failedSources: failedSources.value,
          keyword: keyword.value
        })
      })

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}))
        throw new Error(errData.error || `请求失败: ${resp.status}`)
      }

      const data = await resp.json()
      fixMessage.value = data.message || '修正任务已提交'
    } catch (err) {
      error.value = err.message
    } finally {
      isFixing.value = false
    }
  }

  // ─── 选择操作 ─────────────────────────────────────────

  function toggleSelect(index) {
    const newSet = new Set(selectedIds.value)
    if (newSet.has(index)) {
      newSet.delete(index)
    } else {
      newSet.add(index)
    }
    selectedIds.value = newSet
  }

  function toggleSelectAll() {
    if (allSelected.value) {
      selectedIds.value = new Set()
    } else {
      selectedIds.value = new Set(newsList.value.map((_, i) => i))
    }
  }

  function selectAll() {
    selectedIds.value = new Set(newsList.value.map((_, i) => i))
  }

  function clearSelect() {
    selectedIds.value = new Set()
  }

  function reset() {
    keyword.value = ''
    newsList.value = []
    selectedIds.value = new Set()
    sourceStatus.value = {}
    isSearching.value = false
    isGenerating.value = false
    error.value = ''
    hasSearched.value = false
    overview.value = ''
    suggestedKeywords.value = []
  }

  return {
    keyword, newsList, selectedIds, sourceStatus,
    isSearching, isGenerating, error, hasSearched,
    overview, suggestedKeywords,
    isFixing, fixMessage, failedSources,
    selectedItems, allSelected,
    search, generatePpt, fixSources,
    toggleSelect, toggleSelectAll, selectAll, clearSelect, reset
  }
})
