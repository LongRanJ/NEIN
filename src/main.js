import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './assets/main.css'

// 主题初始化：在 Vue 挂载前应用，避免闪烁
const savedTheme = localStorage.getItem('nein-theme') || 'light'
document.documentElement.setAttribute('data-theme', savedTheme)

const app = createApp(App)
app.use(createPinia())
app.mount('#app')
