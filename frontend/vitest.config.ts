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
      // テストのカバレッジ（どの行・分かれ道が動いたか）。npm run test:coverage のときだけ測り、coverage/index.html に出す。
      // 測るだけで、何 % 以上という合格条件は付けない
      coverage: {
        provider: 'v8',
        include: ['src/**/*.{ts,vue}'],
        // テスト・型だけのファイル（実行されるコードが無い）・起動するだけの main.ts は数えない
        exclude: ['src/**/__tests__/**', 'src/types/**', 'src/main.ts'],
        reporter: ['text', 'html'],
      },
    },
  }),
)
