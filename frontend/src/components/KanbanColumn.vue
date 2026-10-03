<script setup lang="ts">
import { ref, watch } from 'vue'
import type { Book, BookStatus } from '../types/book'
import BookCard from './BookCard.vue'

// ボードの 1 カラム（読みたい / 読書中 / 読了）：見出し・件数・カード一覧・「もっと見る」・ドロップ先。
// 見出しの右（読了カラムの並び替えなど）は header-actions スロットに親が入れる
const props = withDefaults(
  defineProps<{
    status: BookStatus
    title: string
    items: Book[]
    total: number
    hasMore: boolean
    loadingMore: boolean
    draggingId: number | null // ドラッグ中のカード（半透明にする）
    filtered?: boolean // 絞り込んで取った一覧か（0 件の文言を変える）
  }>(),
  { filtered: false },
)
const emit = defineEmits<{
  open: [book: Book] // カードをクリック / Enter / Space
  'card-dragstart': [event: DragEvent, book: Book]
  'card-dragend': []
  drop: [index: number] // このカラムの何番目に落とされたか（移動中のカード自身は数えない）
  'load-more': []
}>()

const dragOver = ref(false)
const sectionEl = ref<HTMLElement | null>(null)

// ドラッグが終わったら（キャンセルも含む）強調表示を消す
watch(
  () => props.draggingId,
  (id) => {
    if (id === null) dragOver.value = false
  },
)

// ドロップ位置（カーソル Y）から、移動カードを除いた挿入インデックスを求める
function dropIndex(movedId: number | null, clientY: number): number {
  const cardEls = Array.from(sectionEl.value?.querySelectorAll<HTMLElement>('.card') ?? [])
  let index = 0
  for (let i = 0; i < cardEls.length; i++) {
    const book = props.items[i]
    if (!book || book.id === movedId) continue // 移動中のカード自身は無視
    const rect = cardEls[i].getBoundingClientRect()
    if (clientY < rect.top + rect.height / 2) break
    index++
  }
  return index
}

function onDrop(event: DragEvent) {
  dragOver.value = false
  emit('drop', dropIndex(props.draggingId, event.clientY))
}
</script>

<template>
  <section
    ref="sectionEl"
    class="column"
    :class="{ 'drag-over': dragOver }"
    :data-status="status"
    @dragover.prevent="dragOver = true"
    @dragleave="dragOver = false"
    @drop.prevent="onDrop"
  >
    <div class="column-header">
      <span class="column-title">{{ title }}</span>
      <span class="column-count">{{ total }}</span>
      <slot name="header-actions" />
    </div>
    <div class="card-list">
      <BookCard
        v-for="book in items"
        :key="book.id"
        :book="book"
        draggable="true"
        role="button"
        tabindex="0"
        :aria-label="`${book.title} を編集`"
        :class="{ dragging: draggingId === book.id }"
        @dragstart="emit('card-dragstart', $event, book)"
        @dragend="emit('card-dragend')"
        @click="emit('open', book)"
        @keydown.enter="emit('open', book)"
        @keydown.space.prevent="emit('open', book)"
      />
      <p v-if="items.length === 0" class="column-empty">
        {{ filtered ? '当てはまる本はありません' : 'まだありません' }}
      </p>
      <button
        v-if="hasMore"
        type="button"
        class="load-more-btn"
        :disabled="loadingMore"
        @click="emit('load-more')"
      >
        {{ loadingMore ? '読み込み中…' : `もっと見る（残り ${total - items.length} 件）` }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.column {
  background: #ebecf0;
  border-radius: 10px;
  padding: 10px;
  min-height: 120px;
  border-top: 3px solid var(--col-accent, var(--border));
}
.column[data-status='want_to_read'] {
  --col-accent: var(--col-want);
  --col-badge: var(--col-want-strong);
}
.column[data-status='reading'] {
  --col-accent: var(--col-reading);
  --col-badge: var(--col-reading-strong);
}
.column[data-status='read'] {
  --col-accent: var(--col-read);
  --col-badge: var(--col-read-strong);
}

.column-header {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 4px 6px 10px;
}
.column-title {
  font-size: 14px;
  font-weight: 700;
}
/* 件数バッジ：カラムの線と同じ色味の地に白い太字 */
.column-count {
  font-size: 12px;
  font-weight: 600;
  color: #fff;
  background: var(--col-badge, var(--text-sub));
  border-radius: 999px;
  padding: 1px 8px;
}

.card-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 40px;
}

/* ドラッグ&ドロップの視覚フィードバック */
.column.drag-over .card-list {
  outline: 2px dashed var(--col-accent);
  outline-offset: 2px;
  border-radius: 6px;
}
.card-list :deep(.card) {
  cursor: grab;
}
.card-list :deep(.card.dragging) {
  opacity: 0.5;
  cursor: grabbing;
}

.load-more-btn {
  width: 100%;
  padding: 8px;
  border: 1px dashed var(--border);
  border-radius: 6px;
  background: transparent;
  color: var(--text-sub);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}
.load-more-btn:hover:not(:disabled) {
  background: var(--surface);
}
.load-more-btn:disabled {
  cursor: default;
}
.column-empty {
  color: var(--text-sub);
  font-size: 13px;
  padding: 6px;
}
</style>
