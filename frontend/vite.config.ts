import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173, // 固定（別ポートだと Rails 側の CORS 許可が効かない）
    proxy: {
      // フロントの相対パス /api/* を Rails(3000) に転送
      '/api': 'http://localhost:3000',
    },
  },
})
