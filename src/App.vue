<template>
  <div class="min-h-screen bg-bg-deep">
    <AppHeader />
    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
      <HeroBanner />
      <KeywordTags />
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        <div class="lg:col-span-2">
          <NewsCards />
        </div>
        <div class="lg:col-span-1">
          <DataCharts />
        </div>
      </div>
      <SearchPanel class="mt-8" />
    </main>
    <AppFooter />
    <AiAssistant />
  </div>
</template>

<script setup>
import AppHeader from './components/AppHeader.vue'
import HeroBanner from './components/HeroBanner.vue'
import KeywordTags from './components/KeywordTags.vue'
import NewsCards from './components/NewsCards.vue'
import DataCharts from './components/DataCharts.vue'
import SearchPanel from './components/SearchPanel.vue'
import AppFooter from './components/AppFooter.vue'
import AiAssistant from './components/AiAssistant.vue'
</script>
