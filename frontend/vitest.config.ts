import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.ts'

// vite.config（Vue プラグイン等）を引き継いでテスト設定だけ足す
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      include: ['src/**/__tests__/*.spec.ts'],
      restoreMocks: true,
      unstubGlobals: true,
    },
  }),
)
