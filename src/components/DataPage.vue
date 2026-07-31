<template>
  <section>
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <!-- 关键词分布 -->
      <div class="glass rounded-xl p-4">
        <h4 class="text-sm font-medium text-text-secondary mb-3 flex items-center gap-1.5"><span v-html="icons.pie"></span>关键词分布</h4>
        <div ref="keywordChartRef" class="w-full h-56"></div>
      </div>

      <!-- 来源分布 -->
      <div class="glass rounded-xl p-4">
        <h4 class="text-sm font-medium text-text-secondary mb-3 flex items-center gap-1.5"><span v-html="icons.bar"></span>来源分布</h4>
        <div ref="sourceChartRef" class="w-full h-56"></div>
      </div>

      <!-- 资讯时间线 -->
      <div class="glass rounded-xl p-4">
        <h4 class="text-sm font-medium text-text-secondary mb-3 flex items-center gap-1.5"><span v-html="icons.trend"></span>资讯时间线</h4>
        <div ref="timelineChartRef" class="w-full h-56"></div>
      </div>

      <!-- 重要性分布 -->
      <div class="glass rounded-xl p-4">
        <h4 class="text-sm font-medium text-text-secondary mb-3 flex items-center gap-1.5"><span v-html="icons.alert"></span>重要性分布</h4>
        <div ref="importanceChartRef" class="w-full h-56"></div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, watch, onMounted, nextTick } from 'vue'
import * as echarts from 'echarts'
import { useNewsStore } from '../stores/news'
import { useAiStore } from '../stores/ai'
import { useThemeStore } from '../stores/theme'
import { icons } from '../assets/icons'

const store = useNewsStore()
const aiStore = useAiStore()
const themeStore = useThemeStore()

const keywordChartRef = ref(null)
const sourceChartRef = ref(null)
const timelineChartRef = ref(null)
const importanceChartRef = ref(null)

let keywordChart, sourceChart, timelineChart, importanceChart

function initCharts() {
  if (keywordChartRef.value) {
    keywordChart = echarts.init(keywordChartRef.value)
    updateKeywordChart()
  }
  if (sourceChartRef.value) {
    sourceChart = echarts.init(sourceChartRef.value)
    updateSourceChart()
  }
  if (timelineChartRef.value) {
    timelineChart = echarts.init(timelineChartRef.value)
    updateTimelineChart()
  }
  if (importanceChartRef.value) {
    importanceChart = echarts.init(importanceChartRef.value)
    updateImportanceChart()
  }
}

function getThemeColors() {
  const s = getComputedStyle(document.documentElement)
  return {
    label: s.getPropertyValue('--chart-label').trim() || '#94A3B8',
    grid: s.getPropertyValue('--chart-grid').trim() || '#1E293B',
    primary: s.getPropertyValue('--primary').trim(),
    green: s.getPropertyValue('--accent-green').trim(),
    amber: s.getPropertyValue('--accent-amber').trim(),
    muted: s.getPropertyValue('--text-muted').trim()
  }
}

function updateKeywordChart() {
  if (!keywordChart) return
  const c = getThemeColors()
  const data = Object.entries(store.keywordStats)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value }))
  keywordChart.setOption({
    tooltip: { trigger: 'item' },
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      label: { color: c.label, fontSize: 11 },
      data,
      emphasis: { itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0, 0, 0, 0.5)' } }
    }]
  })
}

function updateSourceChart() {
  if (!sourceChart) return
  const c = getThemeColors()
  const data = Object.entries(store.sourceStats).filter(([, v]) => v > 0)
  sourceChart.setOption({
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: data.map(([k]) => k), axisLabel: { color: c.label, fontSize: 10, rotate: 30 } },
    yAxis: { type: 'value', axisLabel: { color: c.label }, splitLine: { lineStyle: { color: c.grid } } },
    series: [{ type: 'bar', data: data.map(([, v]) => v), itemStyle: { color: c.primary, borderRadius: [4, 4, 0, 0] } }]
  })
}

function updateTimelineChart() {
  if (!timelineChart) return
  const c = getThemeColors()
  const data = store.dailyStats
  const greenRgb = c.green === '#059669' ? '5,150,105' : '34,197,94'
  timelineChart.setOption({
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: data.map(([k]) => k), axisLabel: { color: c.label, fontSize: 10 } },
    yAxis: { type: 'value', axisLabel: { color: c.label }, splitLine: { lineStyle: { color: c.grid } } },
    series: [{
      type: 'line',
      data: data.map(([, v]) => v),
      smooth: true,
      lineStyle: { color: c.green },
      areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: `rgba(${greenRgb},0.3)` }, { offset: 1, color: `rgba(${greenRgb},0)` }]) }
    }]
  })
}

function updateImportanceChart() {
  if (!importanceChart) return
  const c = getThemeColors()
  const data = store.importanceStats
  importanceChart.setOption({
    tooltip: { trigger: 'item' },
    series: [{
      type: 'pie',
      radius: ['40%', '65%'],
      label: { color: c.label, fontSize: 11 },
      data: [
        { name: '重要', value: data.high, itemStyle: { color: c.amber } },
        { name: '关注', value: data.medium, itemStyle: { color: c.primary } },
        { name: '一般', value: data.low, itemStyle: { color: c.muted } }
      ]
    }]
  })
}

function handleResize() {
  keywordChart?.resize()
  sourceChart?.resize()
  timelineChart?.resize()
  importanceChart?.resize()
}

onMounted(() => {
  nextTick(initCharts)
  window.addEventListener('resize', handleResize)
})

// AI 面板开关时触发图表重排
watch(() => aiStore.isOpen, () => {
  // 等 CSS transition (300ms) 完成后再 resize
  setTimeout(() => handleResize(), 350)
})

// 主题切换时重新设置图表颜色
watch(() => themeStore.theme, () => {
  nextTick(() => {
    updateKeywordChart()
    updateSourceChart()
    updateTimelineChart()
    updateImportanceChart()
  })
})

watch(() => [store.timeFilteredArticles, store.keywordStats, store.sourceStats], () => {
  nextTick(() => {
    updateKeywordChart()
    updateSourceChart()
    updateTimelineChart()
    updateImportanceChart()
  })
}, { deep: true })
</script>
