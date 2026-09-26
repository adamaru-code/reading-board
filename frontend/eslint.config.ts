// ESLint の設定（Vue 公式の雛形 create-vue と同じ構成）
// - eslint-plugin-vue：Vue の書き方のルール
// - @vue/eslint-config-typescript：TypeScript のルール
// - @vitest/eslint-plugin：テストコード用のルール
// - skipFormatting：見た目の整形は Prettier に任せ、ESLint では扱わない
import { globalIgnores } from 'eslint/config'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'
import pluginVue from 'eslint-plugin-vue'
import pluginVitest from '@vitest/eslint-plugin'
import skipFormatting from '@vue/eslint-config-prettier/skip-formatting'

export default defineConfigWithVueTs(
  {
    name: 'app/files-to-lint',
    files: ['**/*.{ts,mts,tsx,vue}'],
  },

  globalIgnores(['**/dist/**', '**/coverage/**']),

  pluginVue.configs['flat/essential'],
  vueTsConfigs.recommended,

  {
    ...pluginVitest.configs.recommended,
    files: ['src/**/__tests__/*'],
  },

  skipFormatting,
)
