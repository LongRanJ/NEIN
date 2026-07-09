import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

const TARGET_SOURCES = [
  '中国能源网', '北极星储能网', '电动汽车网', '盖世汽车网', '第一电动网',
  'OFWeek锂电网', '高工氢电网', '中国储能网', '索比储能网', '国际能源网',
  '北极星电池网', '新能源网', '电池网', '百度新闻', 'Bing新闻'
]

function fmtDate(d) {
  return d.toISOString().split('T')[0]
}

export const useNewsReportStore = defineStore('newsReport', () => {
  const keyword = ref('')
  const rawData = ref([])          // API 原始返回
  const selectedIds = ref(new Set())
  const isSearching = ref(false)
  const isGenerating = ref(false)
  const error = ref('')
  const hasSearched = ref(false)
  const overview = ref('')

  // 来源选择（默认全选15个目标源）
  const availableSources = TARGET_SOURCES
  const selectedSources = ref([...TARGET_SOURCES])
  const showSourceDropdown = ref(false)

  // 时间范围
  const startDate = ref('')
  const endDate = ref('')
  const activePreset = ref(null)

  const presets = [
    { label: '今天', days: 0 },
    { label: '近3天', days: 3 },
    { label: '近7天', days: 7 },
    { label: '近30天', days: 30 }
  ]

  // 过滤后的结果
  const newsList = computed(() => {
    let list = rawData.value

    // 来源过滤
    if (selectedSources.value.length > 0) {
      list = list.filter(item => selectedSources.value.includes(item.source))
    }

    // 时间过滤
    if (startDate.value) {
      list = list.filter(item => item.date >= startDate.value)
    }
    if (endDate.value) {
      list = list.filter(item => item.date <= endDate.value)
    }

    return list
  })

  const selectedItems = computed(() =>
    newsList.value.filter((_, i) => selectedIds.value.has(i))
  )

  const allSelected = computed(() =>
    newsList.value.length > 0 && selectedIds.value.size === newsList.value.length
  )

  // 统计实际出现的来源
  const resultSources = computed(() => {
    const set = new Set(rawData.value.map(n => n.source))
    return [...set]
  })

  // ─── 时间预设 ─────────────────────────────────────────

  function setPreset(days) {
    activePreset.value = days
    const now = new Date()
    endDate.value = fmtDate(now)
    if (days === 0) {
      startDate.value = fmtDate(now)
    } else {
      const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
      startDate.value = fmtDate(start)
    }
  }

  function setDateRange(start, end) {
    startDate.value = start
    endDate.value = end
    activePreset.value = null
  }

  function clearDateRange() {
    startDate.value = ''
    endDate.value = ''
    activePreset.value = null
  }

  // ─── 来源操作 ─────────────────────────────────────────

  function toggleSource(src) {
    const idx = selectedSources.value.indexOf(src)
    if (idx >= 0) selectedSources.value.splice(idx, 1)
    else selectedSources.value.push(src)
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

    keyword.value = q
    isSearching.value = true
    error.value = ''
    hasSearched.value = true
    rawData.value = []
    selectedIds.value = new Set()
    overview.value = ''

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
      rawData.value = data.data || []
      overview.value = data.overview || ''
    } catch (err) {
      error.value = err.message
    } finally {
      isSearching.value = false
    }
  }

  // ─── PPT ──────────────────────────────────────────────

  async function enhanceContent() {
    if (selectedItems.value.length === 0) return null
    const items = selectedItems.value
    const prompt = `为以下新闻生成PPT要点。返回JSON：{"overview":"50字概述","enhanced":[{"index":0,"bullets":["要点1","要点2"]}]}
新闻：
${items.map((item, i) => `${i+1}. [${item.source}] ${item.title} - ${item.summary}`).join('\n')}`
    try {
      const resp = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'system', content: '只返回JSON。' }, { role: 'user', content: prompt }],
          temperature: 0.3, max_tokens: 3000
        })
      })
      if (!resp.ok) return null
      const data = await resp.json()
      const m = (data.content || '').match(/\{[\s\S]*\}/)
      return m ? JSON.parse(m[0]) : null
    } catch { return null }
  }

  async function generatePpt() {
    if (selectedItems.value.length === 0) { error.value = '请先选择新闻'; return }
    isGenerating.value = true
    error.value = ''
    try {
      const enhanced = await enhanceContent()
      const slides = selectedItems.value.map((item, i) => ({
        title: item.title, summary: item.summary,
        bullets: enhanced?.enhanced?.find(e => e.index === i)?.bullets || [],
        source: item.source, url: item.url
      }))
      const resp = await fetch('/api/generate-ppt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: keyword.value, overview: enhanced?.overview || '', slides })
      })
      if (!resp.ok) { const e = await resp.json().catch(() => ({})); throw new Error(e.error || '生成失败') }
      const blob = await resp.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${keyword.value.replace(/[\\/:*?"<>|]/g, '_')}_新闻简报.pptx`
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) { error.value = err.message }
    finally { isGenerating.value = false }
  }

  // ─── 选择 ────────────────────────────────────────────

  function toggleSelect(i) {
    const s = new Set(selectedIds.value)
    s.has(i) ? s.delete(i) : s.add(i)
    selectedIds.value = s
  }
  function toggleSelectAll() {
    selectedIds.value = allSelected.value ? new Set() : new Set(newsList.value.map((_, i) => i))
  }
  function clearSelect() { selectedIds.value = new Set() }

  function reset() {
    keyword.value = ''; rawData.value = []; selectedIds.value = new Set()
    isSearching.value = false; isGenerating.value = false
    error.value = ''; hasSearched.value = false; overview.value = ''
  }

  return {
    keyword, rawData, newsList, selectedIds,
    isSearching, isGenerating, error, hasSearched, overview,
    availableSources, selectedSources, showSourceDropdown,
    startDate, endDate, activePreset, presets,
    selectedItems, allSelected, resultSources,
    setPreset, setDateRange, clearDateRange,
    toggleSource, selectAllSources, clearSources,
    search, generatePpt,
    toggleSelect, toggleSelectAll, clearSelect, reset
  }
})
