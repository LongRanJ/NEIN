<template>
  <section>
    <!-- 顶部筛选栏 -->
    <div class="flex items-center gap-3 mb-3">
      <!-- 来源下拉多选 -->
      <div class="relative">
        <button
          @click="store.showSourceDropdown = !store.showSourceDropdown"
          class="flex items-center gap-2 px-3 py-2 rounded-lg bg-bg-deep border border-border text-sm text-text-secondary hover:border-primary/30 transition-all"
        >
          <span>来源 ({{ store.selectedSources.length }}/{{ store.availableSources.length }})</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
        </button>
        <!-- 下拉面板 -->
        <div
          v-if="store.showSourceDropdown"
          class="absolute top-full left-0 mt-1 z-50 w-64 max-h-72 overflow-y-auto rounded-lg bg-bg-deep border border-border shadow-xl"
        >
          <div class="p-2 border-b border-border flex items-center justify-between">
            <button @click="store.selectAllSources()" class="text-xs text-primary-light hover:underline">全选</button>
            <button @click="store.clearSources()" class="text-xs text-accent-amber hover:underline">清空</button>
          </div>
          <div class="p-1">
            <label
              v-for="src in store.availableSources"
              :key="src"
              class="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-bg-card cursor-pointer transition-colors"
            >
              <input
                type="checkbox"
                :checked="store.selectedSources.includes(src)"
                @change="store.toggleSource(src)"
                class="accent-primary w-3.5 h-3.5"
              />
              <span class="text-xs text-text-secondary">{{ src }}</span>
              <span v-if="store.resultSources.includes(src)" class="ml-auto w-1.5 h-1.5 rounded-full bg-accent-green" title="有搜索结果"></span>
            </label>
          </div>
        </div>
      </div>

      <!-- 时间范围（参考头部样式） -->
      <div class="flex items-center gap-1">
        <button
          v-for="p in store.presets"
          :key="p.days"
          @click="store.setPreset(p.days)"
          class="px-2.5 py-1 rounded text-xs transition-all"
          :class="store.activePreset === p.days ? 'bg-primary text-white' : 'text-text-muted hover:text-white hover:bg-bg-card'"
        >{{ p.label }}</button>
      </div>

      <div class="flex items-center gap-1.5 bg-bg-deep rounded-lg border border-border px-2 py-1">
        <input
          type="date"
          :value="store.startDate"
          @change="store.setDateRange($event.target.value, store.endDate)"
          class="bg-transparent text-xs text-text-primary focus:outline-none w-24 date-input"
        />
        <span class="text-xs text-text-muted">~</span>
        <input
          type="date"
          :value="store.endDate"
          @change="store.setDateRange(store.startDate, $event.target.value)"
          class="bg-transparent text-xs text-text-primary focus:outline-none w-24 date-input"
        />
      </div>

      <button
        v-if="store.startDate || store.endDate"
        @click="store.clearDateRange()"
        class="text-xs text-accent-amber hover:text-accent-amber/80 transition-colors"
      >清除</button>

      <!-- 右侧：搜索框 + PPT按钮 -->
      <div class="flex items-center gap-2 ml-auto">
        <span class="text-xs text-text-muted">
          <span class="text-primary font-medium">{{ store.newsList.length }}</span> 条
        </span>
        <div class="relative w-64">
          <input
            v-model="store.keyword"
            @keydown.enter="store.search()"
            type="text"
            placeholder="搜索资讯..."
            class="w-full px-4 py-2 pr-9 rounded-lg bg-bg-deep border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-primary transition-colors"
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
          @click="store.generatePpt()"
          :disabled="store.selectedItems.length === 0 || store.isGenerating"
          class="px-3 py-2 rounded-lg bg-sky-500 text-white text-sm hover:bg-sky-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1.5"
        >
          <span v-if="store.isGenerating" class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
          <span v-html="icons.report"></span>
          <span>{{ store.isGenerating ? '生成中...' : 'PPT' }}</span>
        </button>
      </div>
    </div>

    <!-- 点击外部关闭下拉 -->
    <div v-if="store.showSourceDropdown" @click="store.showSourceDropdown = false" class="fixed inset-0 z-40"></div>

    <!-- 错误提示 -->
    <div v-if="store.error" class="mb-3 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center justify-between">
      <span>⚠️ {{ store.error }}</span>
      <button @click="store.error = ''" class="text-red-400 hover:text-red-300" v-html="icons.close"></button>
    </div>

    <!-- 加载状态 -->
    <div v-if="store.isSearching" class="text-center py-16">
      <div class="inline-flex items-center gap-2 text-text-muted">
        <div class="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
        <span>AI 正在搜索中，请稍候...</span>
      </div>
    </div>

    <!-- 搜索结果 -->
    <div v-if="store.hasSearched && !store.isSearching && store.newsList.length > 0">
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-3">
          <button
            @click="store.toggleSelectAll()"
            class="px-2 py-1 rounded text-xs border transition-all"
            :class="store.allSelected
              ? 'bg-primary/20 border-primary text-primary-light'
              : 'border-border text-text-muted hover:border-primary/30 hover:text-text-secondary'"
          >{{ store.allSelected ? '取消全选' : '全选' }}</button>
          <button
            v-if="store.selectedIds.size > 0"
            @click="store.clearSelect()"
            class="px-2 py-1 rounded text-xs text-accent-amber border border-accent-amber/30 hover:bg-accent-amber/10 transition-all"
          >清除选择</button>
        </div>
        <span v-if="store.selectedItems.length > 0" class="text-xs text-text-muted">
          已选 <span class="text-accent-green font-medium">{{ store.selectedItems.length }}</span> 条
        </span>
      </div>

      <div v-if="store.overview" class="mb-3 p-3 rounded-lg bg-primary/5 border border-primary/20 text-sm text-text-secondary leading-relaxed">
        <span class="text-primary font-medium">📊 概述：</span>{{ store.overview }}
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
            <div
              class="mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all"
              :class="store.selectedIds.has(i) ? 'bg-primary border-primary' : 'border-text-muted'"
            >
              <svg v-if="store.selectedIds.has(i)" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
            </div>
            <div class="flex-1 min-w-0">
              <h4 class="text-sm font-medium text-white leading-snug">{{ item.title }}</h4>
              <p class="mt-1 text-xs text-text-secondary line-clamp-2">{{ item.summary }}</p>
              <div class="mt-1.5 flex items-center gap-2 text-xs text-text-muted flex-wrap">
                <span class="inline-flex items-center gap-1"><span v-html="icons.source"></span>{{ item.source }}</span>
                <span v-if="item.date">· {{ item.date }}</span>
                <span v-if="item.url">· <a :href="item.url" target="_blank" @click.stop class="text-primary-light hover:underline">原文</a></span>
              </div>
            </div>
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
      <p class="text-sm text-text-secondary">输入关键词，搜索新能源行业新闻并生成 PPT</p>
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
import { useNewsReportStore } from '../stores/newsReport'
import { icons } from '../assets/icons'

const store = useNewsReportStore()

const quickQuestions = [
  '固态电池最新进展',
  '锂电池安全事故',
  '储能行业政策',
  '新能源汽车补贴'
]
</script>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.date-input {
  color-scheme: dark;
}
.date-input::-webkit-calendar-picker-indicator {
  filter: invert(0.8);
  cursor: pointer;
}
</style>
