import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useTimeFilterStore = defineStore('timeFilter', () => {
  // 默认：近7天
  const endDate = ref(formatDate(new Date()))
  const startDate = ref(formatDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)))

  // 快捷选项
  function setPreset(days) {
    endDate.value = formatDate(new Date())
    startDate.value = formatDate(new Date(Date.now() - days * 24 * 60 * 60 * 1000))
  }

  // 自定义日期
  function setRange(start, end) {
    startDate.value = start
    endDate.value = end
  }

  // 格式化显示
  const displayRange = computed(() => {
    return `${startDate.value} ~ ${endDate.value}`
  })

  return { startDate, endDate, displayRange, setPreset, setRange }
})

function formatDate(date) {
  return date.toISOString().split('T')[0]
}
