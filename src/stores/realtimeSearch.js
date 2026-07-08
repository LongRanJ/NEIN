import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useRealtimeSearchStore = defineStore('realtimeSearch', () => {
  const query = ref('')
  const selectedSources = ref([])
  const resultLimit = ref(5)
  const results = ref([])
  const isLoading = ref(false)
  const error = ref('')
  const hasSearched = ref(false)

  // 可选数据源
  const availableSources = [
    '36氪', '第一财经', '界面新闻', '财联社',
    'OFweek', '高工锂电', '汽车之家', '电车通',
    '北极星储能网', '能源杂志'
  ]

  async function search() {
    if (!query.value.trim()) return

    isLoading.value = true
    error.value = ''
    hasSearched.value = true

    try {
      const resp = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: query.value.trim(),
          sources: selectedSources.value,
          limit: resultLimit.value
        })
      })

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}))
        throw new Error(errData.error || `请求失败: ${resp.status}`)
      }

      const data = await resp.json()
      results.value = data.results || []
    } catch (err) {
      error.value = err.message
      results.value = []
    } finally {
      isLoading.value = false
    }
  }

  function clearResults() {
    query.value = ''
    results.value = []
    error.value = ''
    hasSearched.value = false
  }

  function toggleSource(source) {
    const idx = selectedSources.value.indexOf(source)
    if (idx >= 0) {
      selectedSources.value.splice(idx, 1)
    } else {
      selectedSources.value.push(source)
    }
  }

  function clearSources() {
    selectedSources.value = []
  }

  return {
    query, selectedSources, resultLimit,
    results, isLoading, error, hasSearched,
    availableSources,
    search, clearResults, toggleSource, clearSources
  }
})
