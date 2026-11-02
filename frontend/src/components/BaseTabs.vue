<script setup lang="ts" generic="K extends string">
import { ref, useId } from 'vue'

// タブの切り替え（アカウント・管理のモーダルで使う）。中身はスロットに入れる。
// キーボード：← → で前・次のタブ（端では反対の端へ回る）、Home / End で最初・最後。
// Tab ではタブの列に 1 回だけ止まり（選んでいるタブだけ tabindex="0"）、次の Tab で中身へ進む
const props = defineProps<{ tabs: readonly { key: K; label: string }[] }>()
const selected = defineModel<K>({ required: true })

// タブと中身を id で結ぶ（読み上げで「パスワード変更、タブ、選択済み」と中身がつながる）
const uid = useId()
const tabId = (key: K) => `${uid}-tab-${key}`
const panelId = `${uid}-panel`

// v-for の ref の配列は並び順が保証されないので、タブの列から順に取り出す
const tablistEl = ref<HTMLElement | null>(null)

function select(index: number) {
  const tab = props.tabs[index]
  if (!tab) return
  selected.value = tab.key
  tablistEl.value?.querySelectorAll<HTMLElement>('[role="tab"]')[index]?.focus()
}

function onKeydown(event: KeyboardEvent, index: number) {
  const last = props.tabs.length - 1
  const next: Record<string, number> = {
    ArrowRight: index === last ? 0 : index + 1,
    ArrowLeft: index === 0 ? last : index - 1,
    Home: 0,
    End: last,
  }
  if (!(event.key in next)) return
  event.preventDefault()
  select(next[event.key]!)
}
</script>

<template>
  <div ref="tablistEl" class="tabs" role="tablist">
    <button
      v-for="(tab, i) in tabs"
      :id="tabId(tab.key)"
      :key="tab.key"
      type="button"
      role="tab"
      class="tab"
      :aria-selected="selected === tab.key"
      :aria-controls="panelId"
      :tabindex="selected === tab.key ? 0 : -1"
      @click="selected = tab.key"
      @keydown="onKeydown($event, i)"
    >
      {{ tab.label }}
    </button>
  </div>
  <div :id="panelId" role="tabpanel" :aria-labelledby="tabId(selected)">
    <slot />
  </div>
</template>

<style scoped>
.tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 16px;
  border-bottom: 1px solid var(--border);
}
.tab {
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  padding: 6px 10px;
  font: inherit;
  font-size: 13px;
  color: var(--text-sub);
  white-space: nowrap;
  cursor: pointer;
}
.tab[aria-selected='true'] {
  color: var(--primary);
  border-bottom-color: var(--primary);
  font-weight: 600;
}
</style>
