<script setup lang="ts">
// 確認ダイアログ（削除など、取り消せない操作の前に出す）。
// 誤操作を防ぐため、開いた時点のフォーカスは「キャンセル」。Esc・背景クリックもキャンセル扱い
import { ref, onMounted } from 'vue'

withDefaults(
  defineProps<{
    title: string
    message: string
    // 補足（例：「この操作は取り消せません。」）
    note?: string
    confirmLabel?: string
    cancelLabel?: string
    // 実行中はボタンを押せなくする
    busy?: boolean
  }>(),
  { note: '', confirmLabel: '削除', cancelLabel: 'キャンセル', busy: false },
)

const emit = defineEmits<{ confirm: []; cancel: [] }>()

const cancelButton = ref<HTMLButtonElement | null>(null)
onMounted(() => cancelButton.value?.focus())
</script>

<template>
  <div class="confirm-overlay" @click.self="emit('cancel')" @keydown.esc.stop="emit('cancel')">
    <div
      class="confirm"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      aria-describedby="confirm-message"
    >
      <h2 id="confirm-title" class="confirm-title">
        <svg class="confirm-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 3 2 20h20L12 3z"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linejoin="round"
          />
          <path d="M12 10v4" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          <circle cx="12" cy="17" r="1.2" fill="currentColor" />
        </svg>
        {{ title }}
      </h2>
      <p id="confirm-message" class="confirm-message">{{ message }}</p>
      <p v-if="note" class="confirm-note">{{ note }}</p>

      <div class="confirm-actions">
        <button
          ref="cancelButton"
          type="button"
          class="btn btn-ghost"
          :disabled="busy"
          @click="emit('cancel')"
        >
          {{ cancelLabel }}
        </button>
        <button type="button" class="btn btn-danger" :disabled="busy" @click="emit('confirm')">
          {{ busy ? '処理中…' : confirmLabel }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.confirm-overlay {
  position: fixed;
  inset: 0;
  background: rgba(9, 30, 66, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  /* 他のモーダル（z-index: 100）より手前に出す */
  z-index: 200;
}
.confirm {
  background: var(--surface);
  border-radius: 12px;
  padding: 22px 22px 18px;
  width: 100%;
  max-width: 400px;
  box-shadow: 0 12px 32px rgba(9, 30, 66, 0.3);
}
.confirm-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 14px;
  font-size: 17px;
  font-weight: 700;
  color: var(--danger);
}
.confirm-icon {
  width: 22px;
  height: 22px;
  flex-shrink: 0;
}
.confirm-message {
  margin: 0;
  font-size: 14px;
  word-break: break-word;
}
.confirm-note {
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--text-sub);
}
.confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 22px;
}
.btn {
  border: 1px solid transparent;
  border-radius: 8px;
  padding: 8px 18px;
  font: inherit;
  cursor: pointer;
}
.btn:disabled {
  opacity: 0.6;
  cursor: default;
}
.btn-ghost {
  background: var(--bg);
}
/* 削除ボタン：柔らかい赤の背景＋黒系の文字（文字とのコントラスト比は約 6:1） */
.btn-danger {
  background: #f28b82;
  color: var(--text);
  font-weight: 600;
}
.btn-danger:hover:not(:disabled) {
  background: #ec7369;
}
.btn-ghost:focus-visible,
.btn-danger:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}
</style>
