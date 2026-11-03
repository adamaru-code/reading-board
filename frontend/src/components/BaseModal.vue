<script setup lang="ts">
import { ref, useId, onMounted, onBeforeUnmount } from 'vue'
import { trapTab } from '../lib/focusTrap'

// モーダルの外枠（暗い背景・白い枠・見出し）。中身はスロットに入れる。
// 背景クリックで close。Esc でも close（closeOnEsc=false で無効。入力中のフォームを誤って閉じないため）
const props = withDefaults(
  defineProps<{ title: string; maxWidth?: number; closeOnEsc?: boolean }>(),
  { maxWidth: 440, closeOnEsc: true },
)
const emit = defineEmits<{ close: [] }>()

// 見出しとダイアログを aria-labelledby で結ぶ（部品ごとに重ならない id）
const titleId = useId()
const dialogEl = ref<HTMLElement | null>(null)

// Esc・Tab は画面全体で受ける（開いた直後はフォーカスがヘッダーのボタンに残っていることがあるため）。
// Tab は枠の中だけを回り、後ろの画面へは出ない。
// 中の確認ダイアログ（ConfirmDialog）は自分の Esc・Tab を stop するので、ここまで届かない
function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && props.closeOnEsc) emit('close')
  if (dialogEl.value && trapTab(event, dialogEl.value)) event.preventDefault()
}

// 開いたら中の autofocus の部品（タイトル欄など）、無ければ枠へフォーカスを移し、
// 閉じたら開く前の場所（開いたボタンなど）へ戻す。
// Chrome は、すでにどこか（クリックしたボタンなど）にフォーカスがあると autofocus を無視するので、ここで移す
let previouslyFocused: HTMLElement | null = null
onMounted(() => {
  previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
  if (!dialogEl.value?.contains(document.activeElement)) {
    const autofocusEl = dialogEl.value?.querySelector<HTMLElement>('[autofocus]')
    ;(autofocusEl ?? dialogEl.value)?.focus()
  }
  window.addEventListener('keydown', onKeydown)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  previouslyFocused?.focus()
})
</script>

<template>
  <div class="modal-overlay" @click.self="emit('close')">
    <div
      ref="dialogEl"
      class="modal"
      role="dialog"
      aria-modal="true"
      tabindex="-1"
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
/* 枠そのものにフォーカスしたときは枠線を出さない（中の入力欄・ボタンには出る） */
.modal:focus {
  outline: none;
}
.modal-title {
  font-size: 18px;
  font-weight: 700;
  margin: 0 0 12px;
}
</style>
