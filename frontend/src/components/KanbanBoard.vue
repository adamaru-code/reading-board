<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { listBooks } from '../api/books'
import { ApiError } from '../api/http'
import { BOOK_STATUSES } from '../types/book'
import type { Book, BookStatus } from '../types/book'
import BookCard from './BookCard.vue'

// カラムの見出しラベル
const COLUMN_LABELS: Record<BookStatus, string> = {
  want_to_read: '読みたい',
  reading: '読書中',
  read: '読了',
}

const books = ref<Book[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

// status ごとに書籍を振り分ける
const booksByStatus = computed<Record<BookStatus, Book[]>>(() => {
  const grouped: Record<BookStatus, Book[]> = {
    want_to_read: [],
    reading: [],
    read: [],
  }
  for (const book of books.value) {
    grouped[book.status].push(book)
  }
  return grouped
})

async function loadBooks() {
  loading.value = true
  error.value = null
  try {
    books.value = await listBooks()
  } catch (e) {
    error.value =
      e instanceof ApiError ? e.message : '書籍の取得に失敗しました。時間をおいて再度お試しください。'
  } finally {
    loading.value = false
  }
}

onMounted(loadBooks)
</script>

<template>
  <div class="app">
    <header class="app-header">
      <h1 class="app-title">📚 読書管理ボード</h1>
    </header>

    <p v-if="loading" class="board-state">読み込み中…</p>

    <div v-else-if="error" class="board-state board-error" role="alert">
      <span>{{ error }}</span>
      <button type="button" class="retry-btn" @click="loadBooks">再読み込み</button>
    </div>

    <main v-else class="board">
      <section
        v-for="status in BOOK_STATUSES"
        :key="status"
        class="column"
        :data-status="status"
      >
        <div class="column-header">
          <span class="column-title">{{ COLUMN_LABELS[status] }}</span>
          <span class="column-count">{{ booksByStatus[status].length }}</span>
        </div>
        <div class="card-list">
          <BookCard v-for="book in booksByStatus[status]" :key="book.id" :book="book" />
          <p v-if="booksByStatus[status].length === 0" class="column-empty">まだありません</p>
        </div>
      </section>
    </main>
  </div>
</template>

<style scoped>
.app-header {
  padding: 14px 24px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
}
.app-title {
  font-size: 20px;
  font-weight: 700;
}

.board-state {
  padding: 24px;
  color: var(--text-sub);
}
.board-error {
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--danger);
}
.retry-btn {
  border: 1px solid var(--border);
  background: var(--surface);
  border-radius: 6px;
  padding: 4px 12px;
  cursor: pointer;
}

.board {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  padding: 24px;
  align-items: start;
}

.column {
  background: #ebecf0;
  border-radius: 10px;
  padding: 10px;
  min-height: 120px;
  border-top: 3px solid var(--col-accent, var(--border));
}
.column[data-status='want_to_read'] {
  --col-accent: var(--col-want);
}
.column[data-status='reading'] {
  --col-accent: var(--col-reading);
}
.column[data-status='read'] {
  --col-accent: var(--col-read);
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
.column-count {
  font-size: 12px;
  color: var(--text-sub);
  background: #dfe1e6;
  border-radius: 999px;
  padding: 1px 8px;
}

.card-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 40px;
}
.column-empty {
  color: var(--text-sub);
  font-size: 13px;
  padding: 6px;
}

@media (max-width: 768px) {
  .board {
    grid-template-columns: 1fr;
  }
}
</style>
