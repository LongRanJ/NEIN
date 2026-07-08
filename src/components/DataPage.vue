<template>
  <section>
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <!-- 关键词分布 -->
      <div class="glass rounded-xl p-4">
        <h4 class="text-sm font-medium text-text-secondary mb-3">📊 关键词分布</h4>
        <div ref="keywordChartRef" class="w-full h-56"></div>
      </div>

      <!-- 来源分布 -->
      <div class="glass rounded-xl p-4">
        <h4 class="text-sm font-medium text-text-secondary mb-3">📰 来源分布</h4>
        <div ref="sourceChartRef" class="w-full h-56"></div>
      </div>

      <!-- 资讯时间线 -->
      <div class="glass rounded-xl p-4">
        <h4 class="text-sm font-medium text-text-secondary mb-3">📈 资讯时间线</h4>
        <div ref="timelineChartRef" class="w-full h-56"></div>
      </div>

      <!-- 重要性分布 -->
      <div class="glass rounded-xl p-4">
        <h4 class="text-sm font-medium text-text-secondary mb-3">⚠️ 重要性分布</h4>
        <div ref="importanceChartRef" class="w-full h-56"></div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, watch, onMounted, nextTick } from 'vue'
import * as echarts from 'echarts'
import { useNewsStore } from '../stores/news'

const store = useNewsStore()

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

function updateKeywordChart() {
  if (!keywordChart) return
  const data = Object.entries(store.keywordStats)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value }))
  keywordChart.setOption({
    tooltip: { trigger: 'item' },
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      label: { color: '#94A3B8', fontSize: 11 },
      data,
      emphasis: { itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0, 0, 0, 0.5)' } }
    }]
  })
}

function updateSourceChart() {
  if (!sourceChart) return
  const data = Object.entries(store.sourceStats).filter(([, v]) => v > 0)
  sourceChart.setOption({
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: data.map(([k]) => k), axisLabel: { color: '#94A3B8', fontSize: 10, rotate: 30 } },
    yAxis: { type: 'value', axisLabel: { color: '#94A3B8' }, splitLine: { lineStyle: { color: '#1E293B' } } },
    series: [{ type: 'bar', data: data.map(([, v]) => v), itemStyle: { color: '#38BDF8', borderRadius: [4, 4, 0, 0] } }]
  })
}

function updateTimelineChart() {
  if (!timelineChart) return
  const data = store.dailyStats
  timelineChart.setOption({
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: data.map(([k]) => k), axisLabel: { color: '#94A3B8', fontSize: 10 } },
    yAxis: { type: 'value', axisLabel: { color: '#94A3B8' }, splitLine: { lineStyle: { color: '#1E293B' } } },
    series: [{
      type: 'line',
      data: data.map(([, v]) => v),
      smooth: true,
      lineStyle: { color: '#22C55E' },
      areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(34,197,94,0.3)' }, { offset: 1, color: 'rgba(34,197,94,0)' }]) }
    }]
  })
}

function updateImportanceChart() {
  if (!importanceChart) return
  const data = store.importanceStats
  importanceChart.setOption({
    tooltip: { trigger: 'item' },
    series: [{
      type: 'pie',
      radius: ['40%', '65%'],
      label: { color: '#94A3B8', fontSize: 11 },
      data: [
        { name: '重要', value: data.high, itemStyle: { color: '#F59E0B' } },
        { name: '关注', value: data.medium, itemStyle: { color: '#38BDF8' } },
        { name: '一般', value: data.low, itemStyle: { color: '#64748B' } }
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

watch(() => [store.timeFilteredArticles, store.keywordStats, store.sourceStats], () => {
  nextTick(() => {
    updateKeywordChart()
    updateSourceChart()
    updateTimelineChart()
    updateImportanceChart()
  })
}, { deep: true })
</script>
