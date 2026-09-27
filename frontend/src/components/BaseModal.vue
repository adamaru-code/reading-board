<script setup lang="ts">
import { useId } from 'vue'

// モーダルの外枠（暗い背景・白い枠・見出し）。中身はスロットに入れる。
// 背景クリックで close。Esc でも close（closeOnEsc=false で無効。入力中のフォームを誤って閉じないため）
const props = withDefaults(
  defineProps<{ title: string; maxWidth?: number; closeOnEsc?: boolean }>(),
  { maxWidth: 440, closeOnEsc: true },
)
const emit = defineEmits<{ close: [] }>()

// 見出しとダイアログを aria-labelledby で結ぶ（部品ごとに重ならない id）
const titleId = useId()

function onEsc() {
  if (props.closeOnEsc) emit('close')
}
</script>

<template>
  <div class="modal-overlay" @click.self="emit('close')" @keydown.esc="onEsc">
    <div
      class="modal"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="titleId"
      :style="{ maxWidth: `${maxWidth}px` }"
    >
      <h2 :id="titleId" class="modal-title">{{ title }}</h2>
      <slot />
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(9, 30, 66, 0.5);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 48px 16px;
  z-index: 100;
}
/* 画面より長い中身は枠の中でスクロールする */
.modal {
  background: var(--surface);
  border-radius: 10px;
  padding: 20px;
  width: 100%;
  max-height: calc(100svh - 96px);
  overflow-y: auto;
  box-shadow: 0 8px 24px rgba(9, 30, 66, 0.25);
}
.modal-title {
  font-size: 18px;
  font-weight: 700;
  margin: 0 0 12px;
}
</style>
