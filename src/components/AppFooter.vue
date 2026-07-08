<template>
  <footer class="border-t border-border mt-12 py-8">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-text-muted">
        <div class="flex items-center gap-2">
          <span class="font-semibold text-text-secondary">NEIN</span>
          <span>·</span>
          <span>新能源行业资讯平台</span>
        </div>
        <div class="flex items-center gap-4">
          <span>数据来源：{{ store.sources.join('、') }}</span>
        </div>
        <div class="flex items-center gap-2">
          <span>🕐 更新于 {{ formattedTime }}</span>
        </div>
      </div>
      <p class="text-center text-xs text-text-muted mt-4">
        本平台资讯数据由自动化脚本抓取整理，仅供参考，不构成任何投资建议
      </p>
    </div>
  </footer>
</template>

<script setup>
import { computed } from 'vue'
import { useNewsStore } from '../stores/news'

const store = useNewsStore()

const formattedTime = computed(() => {
  const d = new Date(store.lastUpdated)
  return d.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
})
</script>
