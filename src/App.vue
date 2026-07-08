<template>
  <div class="min-h-screen bg-bg-deep">
    <AppHeader />
    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-20">
      <!-- 实时资讯页 -->
      <div v-if="pageStore.currentPage === 'news'">
        <NewsPage />
      </div>

      <!-- 数据统计页 -->
      <div v-else-if="pageStore.currentPage === 'data'">
        <DataPage />
      </div>

      <!-- 信息检索页 -->
      <div v-else-if="pageStore.currentPage === 'search'">
        <SearchPage />
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
import SearchPage from './components/SearchPage.vue'
import AppFooter from './components/AppFooter.vue'
import AiAssistant from './components/AiAssistant.vue'

const pageStore = usePageStore()
</script>
