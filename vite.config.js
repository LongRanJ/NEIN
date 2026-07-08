import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  base: process.env.NODE_ENV === 'production' ? '/NEIN/' : '/',
  server: {
    host: '0.0.0.0',
    port: 3000
  }
})
