<template>
  <div class="min-h-screen bg-bg-deep">
    <AppHeader ref="headerRef" />
    <main
      class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-8 transition-all duration-300"
      :class="{ 'mr-[33vw]': aiStore.isOpen }"
    >
      <div v-if="pageStore.currentPage === 'news'"><NewsPage /></div>
      <div v-else-if="pageStore.currentPage === 'data'"><DataPage /></div>
      <div v-else-if="pageStore.currentPage === 'localSearch'"><LocalSearchPage /></div>
      <div v-else-if="pageStore.currentPage === 'aiSearch'"><AiSearchPage /></div>
      <div v-else-if="pageStore.currentPage === 'newsReport'"><NewsReportPage /></div>
    </main>
    <AppFooter />
    <AiAssistant :header-height="headerHeight" />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { usePageStore } from './stores/page'
import { useAiStore } from './stores/ai'
import AppHeader from './components/AppHeader.vue'
import NewsPage from './components/NewsPage.vue'
import DataPage from './components/DataPage.vue'
import LocalSearchPage from './components/LocalSearchPage.vue'
import AiSearchPage from './components/AiSearchPage.vue'
import NewsReportPage from './components/NewsReportPage.vue'
import AppFooter from './components/AppFooter.vue'
import AiAssistant from './components/AiAssistant.vue'

const pageStore = usePageStore()
const aiStore = useAiStore()
const headerRef = ref(null)
const headerHeight = ref(80)

// 实时获取 header 高度
import { watch } from 'vue'
watch(() => headerRef.value?.headerHeight, (h) => {
  if (h) headerHeight.value = h
}, { immediate: true })
</script>
