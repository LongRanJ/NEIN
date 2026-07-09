<template>
  <section>
    <!-- 更新提示 -->
    <div v-if="updateMsg" class="mb-4 p-3 rounded-lg text-sm" :class="updateSuccess ? 'bg-green-500/10 border border-green-500/30 text-green-400' : 'bg-red-500/10 border border-red-500/30 text-red-400'">
      {{ updateMsg }}
    </div>

    <!-- 关键词标签 + 条数 + 更新按钮 -->
    <div class="flex items-center flex-wrap gap-2 mb-6">
      <button
        @click="store.setActiveKeyword(null)"
        class="px-3 py-1.5 rounded-full text-xs font-medium transition-all border"
        :class="!store.activeKeyword
          ? 'bg-primary text-white border-primary'
          : 'bg-bg-deep border-border text-text-muted hover:border-primary/30 hover:text-text-secondary'"
      >全部</button>
      <button
        v-for="kw in store.keywords"
        :key="kw"
        @click="store.setActiveKeyword(kw)"
        class="px-3 py-1.5 rounded-full text-xs font-medium transition-all border"
        :class="store.activeKeyword === kw
          ? 'bg-primary text-white border-primary'
          : 'bg-bg-deep border-border text-text-muted hover:border-primary/30 hover:text-text-secondary'"
      >
        {{ kw }}
        <span class="ml-1 opacity-60">{{ store.keywordStats[kw] || 0 }}</span>
      </button>

      <!-- 右侧：条数 + 更新按钮 -->
      <div class="ml-auto flex items-center gap-3">
        <span class="text-xs text-text-muted">共 <span class="text-primary font-medium">{{ store.timeFilteredArticles.length }}</span> 条</span>
        <button
          @click="triggerUpdate"
          :disabled="isUpdating"
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/20 text-primary-light text-xs hover:bg-primary/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          <span v-if="isUpdating" class="w-3.5 h-3.5 border border-primary-light border-t-transparent rounded-full animate-spin"></span>
          <span v-else class="inline-flex" v-html="icons.refresh"></span>
          <span>{{ isUpdating ? '更新中...' : '更新数据' }}</span>
        </button>
      </div>
    </div>

    <!-- 新闻卡片列表 -->
    <div class="space-y-4">
      <div
        v-for="(article, index) in displayArticles"
        :key="article.id"
        class="news-card glass rounded-xl p-5 animate-slide-up cursor-pointer"
        :style="{ animationDelay: `${index * 0.05}s` }"
        @click="selectedArticle = article"
      >
        <div class="flex items-start justify-between gap-3">
          <h4 class="text-base font-semibold text-white leading-snug flex-1">
            {{ article.title }}
          </h4>
          <span class="shrink-0 px-2 py-0.5 rounded text-xs font-medium" :class="importanceClass(article.importance)">{{ importanceLabel(article.importance) }}</span>
        </div>

        <p class="mt-2 text-sm text-text-secondary leading-relaxed line-clamp-2">{{ article.summary }}</p>

        <!-- Tags -->
        <div v-if="article.tags" class="mt-2 flex flex-wrap gap-1.5">
          <span v-if="article.tags.地点" class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-primary/10 text-primary-light"><span v-html="icons.location"></span>{{ article.tags.地点 }}</span>
          <span v-if="article.tags.涉及企业?.length" class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-accent-green/10 text-accent-green"><span v-html="icons.building"></span>{{ article.tags.涉及企业.slice(0, 3).join('、') }}</span>
        </div>

        <!-- Meta -->
        <div class="mt-3 flex items-center gap-2 text-xs text-text-muted flex-wrap">
          <span class="inline-flex items-center gap-1"><span v-html="icons.source"></span>{{ article.source }}</span>
          <span>·</span>
          <span class="inline-flex items-center gap-1"><span v-html="icons.calendar"></span>{{ article.publishedAt }}</span>
          <template v-if="isArticleUrl(article.sourceUrl)">
            <span>·</span>
            <a :href="article.sourceUrl" target="_blank" @click.stop class="text-primary-light hover:underline">查看原文</a>
          </template>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-if="displayArticles.length === 0" class="text-center py-16 text-text-muted">
      <p class="text-lg">当前时间范围内没有资讯</p>
      <p class="text-sm mt-1">请尝试调整时间筛选器或切换关键词</p>
    </div>

    <!-- 文章详情弹窗 -->
    <Teleport to="body">
      <div v-if="selectedArticle" class="fixed inset-0 z-[100] flex items-center justify-center p-4" @click.self="selectedArticle = null">
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="selectedArticle = null"></div>
        <div class="relative glass rounded-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto animate-fade-in">
          <button @click="selectedArticle = null" class="absolute top-4 right-4 text-text-muted hover:text-white" v-html="icons.close"></button>
          <h2 class="text-xl font-bold text-white pr-8">{{ selectedArticle.title }}</h2>
          <div class="mt-2 flex items-center gap-2 text-xs text-text-muted">
            <span class="inline-flex items-center gap-1"><span v-html="icons.source"></span>{{ selectedArticle.source }}</span>
            <span>·</span>
            <span class="inline-flex items-center gap-1"><span v-html="icons.calendar"></span>{{ selectedArticle.publishedAt }}</span>
            <span>·</span>
            <span :class="importanceClass(selectedArticle.importance)">{{ importanceLabel(selectedArticle.importance) }}</span>
          </div>
          <p class="mt-4 text-sm text-text-secondary leading-relaxed">{{ selectedArticle.summary }}</p>
          <div v-if="selectedArticle.tags" class="mt-4 space-y-1">
            <p v-if="selectedArticle.tags.时间" class="flex items-center gap-1.5 text-xs text-text-muted"><span v-html="icons.clock"></span>{{ selectedArticle.tags.时间 }}</p>
            <p v-if="selectedArticle.tags.地点" class="flex items-center gap-1.5 text-xs text-text-muted"><span v-html="icons.location"></span>{{ selectedArticle.tags.地点 }}</p>
            <p v-if="selectedArticle.tags.主要事件" class="flex items-center gap-1.5 text-xs text-text-muted"><span v-html="icons.pin"></span>{{ selectedArticle.tags.主要事件 }}</p>
            <p v-if="selectedArticle.tags.涉及企业?.length" class="flex items-center gap-1.5 text-xs text-text-muted"><span v-html="icons.building"></span>{{ selectedArticle.tags.涉及企业.join('、') }}</p>
          </div>
          <div class="mt-4 flex flex-wrap gap-1.5">
            <span v-for="kw in selectedArticle.keywords" :key="kw" class="px-2 py-0.5 rounded text-xs bg-primary/10 text-primary-light">{{ kw }}</span>
          </div>
          <a v-if="isArticleUrl(selectedArticle.sourceUrl)" :href="selectedArticle.sourceUrl" target="_blank" class="mt-4 inline-block text-sm text-primary hover:underline">查看原文 →</a>
        </div>
      </div>
    </Teleport>
  </section>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useNewsStore } from '../stores/news'
import { useTimeFilterStore } from '../stores/timeFilter'
import { icons } from '../assets/icons'

const store = useNewsStore()
const timeFilter = useTimeFilterStore()
const selectedArticle = ref(null)
const isUpdating = ref(false)
const updateMsg = ref('')
const updateSuccess = ref(false)

async function triggerUpdate() {
  isUpdating.value = true
  updateMsg.value = ''
  try {
    const resp = await fetch('/api/trigger-update', { method: 'POST' })
    const data = await resp.json()
    if (data.success) {
      updateSuccess.value = true
      updateMsg.value = '✅ ' + data.message
    } else {
      updateSuccess.value = false
      updateMsg.value = '⚠️ ' + (data.error || '触发失败')
    }
  } catch (err) {
    updateSuccess.value = false
    updateMsg.value = '⚠️ 网络错误：' + err.message
  } finally {
    isUpdating.value = false
    setTimeout(() => { updateMsg.value = '' }, 5000)
  }
}

const displayArticles = computed(() => store.keywordFiltered)

function importanceClass(imp) {
  return { high: 'bg-accent-amber/20 text-accent-amber', medium: 'bg-primary/20 text-primary-light', low: 'bg-text-muted/20 text-text-muted' }[imp] || ''
}

function importanceLabel(imp) {
  return { high: '重要', medium: '关注', low: '一般' }[imp] || ''
}

function isArticleUrl(url) {
  if (!url) return false
  try {
    const u = new URL(url)
    return u.pathname.length > 1
  } catch {
    return false
  }
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
