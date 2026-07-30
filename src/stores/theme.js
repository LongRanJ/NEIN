import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

const THEME_KEY = 'nein-theme'

export const useThemeStore = defineStore('theme', () => {
  const theme = ref('light') // 'light' | 'dark'

  function init() {
    const saved = localStorage.getItem(THEME_KEY)
    if (saved === 'dark' || saved === 'light') {
      theme.value = saved
    }
    applyTheme()
  }

  function toggle() {
    theme.value = theme.value === 'dark' ? 'light' : 'dark'
  }

  function applyTheme() {
    document.documentElement.setAttribute('data-theme', theme.value)
  }

  watch(theme, (val) => {
    localStorage.setItem(THEME_KEY, val)
    applyTheme()
  })

  // Init immediately
  init()

  return { theme, toggle }
})
