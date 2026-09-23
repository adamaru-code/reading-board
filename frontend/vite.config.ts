import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173, // 固定（CLAUDE.md §8。/api は下記プロキシで同一オリジン化するため CORS 不要）
    proxy: {
      // フロントの相対パス /api/* を Rails(3000) に転送
      '/api': 'http://localhost:3000',
    },
  },
})
