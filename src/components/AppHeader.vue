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
          <!-- 快捷按钮（桌面端） -->
          <div class="hidden lg:flex items-center gap-1">
            <button
              v-for="preset in presets"
              :key="preset.days"
              @click="timeFilter.setPreset(preset.days)"
              class="px-2.5 py-1 rounded text-xs transition-all"
              :class="isPresetActive(preset.days) ? 'bg-primary text-white' : 'text-text-muted hover:text-white hover:bg-bg-card'"
            >{{ preset.label }}</button>
          </div>

          <!-- 日期选择器 -->
          <div class="flex items-center gap-1.5 bg-bg-deep rounded-lg border border-border px-2 py-1.5">
            <span class="text-xs text-text-muted">📅</span>
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

          <!-- GitHub -->
          <a
            href="https://github.com/LongRanJ/NEIN"
            target="_blank"
            rel="noopener"
            class="w-8 h-8 rounded-lg bg-bg-card border border-border flex items-center justify-center text-text-secondary hover:text-white hover:border-primary transition-all"
            title="GitHub"
          >
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
            </svg>
          </a>
        </div>
      </div>

      <!-- 第二行：Tab 导航 -->
      <nav class="flex items-center gap-1 -mb-px">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          @click="pageStore.setPage(tab.key)"
          class="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-all border-b-2"
          :class="pageStore.currentPage === tab.key
            ? 'border-primary text-primary-light'
            : 'border-transparent text-text-muted hover:text-white hover:border-border'"
        >
          <span>{{ tab.icon }}</span>
          <span>{{ tab.label }}</span>
        </button>
      </nav>
    </div>
  </header>
</template>

<script setup>
import { usePageStore } from '../stores/page'
import { useTimeFilterStore } from '../stores/timeFilter'

const pageStore = usePageStore()
const timeFilter = useTimeFilterStore()

const tabs = [
  { key: 'news', label: '实时资讯', icon: '📰' },
  { key: 'data', label: '数据统计', icon: '📊' },
  { key: 'localSearch', label: '本地检索', icon: '🔎' },
  { key: 'aiSearch', label: 'AI实时搜索', icon: '🤖' }
]

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
