<template>
  <section>
    <!-- 筛选项（左侧）+ 条数 + 搜索框（右侧） -->
    <div class="flex items-center flex-wrap gap-3 mb-3">
      <select v-model="selectedSource" class="px-3 py-2 rounded-lg bg-bg-deep border border-border text-sm text-text-secondary focus:outline-none focus:border-primary">
        <option value="">全部来源</option>
        <option v-for="s in store.sources" :key="s" :value="s">{{ s }}</option>
      </select>
      <select v-model="selectedImportance" class="px-3 py-2 rounded-lg bg-bg-deep border border-border text-sm text-text-secondary focus:outline-none focus:border-primary">
        <option value="">全部重要性</option>
        <option value="high">重要</option>
        <option value="medium">关注</option>
        <option value="low">一般</option>
      </select>
      <button v-if="hasFilters" @click="clearFilters" class="px-3 py-2 rounded-lg bg-accent-amber/20 text-accent-amber text-sm hover:bg-accent-amber/30 transition-colors">清除筛选</button>
      <span class="text-xs text-text-muted ml-auto">
        共 <span class="text-primary font-medium">{{ localResults.length }}</span> 条资讯
      </span>
      <div class="relative w-64">
        <input
          v-model="localQuery"
          type="text"
          placeholder="搜索资讯..."
          class="w-full px-4 py-2 pr-9 rounded-lg bg-bg-deep border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-primary transition-colors"
        />
        <button
          v-if="localQuery"
          @click="localQuery = ''"
          class="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-white"
        >✕</button>
        <span
          v-else
          class="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted"
          v-html="icons.search"
        ></span>
      </div>
    </div>

    <!-- 结果列表 -->
    <div class="space-y-3 max-h-[60vh] overflow-y-auto">
      <div
        v-for="article in localResults"
        :key="article.id"
        class="p-4 rounded-lg bg-bg-deep/50 border border-border/50 hover:border-primary/30 transition-all cursor-pointer"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="flex-1">
            <h4 class="text-sm font-medium text-white" v-html="highlight(article.title, localQuery)"></h4>
            <p class="mt-1 text-xs text-text-secondary line-clamp-2" v-html="highlight(article.summary, localQuery)"></p>
          </div>
          <span class="shrink-0 px-2 py-0.5 rounded text-xs" :class="importanceClass(article.importance)">{{ importanceLabel(article.importance) }}</span>
        </div>
        <div class="mt-2 flex items-center gap-2 text-xs text-text-muted">
          <span class="inline-flex items-center gap-1"><span v-html="icons.source"></span>{{ article.source }}</span>
          <span>·</span>
          <span class="inline-flex items-center gap-1"><span v-html="icons.calendar"></span>{{ article.publishedAt }}</span>
          <template v-if="isArticleUrl(article.sourceUrl)">
            <span>·</span>
            <a :href="article.sourceUrl" target="_blank" class="text-primary-light hover:underline">查看原文</a>
          </template>
        </div>
      </div>
    </div>

    <div v-if="localResults.length === 0 && (localQuery || hasFilters)" class="text-center py-12 text-text-muted">
      <div class="text-3xl mb-2">🔍</div>
      <p>未找到匹配的资讯</p>
    </div>
  </section>
</template>

<script setup>
import { ref, computed } from 'vue'
import Fuse from 'fuse.js'
import { useNewsStore } from '../stores/news'
import { icons } from '../assets/icons'

const store = useNewsStore()

const localQuery = ref('')
const selectedSource = ref('')
const selectedImportance = ref('')

const fuse = new Fuse(store.articles, {
  keys: ['title', 'summary', 'source', 'keywords', 'category'],
  threshold: 0.4,
  includeMatches: true
})

const hasFilters = computed(() => selectedSource.value || selectedImportance.value)

const localResults = computed(() => {
  let results = store.articles
  if (localQuery.value.trim()) {
    results = fuse.search(localQuery.value).map(r => r.item)
  }
  if (selectedSource.value) {
    results = results.filter(a => a.source === selectedSource.value)
  }
  if (selectedImportance.value) {
    results = results.filter(a => a.importance === selectedImportance.value)
  }
  return results
})

function clearFilters() {
  selectedSource.value = ''
  selectedImportance.value = ''
}

function highlight(text, q) {
  if (!q?.trim()) return text
  const regex = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
  return text.replace(regex, '<mark class="bg-accent-amber/30 text-accent-amber rounded px-0.5">$1</mark>')
}

function importanceClass(imp) {
  return { high: 'bg-accent-amber/20 text-accent-amber', medium: 'bg-primary/20 text-primary-light', low: 'bg-text-muted/20 text-text-muted' }[imp] || ''
}

function importanceLabel(imp) {
  return { high: '重要', medium: '关注', low: '一般' }[imp] || ''
}

function isArticleUrl(url) {
  if (!url) return false
  try {
    const u = new URL(url)
    return u.pathname.length > 1
  } catch {
    return false
  }
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
