<template>
  <section>
    <!-- Tab 切换 -->
    <div class="flex items-center gap-1 mb-6 p-1 rounded-xl bg-bg-deep/50 w-fit">
      <button
        @click="activeTab = 'local'"
        class="px-4 py-2 rounded-lg text-sm font-medium transition-all"
        :class="activeTab === 'local' ? 'bg-primary text-white shadow-lg' : 'text-text-muted hover:text-white'"
      >🔍 本地搜索</button>
      <button
        @click="activeTab = 'ai'"
        class="px-4 py-2 rounded-lg text-sm font-medium transition-all"
        :class="activeTab === 'ai' ? 'bg-primary text-white shadow-lg' : 'text-text-muted hover:text-white'"
      >🤖 AI 实时搜索</button>
    </div>

    <!-- ========== 本地搜索模式 ========== -->
    <div v-if="activeTab === 'local'">
      <div class="flex gap-3 mb-4">
        <div class="flex-1 relative">
          <input
            v-model="localQuery"
            type="text"
            placeholder="搜索资讯标题、摘要、来源、关键词..."
            class="w-full px-4 py-3 rounded-xl bg-bg-deep border border-border text-text-primary placeholder-text-muted focus:outline-none focus:border-primary transition-colors"
          />
          <button v-if="localQuery" @click="localQuery = ''" class="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-white">✕</button>
        </div>
      </div>

      <!-- 筛选器 -->
      <div class="flex flex-wrap gap-3 mb-4">
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
      </div>

      <div class="flex items-center justify-between mb-3">
        <span class="text-sm text-text-muted">
          <template v-if="localQuery || hasFilters">找到 {{ localResults.length }} 条结果</template>
          <template v-else>共 {{ store.articles.length }} 条资讯</template>
        </span>
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
            <span>📰 {{ article.source }}</span>
            <span>·</span>
            <span>📅 {{ article.publishedAt }}</span>
          </div>
        </div>
      </div>

      <div v-if="localResults.length === 0 && (localQuery || hasFilters)" class="text-center py-12 text-text-muted">
        <div class="text-3xl mb-2">🔍</div>
        <p>未找到匹配的资讯</p>
      </div>
    </div>

    <!-- ========== AI 实时搜索模式 ========== -->
    <div v-if="activeTab === 'ai'">
      <p class="text-xs text-text-muted mb-4">通过 AI 联网搜索最新资讯，支持自定义数据源和数量</p>

      <div class="flex gap-3 mb-4">
        <input
          v-model="rtStore.query"
          @keydown.enter="rtStore.search()"
          type="text"
          placeholder="输入关键词，如：固态电池最新进展..."
          class="flex-1 px-4 py-3 rounded-xl bg-bg-deep border border-border text-text-primary placeholder-text-muted focus:outline-none focus:border-primary transition-colors"
          :disabled="rtStore.isLoading"
        />
        <button
          @click="rtStore.search()"
          :disabled="!rtStore.query.trim() || rtStore.isLoading"
          class="px-6 py-3 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary-dark disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          <span v-if="rtStore.isLoading" class="animate-pulse">搜索中...</span>
          <span v-else>🔍 搜索</span>
        </button>
      </div>

      <!-- 数据源选择 -->
      <div class="mb-4">
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs text-text-secondary">数据源偏好（可选）</span>
          <button v-if="rtStore.selectedSources.length > 0" @click="rtStore.clearSources()" class="text-xs text-accent-amber hover:text-accent-amber/80">清除</button>
        </div>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="src in rtStore.availableSources"
            :key="src"
            @click="rtStore.toggleSource(src)"
            class="px-3 py-1.5 rounded-lg text-xs transition-all border"
            :class="rtStore.selectedSources.includes(src)
              ? 'bg-primary/20 border-primary text-primary-light'
              : 'bg-bg-deep border-border text-text-muted hover:border-primary/30 hover:text-text-secondary'"
          >{{ src }}</button>
        </div>
      </div>

      <!-- 数量控制 -->
      <div class="mb-4 flex items-center gap-3">
        <span class="text-xs text-text-secondary">返回数量：</span>
        <select v-model.number="rtStore.resultLimit" class="px-3 py-1.5 rounded-lg bg-bg-deep border border-border text-sm text-text-secondary focus:outline-none focus:border-primary">
          <option :value="3">3 条</option>
          <option :value="5">5 条</option>
          <option :value="10">10 条</option>
          <option :value="15">15 条</option>
        </select>
      </div>

      <!-- 错误提示 -->
      <div v-if="rtStore.error" class="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">⚠️ {{ rtStore.error }}</div>

      <!-- 加载状态 -->
      <div v-if="rtStore.isLoading" class="text-center py-12">
        <div class="inline-flex items-center gap-2 text-text-muted">
          <div class="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
          <span>AI 正在搜索中，请稍候...</span>
        </div>
      </div>

      <!-- 搜索结果 -->
      <div v-if="rtStore.results.length > 0 && !rtStore.isLoading" class="space-y-3 max-h-[60vh] overflow-y-auto">
        <div class="text-sm text-text-muted mb-2">找到 {{ rtStore.results.length }} 条结果</div>
        <div
          v-for="(item, i) in rtStore.results"
          :key="i"
          class="p-4 rounded-lg bg-bg-deep/50 border border-border/50 hover:border-accent-green/30 transition-all"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="flex-1">
              <h4 class="text-sm font-medium text-white">{{ item.title }}</h4>
              <p class="mt-1 text-xs text-text-secondary line-clamp-2">{{ item.summary }}</p>
            </div>
            <span class="shrink-0 px-2 py-0.5 rounded text-xs bg-accent-green/20 text-accent-green">AI 搜索</span>
          </div>
          <div class="mt-2 flex items-center gap-2 text-xs text-text-muted flex-wrap">
            <span>📰 {{ item.source || '未知来源' }}</span>
            <span v-if="item.date">· 📅 {{ item.date }}</span>
            <span v-if="item.url">· <a :href="item.url" target="_blank" class="text-primary-light hover:underline">查看原文</a></span>
          </div>
          <div v-if="item.keywords?.length" class="mt-2 flex flex-wrap gap-1">
            <span v-for="kw in item.keywords" :key="kw" class="px-2 py-0.5 rounded text-xs bg-primary/10 text-primary-light">{{ kw }}</span>
          </div>
        </div>
      </div>

      <div v-if="rtStore.hasSearched && rtStore.results.length === 0 && !rtStore.isLoading && !rtStore.error" class="text-center py-12 text-text-muted">
        <div class="text-3xl mb-2">🔍</div>
        <p>未找到相关结果，请尝试其他关键词</p>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, computed } from 'vue'
import Fuse from 'fuse.js'
import { useNewsStore } from '../stores/news'
import { useRealtimeSearchStore } from '../stores/realtimeSearch'

const store = useNewsStore()
const rtStore = useRealtimeSearchStore()

const activeTab = ref('local')
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
</script>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
