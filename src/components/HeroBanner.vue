<template>
  <section class="pt-8 pb-4">
    <!-- Title -->
    <div class="text-center mb-8">
      <h2 class="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-primary via-primary-light to-accent-green bg-clip-text text-transparent">
        新能源行业资讯平台
      </h2>
      <p class="mt-3 text-text-secondary text-lg">
        聚合锂电池 · 固态电池 · 储能 · 氢能等领域最新动态
      </p>
      <p class="mt-1 text-text-muted text-sm">
        🕐 数据更新于 {{ formattedTime }}
      </p>
    </div>

    <!-- Stats cards -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <div class="glass rounded-xl p-4 text-center animate-fade-in" style="animation-delay: 0.1s">
        <div class="text-2xl font-bold text-primary">{{ store.articles.length }}</div>
        <div class="text-xs text-text-secondary mt-1">资讯总量</div>
      </div>
      <div class="glass rounded-xl p-4 text-center animate-fade-in" style="animation-delay: 0.2s">
        <div class="text-2xl font-bold text-accent-green">{{ store.keywords.length }}</div>
        <div class="text-xs text-text-secondary mt-1">追踪关键词</div>
      </div>
      <div class="glass rounded-xl p-4 text-center animate-fade-in" style="animation-delay: 0.3s">
        <div class="text-2xl font-bold text-accent-amber">{{ store.sources.length }}</div>
        <div class="text-xs text-text-secondary mt-1">数据来源</div>
      </div>
      <div class="glass rounded-xl p-4 text-center animate-fade-in" style="animation-delay: 0.4s">
        <div class="text-2xl font-bold text-primary-light">{{ highCount }}</div>
        <div class="text-xs text-text-secondary mt-1">重要资讯</div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { useNewsStore } from '../stores/news'

const store = useNewsStore()

const formattedTime = computed(() => {
  const d = new Date(store.lastUpdated)
  return d.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })
})

const highCount = computed(() =>
  store.articles.filter(a => a.importance === 'high').length
)
</script>
