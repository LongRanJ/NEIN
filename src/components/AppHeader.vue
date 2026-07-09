<template>
  <header class="sticky top-0 z-50 glass">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <!-- 第一行：Logo + 标题 + 时间筛选 -->
      <div class="flex items-center justify-between h-14">
        <!-- Logo + 合并标题 -->
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-accent-green flex items-center justify-center text-white font-bold text-lg shrink-0">
            N
          </div>
          <div class="min-w-0">
            <h1 class="text-base sm:text-lg font-bold text-white leading-tight truncate">
              NEIN
              <span class="hidden sm:inline text-sm font-normal text-text-secondary ml-1">新能源行业资讯平台</span>
            </h1>
            <p class="text-xs text-text-muted truncate">聚合锂电池 · 固态电池 · 储能 · 氢能等领域最新动态</p>
          </div>
        </div>

        <!-- 时间筛选器 -->
        <div class="flex items-center gap-2">
          <div class="hidden lg:flex items-center gap-1">
            <button
              v-for="preset in presets"
              :key="preset.days"
              @click="timeFilter.setPreset(preset.days)"
              class="px-2.5 py-1 rounded text-xs transition-all"
              :class="isPresetActive(preset.days) ? 'bg-primary text-white' : 'text-text-muted hover:text-white hover:bg-bg-card'"
            >{{ preset.label }}</button>
          </div>

          <div class="flex items-center gap-1.5 bg-bg-deep rounded-lg border border-border px-2 py-1.5">
            <input
              type="date"
              :value="timeFilter.startDate"
              @change="timeFilter.setRange($event.target.value, timeFilter.endDate)"
              class="bg-transparent text-xs text-text-primary focus:outline-none w-24"
            />
            <span class="text-xs text-text-muted">~</span>
            <input
              type="date"
              :value="timeFilter.endDate"
              @change="timeFilter.setRange(timeFilter.startDate, $event.target.value)"
              class="bg-transparent text-xs text-text-primary focus:outline-none w-24"
            />
          </div>

          <a
            href="https://github.com/LongRanJ/NEIN"
            target="_blank"
            rel="noopener"
            class="w-8 h-8 rounded-lg bg-bg-card border border-border flex items-center justify-center text-text-secondary hover:text-white hover:border-primary transition-all"
            title="GitHub"
            v-html="icons.github"
          ></a>
        </div>
      </div>

      <!-- 第二行：Tab 导航 + 右侧信息 -->
      <nav class="flex items-center justify-between -mb-px">
        <div class="flex items-center gap-1">
          <button
            v-for="tab in tabs"
            :key="tab.key"
            @click="pageStore.setPage(tab.key)"
            class="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-all border-b-2"
            :class="pageStore.currentPage === tab.key
              ? 'border-primary text-primary-light'
              : 'border-transparent text-text-muted hover:text-white hover:border-border'"
          >
            <span class="inline-flex" v-html="tab.icon"></span>
            <span>{{ tab.label }}</span>
          </button>
        </div>
        <div class="flex items-center gap-3 pr-1">
          <!-- 数据统计页：仅显示资讯数目 -->
          <span v-if="pageStore.currentPage === 'data'" class="flex items-center gap-1.5 text-xs text-text-muted">
            <span class="text-primary font-medium">{{ newsStore.timeFilteredArticles.length }}</span>
            <span>条资讯</span>
          </span>
          <!-- 其他页：Tab 说明文字 -->
          <span v-if="tabDesc" class="text-xs text-text-muted">{{ tabDesc }}</span>
        </div>
      </nav>
    </div>
  </header>
</template>

<script setup>
import { computed } from 'vue'
import { usePageStore } from '../stores/page'
import { useTimeFilterStore } from '../stores/timeFilter'
import { useNewsStore } from '../stores/news'
import { icons } from '../assets/icons'

const pageStore = usePageStore()
const timeFilter = useTimeFilterStore()
const newsStore = useNewsStore()

const tabs = [
  { key: 'news', label: '实时资讯', icon: icons.news },
  { key: 'data', label: '数据统计', icon: icons.chart },
  { key: 'localSearch', label: '本地检索', icon: icons.search, desc: '在已有新闻库中搜索' },
  { key: 'aiSearch', label: 'AI实时搜索', icon: icons.ai, desc: 'RSS 实时抓取 + 智能筛选' }
]

const tabDesc = computed(() => {
  if (pageStore.currentPage === 'data') return '数据基于当前筛选范围'
  return tabs.find(t => t.key === pageStore.currentPage)?.desc || ''
})

const presets = [
  { label: '今天', days: 0 },
  { label: '近3天', days: 3 },
  { label: '近7天', days: 7 },
  { label: '近30天', days: 30 },
]

function isPresetActive(days) {
  const now = new Date()
  const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
  return timeFilter.startDate === start.toISOString().split('T')[0]
    && timeFilter.endDate === now.toISOString().split('T')[0]
}
</script>

<style>
/* 日期选择器日历图标改为白色 */
input[type="date"]::-webkit-calendar-picker-indicator {
  filter: invert(1);
  cursor: pointer;
}
</style>
