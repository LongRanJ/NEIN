<template>
  <section>
    <!-- 搜索栏 -->
    <div class="flex items-center gap-3 mb-4">
      <div class="relative flex-1 max-w-xl">
        <input
          v-model="store.keyword"
          @keydown.enter="store.search()"
          type="text"
          placeholder="输入关键词搜索 15 个新闻源..."
          class="w-full px-4 py-2.5 pr-10 rounded-lg bg-bg-deep border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-primary transition-colors"
          :disabled="store.isSearching"
        />
        <button
          @click="store.search()"
          :disabled="!store.keyword.trim() || store.isSearching"
          class="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          v-html="icons.search"
        ></button>
      </div>
      <button
        @click="store.search()"
        :disabled="!store.keyword.trim() || store.isSearching"
        class="px-5 py-2.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-dark disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2"
      >
        <span v-if="store.isSearching" class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
        <span>{{ store.isSearching ? '搜索中...' : '搜索' }}</span>
      </button>
      <button
        @click="store.generatePpt()"
        :disabled="store.selectedItems.length === 0 || store.isGenerating"
        class="px-5 py-2.5 rounded-lg bg-accent-green text-white text-sm font-medium hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2"
      >
        <span v-if="store.isGenerating" class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
        <span>{{ store.isGenerating ? '生成中...' : `生成 PPT${store.selectedItems.length > 0 ? ` (${store.selectedItems.length})` : ''}` }}</span>
      </button>
    </div>

    <!-- 错误提示 -->
    <div v-if="store.error" class="mb-3 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center justify-between">
      <span>⚠️ {{ store.error }}</span>
      <button @click="store.error = ''" class="text-red-400 hover:text-red-300" v-html="icons.close"></button>
    </div>

    <!-- 实时进度（搜索中时显示） -->
    <div v-if="store.isSearching" class="mb-4 p-4 rounded-lg bg-bg-deep/80 border border-border">
      <div class="flex items-center gap-2 mb-3">
        <div class="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
        <span class="text-sm text-text-secondary">正在搜索 15 个新闻源...</span>
      </div>
      <div class="grid grid-cols-3 sm:grid-cols-5 gap-2">
        <div
          v-for="src in allSources"
          :key="src"
          class="flex items-center gap-1.5 px-2 py-1 rounded text-xs"
          :class="sourceClass(src)"
        >
          <span>{{ sourceIcon(src) }}</span>
          <span class="truncate">{{ src }}</span>
        </div>
      </div>
    </div>

    <!-- 搜索结果 -->
    <div v-if="store.hasSearched && !store.isSearching && store.newsList.length > 0" class="flex gap-4">
      <!-- 左栏：结果列表 -->
      <div class="flex-1 min-w-0">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-3">
            <span class="text-sm text-text-muted">
              找到 <span class="text-primary font-medium">{{ store.newsList.length }}</span> 条结果
            </span>
            <button
              @click="store.toggleSelectAll()"
              class="px-2 py-1 rounded text-xs border transition-all"
              :class="store.allSelected
                ? 'bg-primary/20 border-primary text-primary-light'
                : 'border-border text-text-muted hover:border-primary/30 hover:text-text-secondary'"
            >
              {{ store.allSelected ? '取消全选' : '全选' }}
            </button>
            <button
              v-if="store.selectedIds.size > 0"
              @click="store.clearSelect()"
              class="px-2 py-1 rounded text-xs text-accent-amber border border-accent-amber/30 hover:bg-accent-amber/10 transition-all"
            >清除选择</button>
          </div>
        </div>

        <div class="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
          <div
            v-for="(item, i) in store.newsList"
            :key="i"
            @click="store.toggleSelect(i)"
            class="p-3 rounded-lg border transition-all cursor-pointer"
            :class="store.selectedIds.has(i)
              ? 'bg-primary/5 border-primary/40'
              : 'bg-bg-deep/50 border-border/50 hover:border-primary/20'"
          >
            <div class="flex items-start gap-3">
              <!-- 勾选框 -->
              <div
                class="mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all"
                :class="store.selectedIds.has(i)
                  ? 'bg-primary border-primary'
                  : 'border-text-muted'"
              >
                <svg v-if="store.selectedIds.has(i)" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
              </div>
              <div class="flex-1 min-w-0">
                <h4 class="text-sm font-medium text-white leading-snug">{{ item.title }}</h4>
                <p class="mt-1 text-xs text-text-secondary line-clamp-2">{{ item.summary }}</p>
                <div class="mt-1.5 flex items-center gap-2 text-xs text-text-muted flex-wrap">
                  <span class="inline-flex items-center gap-1"><span v-html="icons.source"></span>{{ item.source || '未知来源' }}</span>
                  <span v-if="item.date">· {{ item.date }}</span>
                  <span v-if="item.url">· <a :href="item.url" target="_blank" @click.stop class="text-primary-light hover:underline">原文</a></span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 右栏：报告预览 -->
      <div class="w-80 shrink-0 hidden lg:block">
        <div class="sticky top-28">
          <h4 class="text-sm font-medium text-text-secondary mb-3">📊 报告预览</h4>
          <div class="p-4 rounded-xl bg-bg-deep border border-border space-y-3">
            <!-- 封面预览 -->
            <div class="p-3 rounded-lg bg-gradient-to-br from-[#1a3a5c] to-[#2d5f8a]">
              <h5 class="text-sm font-bold text-white">{{ store.keyword }} - 新闻简报</h5>
              <p class="text-xs text-white/50 mt-1">{{ today }}</p>
            </div>

            <!-- 概述 -->
            <div v-if="store.overview" class="text-xs text-text-secondary leading-relaxed">
              <span class="text-primary font-medium">概述：</span>{{ store.overview }}
            </div>

            <!-- 选中条目列表 -->
            <div class="space-y-2">
              <div
                v-for="item in store.selectedItems.slice(0, 5)"
                :key="item.title"
                class="p-2 rounded bg-bg-card/50 border border-border/30"
              >
                <p class="text-xs text-white leading-snug line-clamp-1">{{ item.title }}</p>
                <p class="text-xs text-text-muted mt-0.5">{{ item.source }}</p>
              </div>
              <div v-if="store.selectedItems.length > 5" class="text-xs text-text-muted text-center">
                ... 还有 {{ store.selectedItems.length - 5 }} 条
              </div>
            </div>

            <!-- 生成按钮 -->
            <button
              @click="store.generatePpt()"
              :disabled="store.selectedItems.length === 0 || store.isGenerating"
              class="w-full mt-2 px-3 py-2 rounded-lg bg-accent-green text-white text-xs font-medium hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {{ store.isGenerating ? '生成中...' : '下载 PPT' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-if="store.hasSearched && !store.isSearching && store.newsList.length === 0 && !store.error" class="text-center py-16 text-text-muted">
      <div class="text-4xl mb-3">🔍</div>
      <p class="text-sm">未找到相关结果，请尝试其他关键词</p>
    </div>

    <!-- 初始状态 -->
    <div v-if="!store.hasSearched" class="text-center py-16">
      <div class="text-4xl mb-3">📰</div>
      <p class="text-sm text-text-secondary">输入关键词，从 15 个主流新闻源搜索资讯并生成 PPT</p>
      <div class="mt-4 flex flex-wrap justify-center gap-2">
        <button
          v-for="q in quickQuestions"
          :key="q"
          @click="store.keyword = q; store.search()"
          class="px-3 py-1.5 rounded-lg bg-bg-deep border border-border/50 text-xs text-text-secondary hover:border-primary/30 hover:text-primary-light transition-all"
        >{{ q }}</button>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { useNewsReportStore } from '../stores/newsReport'
import { icons } from '../assets/icons'

const store = useNewsReportStore()

const today = new Date().toISOString().split('T')[0]

const quickQuestions = [
  '固态电池最新进展',
  '锂电池安全事故',
  '储能行业政策',
  '新能源汽车补贴'
]

// 15 个源名称
const allSources = [
  '新浪新闻', '腾讯新闻', '搜狐新闻', '网易新闻', '凤凰网',
  '央视新闻', '环球网', '新华网', '人民网', '观察者网',
  '澎湃新闻', '中国新闻网', '参考消息', '百度新闻', '今日头条'
]

function sourceClass(src) {
  const status = store.sourceStatus[src]
  if (status === 'success') return 'bg-accent-green/10 text-accent-green border border-accent-green/20'
  if (status === 'timeout') return 'bg-accent-amber/10 text-accent-amber border border-accent-amber/20'
  if (status === 'error' || status === 'empty') return 'bg-red-500/10 text-red-400 border border-red-500/20'
  if (status === 'llm_fallback') return 'bg-primary/10 text-primary-light border border-primary/20'
  return 'text-text-muted border border-border/30'
}

function sourceIcon(src) {
  const status = store.sourceStatus[src]
  if (status === 'success') return '✅'
  if (status === 'timeout') return '⏳'
  if (status === 'error' || status === 'empty') return '❌'
  if (status === 'llm_fallback') return '🔧'
  return '⏳'
}
</script>

<style scoped>
.line-clamp-1 {
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
