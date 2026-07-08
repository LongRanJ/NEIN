<template>
  <section id="search" class="glass rounded-2xl p-6">
    <h3 class="text-lg font-semibold text-white mb-4">🔍 资讯检索</h3>

    <!-- Search input -->
    <div class="flex gap-3 mb-4">
      <div class="flex-1 relative">
        <input
          v-model="query"
          @input="onSearch"
          type="text"
          placeholder="搜索资讯标题、摘要、来源、关键词..."
          class="w-full px-4 py-3 rounded-xl bg-bg-deep border border-border text-text-primary placeholder-text-muted focus:outline-none focus:border-primary transition-colors"
        />
        <button
          v-if="query"
          @click="clearSearch"
          class="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-white"
        >✕</button>
      </div>
    </div>

    <!-- Filters -->
    <div class="flex flex-wrap gap-3 mb-4">
      <!-- Source filter -->
      <select
        v-model="selectedSource"
        @change="onSearch"
        class="px-3 py-2 rounded-lg bg-bg-deep border border-border text-sm text-text-secondary focus:outline-none focus:border-primary"
      >
        <option value="">全部来源</option>
        <option v-for="s in store.sources" :key="s" :value="s">{{ s }}</option>
      </select>

      <!-- Date filter -->
      <select
        v-model="selectedDate"
        @change="onSearch"
        class="px-3 py-2 rounded-lg bg-bg-deep border border-border text-sm text-text-secondary focus:outline-none focus:border-primary"
      >
        <option value="">全部时间</option>
        <option value="3">最近3天</option>
        <option value="7">最近7天</option>
        <option value="14">最近14天</option>
      </select>

      <!-- Importance filter -->
      <select
        v-model="selectedImportance"
        @change="onSearch"
        class="px-3 py-2 rounded-lg bg-bg-deep border border-border text-sm text-text-secondary focus:outline-none focus:border-primary"
      >
        <option value="">全部重要性</option>
        <option value="high">重要</option>
        <option value="medium">关注</option>
        <option value="low">一般</option>
      </select>

      <button
        v-if="hasFilters"
        @click="clearFilters"
        class="px-3 py-2 rounded-lg bg-accent-amber/20 text-accent-amber text-sm hover:bg-accent-amber/30 transition-colors"
      >
        清除筛选
      </button>
    </div>

    <!-- Results count -->
    <div class="flex items-center justify-between mb-3">
      <span class="text-sm text-text-muted">
        <template v-if="query || hasFilters">
          找到 {{ filteredResults.length }} 条结果
        </template>
        <template v-else>
          共 {{ store.articles.length }} 条资讯
        </template>
      </span>
    </div>

    <!-- Results -->
    <div class="space-y-3 max-h-96 overflow-y-auto">
      <div
        v-for="article in filteredResults"
        :key="article.id"
        class="p-4 rounded-lg bg-bg-deep/50 border border-border/50 hover:border-primary/30 transition-all cursor-pointer"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="flex-1">
            <h4 class="text-sm font-medium text-white" v-html="highlight(article.title)"></h4>
            <p class="mt-1 text-xs text-text-secondary line-clamp-2" v-html="highlight(article.summary)"></p>
          </div>
          <span
            class="shrink-0 px-2 py-0.5 rounded text-xs"
            :class="importanceClass(article.importance)"
          >{{ importanceLabel(article.importance) }}</span>
        </div>
        <div class="mt-2 flex items-center gap-2 text-xs text-text-muted">
          <span>📰 {{ article.source }}</span>
          <span>·</span>
          <span>📅 {{ article.publishedAt }}</span>
          <span>·</span>
          <span v-for="kw in article.keywords" :key="kw" class="text-primary-light">{{ kw }} </span>
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div v-if="filteredResults.length === 0 && (query || hasFilters)" class="text-center py-8 text-text-muted">
      <div class="text-3xl mb-2">🔍</div>
      <p>未找到匹配的资讯</p>
      <p class="text-xs mt-1">请尝试其他关键词或筛选条件</p>
    </div>
  </section>
</template>

<script setup>
import { ref, computed } from 'vue'
import Fuse from 'fuse.js'
import { useNewsStore } from '../stores/news'

const store = useNewsStore()

const query = ref('')
const selectedSource = ref('')
const selectedDate = ref('')
const selectedImportance = ref('')

const fuse = new Fuse(store.articles, {
  keys: ['title', 'summary', 'source', 'keywords', 'category'],
  threshold: 0.4,
  includeMatches: true
})

const hasFilters = computed(() => selectedSource.value || selectedDate.value || selectedImportance.value)

const filteredResults = computed(() => {
  let results = store.articles

  // Text search
  if (query.value.trim()) {
    results = fuse.search(query.value).map(r => r.item)
  }

  // Source filter
  if (selectedSource.value) {
    results = results.filter(a => a.source === selectedSource.value)
  }

  // Date filter
  if (selectedDate.value) {
    const days = parseInt(selectedDate.value)
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)
    const cutoffStr = cutoff.toISOString().split('T')[0]
    results = results.filter(a => a.publishedAt >= cutoffStr)
  }

  // Importance filter
  if (selectedImportance.value) {
    results = results.filter(a => a.importance === selectedImportance.value)
  }

  return results
})

function onSearch() {
  // Reactivity handles it
}

function clearSearch() {
  query.value = ''
}

function clearFilters() {
  selectedSource.value = ''
  selectedDate.value = ''
  selectedImportance.value = ''
}

function highlight(text) {
  if (!query.value.trim()) return text
  const regex = new RegExp(`(${query.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
  return text.replace(regex, '<mark class="bg-accent-amber/30 text-accent-amber rounded px-0.5">$1</mark>')
}

function importanceClass(imp) {
  return { high: 'bg-accent-amber/20 text-accent-amber', medium: 'bg-primary/20 text-primary-light', low: 'bg-text-muted/20 text-text-muted' }[imp] || ''
}

function importanceLabel(imp) {
  return { high: '重要', medium: '关注', low: '一般' }[imp] || ''
}
</script>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
