<template>
  <section id="news">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-lg font-semibold text-white">
        📰 最新资讯
        <span v-if="store.activeKeyword" class="text-primary text-sm font-normal ml-2">
          — {{ store.activeKeyword }}
        </span>
      </h3>
      <span class="text-sm text-text-muted">{{ displayArticles.length }} 条</span>
    </div>

    <div class="space-y-4">
      <div
        v-for="(article, index) in displayArticles"
        :key="article.id"
        class="news-card glass rounded-xl p-5 animate-slide-up cursor-pointer"
        :style="{ animationDelay: `${index * 0.05}s` }"
        @click="selectedArticle = article"
      >
        <!-- Header -->
        <div class="flex items-start justify-between gap-3">
          <h4 class="text-base font-semibold text-white leading-snug flex-1">
            <span v-if="article.importance === 'high'" class="text-accent-amber mr-1">🔥</span>
            {{ article.title }}
          </h4>
          <span
            class="shrink-0 px-2 py-0.5 rounded text-xs font-medium"
            :class="importanceClass(article.importance)"
          >
            {{ importanceLabel(article.importance) }}
          </span>
        </div>

        <!-- Summary -->
        <p class="mt-2 text-sm text-text-secondary leading-relaxed line-clamp-2">
          {{ article.summary }}
        </p>

        <!-- Footer -->
        <div class="mt-3 flex items-center flex-wrap gap-2 text-xs text-text-muted">
          <span class="flex items-center gap-1">📰 {{ article.source }}</span>
          <span>·</span>
          <span>📅 {{ article.publishedAt }}</span>
          <span>·</span>
          <span class="flex items-center gap-1">
            🏷️
            <span
              v-for="kw in article.keywords"
              :key="kw"
              class="px-1.5 py-0.5 rounded bg-primary/10 text-primary-light cursor-pointer hover:bg-primary/20"
              @click.stop="store.setActiveKeyword(kw)"
            >
              {{ kw }}
            </span>
          </span>
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div v-if="displayArticles.length === 0" class="text-center py-12 text-text-muted">
      <div class="text-4xl mb-3">📭</div>
      <p>没有找到相关资讯</p>
    </div>

    <!-- Article detail modal -->
    <Teleport to="body">
      <div
        v-if="selectedArticle"
        class="fixed inset-0 z-[100] flex items-center justify-center p-4"
        @click.self="selectedArticle = null"
      >
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="selectedArticle = null"></div>
        <div class="relative glass rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6 animate-fade-in">
          <button
            @click="selectedArticle = null"
            class="absolute top-4 right-4 w-8 h-8 rounded-full bg-bg-card border border-border flex items-center justify-center text-text-secondary hover:text-white hover:border-primary transition-all"
          >✕</button>

          <div class="mb-4">
            <span
              class="px-2 py-0.5 rounded text-xs font-medium"
              :class="importanceClass(selectedArticle.importance)"
            >
              {{ importanceLabel(selectedArticle.importance) }}
            </span>
          </div>

          <h2 class="text-xl font-bold text-white mb-3">{{ selectedArticle.title }}</h2>

          <div class="flex items-center flex-wrap gap-3 text-sm text-text-muted mb-4">
            <span>📰 {{ selectedArticle.source }}</span>
            <span>📅 {{ selectedArticle.publishedAt }}</span>
            <span>📂 {{ selectedArticle.category }}</span>
          </div>

          <div class="flex flex-wrap gap-2 mb-4">
            <span
              v-for="kw in selectedArticle.keywords"
              :key="kw"
              class="keyword-tag text-xs"
            >{{ kw }}</span>
          </div>

          <p class="text-text-secondary leading-relaxed">{{ selectedArticle.summary }}</p>

          <a
            :href="selectedArticle.sourceUrl"
            target="_blank"
            rel="noopener"
            class="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-lg bg-primary/20 text-primary-light hover:bg-primary/30 transition-colors text-sm"
          >
            🔗 查看原文
          </a>
        </div>
      </div>
    </Teleport>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useNewsStore } from '../stores/news'

const store = useNewsStore()
const selectedArticle = ref(null)

const displayArticles = computed(() => {
  if (store.searchQuery.trim()) return store.searchResults
  return store.keywordFiltered
})

function importanceClass(imp) {
  return {
    high: 'bg-accent-amber/20 text-accent-amber',
    medium: 'bg-primary/20 text-primary-light',
    low: 'bg-text-muted/20 text-text-muted'
  }[imp] || ''
}

function importanceLabel(imp) {
  return { high: '重要', medium: '关注', low: '一般' }[imp] || ''
}
</script>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
