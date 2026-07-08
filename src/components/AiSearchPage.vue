<template>
  <section>
    <!-- 筛选项（左侧）+ 搜索框（右侧） -->
    <div class="flex items-start gap-3 mb-3">
      <!-- 左侧：筛选内容，自动换行 -->
      <div class="flex-1 flex flex-wrap gap-2">
        <button
          v-for="src in rtStore.availableSources"
          :key="src"
          @click="rtStore.toggleSource(src)"
          class="px-3 py-1.5 rounded-lg text-xs transition-all border"
          :class="rtStore.selectedSources.includes(src)
            ? 'bg-primary/20 border-primary text-primary-light'
            : 'bg-bg-deep border-border text-text-muted hover:border-primary/30 hover:text-text-secondary'"
        >{{ src }}</button>
        <button v-if="rtStore.selectedSources.length > 0" @click="rtStore.clearSources()" class="px-3 py-1.5 rounded-lg text-xs text-accent-amber hover:text-accent-amber/80 border border-accent-amber/30">清除</button>
      </div>

      <!-- 右侧：返回数量 + 搜索框 -->
      <div class="flex flex-col items-end gap-2 shrink-0 w-64">
        <div class="flex items-center gap-2">
          <span class="text-xs text-text-muted">返回数量：</span>
          <select v-model.number="rtStore.resultLimit" class="px-2 py-1 rounded-lg bg-bg-deep border border-border text-xs text-text-secondary focus:outline-none focus:border-primary">
            <option :value="3">3 条</option>
            <option :value="5">5 条</option>
            <option :value="10">10 条</option>
            <option :value="15">15 条</option>
          </select>
        </div>
        <div class="flex gap-2 w-full">
          <input
            v-model="rtStore.query"
            @keydown.enter="rtStore.search()"
            type="text"
            placeholder="搜索资讯..."
            class="flex-1 px-4 py-2 rounded-lg bg-bg-deep border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-primary transition-colors"
            :disabled="rtStore.isLoading"
          />
          <button
            @click="rtStore.search()"
            :disabled="!rtStore.query.trim() || rtStore.isLoading"
            class="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-dark disabled:opacity-40 disabled:cursor-not-allowed transition-all shrink-0"
          >
            <span v-if="rtStore.isLoading" class="animate-pulse">...</span>
            <span v-else>🔍</span>
          </button>
        </div>
      </div>
    </div>

    <!-- 错误提示 -->
    <div v-if="rtStore.error" class="mb-3 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">⚠️ {{ rtStore.error }}</div>

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
  </section>
</template>

<script setup>
import { useRealtimeSearchStore } from '../stores/realtimeSearch'

const rtStore = useRealtimeSearchStore()
</script>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
