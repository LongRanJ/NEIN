<template>
  <section id="charts" class="space-y-4">
    <h3 class="text-lg font-semibold text-white mb-4">📊 数据概览</h3>

    <!-- Keyword distribution -->
    <div class="glass rounded-xl p-4">
      <h4 class="text-sm font-medium text-text-secondary mb-3">关键词分布</h4>
      <div ref="keywordChartRef" class="w-full h-52"></div>
    </div>

    <!-- Source distribution -->
    <div class="glass rounded-xl p-4">
      <h4 class="text-sm font-medium text-text-secondary mb-3">来源分布</h4>
      <div ref="sourceChartRef" class="w-full h-52"></div>
    </div>

    <!-- Timeline -->
    <div class="glass rounded-xl p-4">
      <h4 class="text-sm font-medium text-text-secondary mb-3">资讯时间线</h4>
      <div ref="timelineChartRef" class="w-full h-52"></div>
    </div>

    <!-- Importance -->
    <div class="glass rounded-xl p-4">
      <h4 class="text-sm font-medium text-text-secondary mb-3">重要性分布</h4>
      <div ref="importanceChartRef" class="w-full h-40"></div>
    </div>
  </section>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import * as echarts from 'echarts/core'
import { BarChart, PieChart, LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

// Register only needed components
// This reduces bundle size significantly
echarts.use([BarChart, PieChart, LineChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer])
import { useNewsStore } from '../stores/news'

const store = useNewsStore()

const keywordChartRef = ref(null)
const sourceChartRef = ref(null)
const timelineChartRef = ref(null)
const importanceChartRef = ref(null)

let keywordChart, sourceChart, timelineChart, importanceChart

const baseTextStyle = { color: '#94A3B8', fontSize: 11 }

function initCharts() {
  // Keyword bar chart
  keywordChart = echarts.init(keywordChartRef.value)
  const kwData = store.keywords.map(k => ({ name: k, value: store.keywordStats[k] || 0 }))
  keywordChart.setOption({
    grid: { top: 10, right: 10, bottom: 20, left: 80 },
    xAxis: { type: 'value', axisLabel: { ...baseTextStyle }, splitLine: { lineStyle: { color: '#1E293B' } } },
    yAxis: { type: 'category', data: kwData.map(d => d.name), axisLabel: { ...baseTextStyle } },
    series: [{
      type: 'bar',
      data: kwData.map(d => d.value),
      itemStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
          { offset: 0, color: '#0EA5E9' },
          { offset: 1, color: '#10B981' }
        ]),
        borderRadius: [0, 4, 4, 0]
      },
      barWidth: 16
    }],
    tooltip: { trigger: 'axis', backgroundColor: '#1E293B', borderColor: '#334155', textStyle: { color: '#E2E8F0' } }
  })

  // Source pie chart
  sourceChart = echarts.init(sourceChartRef.value)
  const srcData = store.sources.map(s => ({ name: s, value: store.sourceStats[s] || 0 })).filter(d => d.value > 0)
  sourceChart.setOption({
    series: [{
      type: 'pie',
      radius: ['35%', '65%'],
      center: ['50%', '50%'],
      data: srcData,
      label: { ...baseTextStyle, fontSize: 10 },
      itemStyle: { borderRadius: 6, borderColor: '#0F172A', borderWidth: 2 },
      color: ['#0EA5E9', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#84CC16']
    }],
    tooltip: { backgroundColor: '#1E293B', borderColor: '#334155', textStyle: { color: '#E2E8F0' } }
  })

  // Timeline chart
  timelineChart = echarts.init(timelineChartRef.value)
  const tlData = store.dailyStats
  timelineChart.setOption({
    grid: { top: 10, right: 10, bottom: 20, left: 40 },
    xAxis: { type: 'category', data: tlData.map(d => d[0].slice(5)), axisLabel: { ...baseTextStyle } },
    yAxis: { type: 'value', axisLabel: { ...baseTextStyle }, splitLine: { lineStyle: { color: '#1E293B' } } },
    series: [{
      type: 'line',
      data: tlData.map(d => d[1]),
      smooth: true,
      symbol: 'circle',
      symbolSize: 6,
      lineStyle: { color: '#0EA5E9', width: 2 },
      itemStyle: { color: '#0EA5E9' },
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(14,165,233,0.3)' },
          { offset: 1, color: 'rgba(14,165,233,0)' }
        ])
      }
    }],
    tooltip: { trigger: 'axis', backgroundColor: '#1E293B', borderColor: '#334155', textStyle: { color: '#E2E8F0' } }
  })

  // Importance gauge
  importanceChart = echarts.init(importanceChartRef.value)
  const impData = [
    { name: '重要', value: store.importanceStats.high, color: '#F59E0B' },
    { name: '关注', value: store.importanceStats.medium, color: '#0EA5E9' },
    { name: '一般', value: store.importanceStats.low, color: '#64748B' }
  ]
  importanceChart.setOption({
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      data: impData.map(d => ({ ...d, itemStyle: { color: d.color } })),
      label: { formatter: '{b}: {c}', ...baseTextStyle },
      itemStyle: { borderRadius: 4, borderColor: '#0F172A', borderWidth: 2 }
    }],
    tooltip: { backgroundColor: '#1E293B', borderColor: '#334155', textStyle: { color: '#E2E8F0' } }
  })
}

function handleResize() {
  keywordChart?.resize()
  sourceChart?.resize()
  timelineChart?.resize()
  importanceChart?.resize()
}

onMounted(() => {
  initCharts()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  keywordChart?.dispose()
  sourceChart?.dispose()
  timelineChart?.dispose()
  importanceChart?.dispose()
})
</script>
