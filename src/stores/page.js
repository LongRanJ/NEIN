import { defineStore } from 'pinia'
import { ref } from 'vue'

export const usePageStore = defineStore('page', () => {
  // 当前页面：news | data | search
  const currentPage = ref('news')

  function setPage(page) {
    currentPage.value = page
  }

  return { currentPage, setPage }
})
