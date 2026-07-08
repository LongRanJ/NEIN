import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import Fuse from 'fuse.js'
import newsData from '../data/news.json'
import { useTimeFilterStore } from './timeFilter'

export const useNewsStore = defineStore('news', () => {
  const articles = ref(newsData.articles)
  const keywords = ref(newsData.keywords)
  const sources = ref(newsData.sources)
  const lastUpdated = ref(newsData.lastUpdated)
  const activeKeyword = ref(null)
  const searchQuery = ref('')

  // 时间筛选后的文章
  const timeFilteredArticles = computed(() => {
    const tf = useTimeFilterStore()
    return articles.value.filter(a =>
      a.publishedAt >= tf.startDate && a.publishedAt <= tf.endDate
    )
  })

  // Fuse.js instance for fuzzy search
  const fuse = computed(() => new Fuse(articles.value, {
    keys: ['title', 'summary', 'source', 'keywords', 'tags'],
    threshold: 0.4,
    includeScore: true,
    includeMatches: true
  }))

  // Filtered articles by keyword (within time range)
  const keywordFiltered = computed(() => {
    const base = timeFilteredArticles.value
    if (!activeKeyword.value) return base
    return base.filter(a => a.keywords.includes(activeKeyword.value))
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

  // Stats（基于时间筛选后的数据）
  const keywordStats = computed(() => {
    const stats = {}
    const base = timeFilteredArticles.value
    keywords.value.forEach(kw => {
      stats[kw] = base.filter(a => a.keywords.includes(kw)).length
    })
    return stats
  })

  const sourceStats = computed(() => {
    const stats = {}
    const base = timeFilteredArticles.value
    sources.value.forEach(src => {
      stats[src] = base.filter(a => a.source === src).length
    })
    return stats
  })

  const dailyStats = computed(() => {
    const stats = {}
    const base = timeFilteredArticles.value
    base.forEach(a => {
      stats[a.publishedAt] = (stats[a.publishedAt] || 0) + 1
    })
    return Object.entries(stats).sort((a, b) => a[0].localeCompare(b[0]))
  })

  const importanceStats = computed(() => {
    const stats = { high: 0, medium: 0, low: 0 }
    const base = timeFilteredArticles.value
    base.forEach(a => {
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

  function getArticlesForKeywords(kws) {
    if (!kws || kws.length === 0) return articles.value.slice(0, 10)
    return articles.value.filter(a =>
      a.keywords.some(k => kws.includes(k))
    ).slice(0, 15)
  }

  // 去重添加新文章
  function addArticles(newArticles) {
    const existingIds = new Set(articles.value.map(a => a.id))
    let added = 0
    for (const a of newArticles) {
      if (!existingIds.has(a.id)) {
        articles.value.push(a)
        existingIds.add(a.id)
        added++
      }
    }
    return added
  }

  return {
    articles, keywords, sources, lastUpdated,
    activeKeyword, searchQuery,
    timeFilteredArticles, keywordFiltered, searchResults,
    keywordStats, sourceStats, dailyStats, importanceStats,
    setActiveKeyword, setSearchQuery, getArticlesForKeywords, addArticles
  }
})
