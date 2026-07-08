import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import Fuse from 'fuse.js'
import newsData from '../data/news.json'

export const useNewsStore = defineStore('news', () => {
  const articles = ref(newsData.articles)
  const keywords = ref(newsData.keywords)
  const sources = ref(newsData.sources)
  const lastUpdated = ref(newsData.lastUpdated)
  const activeKeyword = ref(null)
  const searchQuery = ref('')

  // Fuse.js instance for fuzzy search
  const fuse = computed(() => new Fuse(articles.value, {
    keys: ['title', 'summary', 'source', 'keywords'],
    threshold: 0.4,
    includeScore: true,
    includeMatches: true
  }))

  // Filtered articles by keyword
  const keywordFiltered = computed(() => {
    if (!activeKeyword.value) return articles.value
    return articles.value.filter(a => a.keywords.includes(activeKeyword.value))
  })

  // Search results
  const searchResults = computed(() => {
    if (!searchQuery.value.trim()) return []
    return fuse.value.search(searchQuery.value).map(r => ({
      ...r.item,
      score: r.score,
      matches: r.matches
    }))
  })

  // Stats
  const keywordStats = computed(() => {
    const stats = {}
    keywords.value.forEach(kw => {
      stats[kw] = articles.value.filter(a => a.keywords.includes(kw)).length
    })
    return stats
  })

  const sourceStats = computed(() => {
    const stats = {}
    sources.value.forEach(src => {
      stats[src] = articles.value.filter(a => a.source === src).length
    })
    return stats
  })

  const dailyStats = computed(() => {
    const stats = {}
    articles.value.forEach(a => {
      stats[a.publishedAt] = (stats[a.publishedAt] || 0) + 1
    })
    return Object.entries(stats).sort((a, b) => a[0].localeCompare(b[0]))
  })

  const importanceStats = computed(() => {
    const stats = { high: 0, medium: 0, low: 0 }
    articles.value.forEach(a => {
      stats[a.importance] = (stats[a.importance] || 0) + 1
    })
    return stats
  })

  // Actions
  function setActiveKeyword(kw) {
    activeKeyword.value = activeKeyword.value === kw ? null : kw
    searchQuery.value = ''
  }

  function setSearchQuery(q) {
    searchQuery.value = q
    activeKeyword.value = null
  }

  // Get articles for AI context
  function getArticlesForKeywords(kws) {
    if (!kws || kws.length === 0) return articles.value.slice(0, 10)
    return articles.value.filter(a =>
      a.keywords.some(k => kws.includes(k))
    ).slice(0, 15)
  }

  return {
    articles, keywords, sources, lastUpdated,
    activeKeyword, searchQuery,
    keywordFiltered, searchResults,
    keywordStats, sourceStats, dailyStats, importanceStats,
    setActiveKeyword, setSearchQuery, getArticlesForKeywords
  }
})
