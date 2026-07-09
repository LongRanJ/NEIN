import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

// 目标来源网站
const TARGET_SOURCES = [
  '中国能源网', '北极星储能网', '电动汽车网', '盖世汽车网', '第一电动网',
  'OFWeek锂电网', '高工氢电网', '中国储能网', '索比储能网', '国际能源网',
  '北极星电池网', '新能源网', '电池网', '百度新闻', 'Bing新闻'
]

export const useNewsReportStore = defineStore('newsReport', () => {
  const keyword = ref('')
  const newsList = ref([])
  const selectedIds = ref(new Set())
  const isSearching = ref(false)
  const isGenerating = ref(false)
  const error = ref('')
  const hasSearched = ref(false)
  const overview = ref('')

  // 来源筛选
  const availableSources = TARGET_SOURCES
  const selectedSources = ref([...TARGET_SOURCES])

  // 时间范围
  const timeRange = ref('all')
  const timeRangeOptions = [
    { value: 'all', label: '全部' },
    { value: 'day', label: '今天' },
    { value: 'week', label: '近7天' },
    { value: 'month', label: '近30天' }
  ]

  // 修正相关
  const isFixing = ref(false)
  const fixMessage = ref('')

  const selectedItems = computed(() =>
    newsList.value.filter((_, i) => selectedIds.value.has(i))
  )

  const allSelected = computed(() =>
    newsList.value.length > 0 && selectedIds.value.size === newsList.value.length
  )

  const failedSources = computed(() =>
    selectedSources.value.filter(s =>
      !newsList.value.some(n => n.source === s)
    )
  )

  // ─── 来源操作 ─────────────────────────────────────────

  function toggleSource(src) {
    const idx = selectedSources.value.indexOf(src)
    if (idx >= 0) {
      selectedSources.value.splice(idx, 1)
    } else {
      selectedSources.value.push(src)
    }
  }

  function selectAllSources() {
    selectedSources.value = [...availableSources]
  }

  function clearSources() {
    selectedSources.value = []
  }

  // ─── 搜索 ────────────────────────────────────────────

  async function search(kw) {
    const q = (kw || keyword.value).trim()
    if (!q) return
    if (selectedSources.value.length === 0) {
      error.value = '请至少选择一个来源'
      return
    }

    keyword.value = q
    isSearching.value = true
    error.value = ''
    hasSearched.value = true
    newsList.value = []
    selectedIds.value = new Set()
    overview.value = ''

    try {
      const resp = await fetch('/api/news-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: q,
          sources: selectedSources.value,
          timeRange: timeRange.value
        })
      })

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}))
        throw new Error(errData.error || `请求失败: ${resp.status}`)
      }

      const data = await resp.json()
      newsList.value = data.data || []
      overview.value = data.overview || ''
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
    const prompt = `你是新能源行业资讯分析助手。为以下新闻生成PPT演示要点。

要求：
1. 生成50-100字的报告概述
2. 每条新闻生成2-3个要点（15-30字/条）
3. 只返回JSON：{"overview":"概述","enhanced":[{"index":0,"bullets":["要点1","要点2"]}]}

新闻：
${items.map((item, i) => `${i+1}. [${item.source}] ${item.title}\n   ${item.summary}`).join('\n\n')}`

    try {
      const resp = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: '只返回JSON。' },
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

  // ─── 选择操作 ─────────────────────────────────────────

  function toggleSelect(index) {
    const newSet = new Set(selectedIds.value)
    if (newSet.has(index)) newSet.delete(index)
    else newSet.add(index)
    selectedIds.value = newSet
  }

  function toggleSelectAll() {
    if (allSelected.value) selectedIds.value = new Set()
    else selectedIds.value = new Set(newsList.value.map((_, i) => i))
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
    isSearching.value = false
    isGenerating.value = false
    error.value = ''
    hasSearched.value = false
    overview.value = ''
  }

  return {
    keyword, newsList, selectedIds,
    isSearching, isGenerating, error, hasSearched, overview,
    availableSources, selectedSources, timeRange, timeRangeOptions,
    isFixing, fixMessage, failedSources,
    selectedItems, allSelected,
    toggleSource, selectAllSources, clearSources,
    search, generatePpt, fixSources: async () => {},
    toggleSelect, toggleSelectAll, selectAll, clearSelect, reset
  }
})
