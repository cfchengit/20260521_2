import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  base: '/20260521_2/'   // ← 改成你的 GitHub Repository 名稱
})
