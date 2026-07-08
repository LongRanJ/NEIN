<template>
  <section class="mt-2">
    <div class="flex items-center gap-2 mb-3">
      <span class="text-text-secondary text-sm">🏷️ 关键词筛选</span>
      <button
        v-if="store.activeKeyword"
        @click="store.setActiveKeyword(null)"
        class="text-xs text-accent-amber hover:text-white transition-colors"
      >
        ✕ 清除筛选
      </button>
    </div>
    <div class="flex flex-wrap gap-2">
      <button
        v-for="kw in store.keywords"
        :key="kw"
        @click="store.setActiveKeyword(kw)"
        class="keyword-tag"
        :class="{ active: store.activeKeyword === kw }"
      >
        {{ kw }}
        <span class="ml-1 text-xs opacity-60">({{ store.keywordStats[kw] || 0 }})</span>
      </button>
    </div>
  </section>
</template>

<script setup>
import { useNewsStore } from '../stores/news'
const store = useNewsStore()
</script>
