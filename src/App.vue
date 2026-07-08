<template>
  <div class="min-h-screen bg-bg-deep">
    <AppHeader />
    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-8">
      <!-- 实时资讯页 -->
      <div v-if="pageStore.currentPage === 'news'">
        <NewsPage />
      </div>

      <!-- 数据统计页 -->
      <div v-else-if="pageStore.currentPage === 'data'">
        <DataPage />
      </div>

      <!-- 本地检索页 -->
      <div v-else-if="pageStore.currentPage === 'localSearch'">
        <LocalSearchPage />
      </div>

      <!-- AI实时搜索页 -->
      <div v-else-if="pageStore.currentPage === 'aiSearch'">
        <AiSearchPage />
      </div>
    </main>
    <AppFooter />
    <AiAssistant />
  </div>
</template>

<script setup>
import { usePageStore } from './stores/page'
import AppHeader from './components/AppHeader.vue'
import NewsPage from './components/NewsPage.vue'
import DataPage from './components/DataPage.vue'
import LocalSearchPage from './components/LocalSearchPage.vue'
import AiSearchPage from './components/AiSearchPage.vue'
import AppFooter from './components/AppFooter.vue'
import AiAssistant from './components/AiAssistant.vue'

const pageStore = usePageStore()
</script>
