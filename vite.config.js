import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  base: '/aqi-tracker/'   // ← 改成你的 GitHub Repository 名稱
})
