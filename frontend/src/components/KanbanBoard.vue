<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { listAllBooks, updateBook, reorderBooks } from '../api/books'
import { logout } from '../api/session'
import { ApiError } from '../api/http'
import { BOOK_STATUSES, BOOK_GENRES, GENRE_LABELS } from '../types/book'
import type { Book, BookStatus, BookGenre, BookListParams, BookSortKey, SortDir } from '../types/book'
import type { User } from '../types/auth'
import BookCard from './BookCard.vue'
import BookFormModal from './BookFormModal.vue'
import AccountModal from './AccountModal.vue'
import AdminModal from './AdminModal.vue'
import { useKanbanColumns } from '../composables/useKanbanColumns'

defineProps<{ user: User }>()
const emit = defineEmits<{ logout: [] }>()

// カラムの見出しラベル
const COLUMN_LABELS: Record<BookStatus, string> = {
  want_to_read: '読みたい',
  reading: '読書中',
  read: '読了',
}

// 操作中に 401 になったらログイン画面へ戻す
function handleAuthError(e: unknown): boolean {
  if (e instanceof ApiError && e.status === 401) {
    emit('logout')
    return true
  }
  return false
}

async function onLogout() {
  try {
    await logout()
  } catch {
    // 失敗してもフロントの状態はログアウト扱いにする
  }
  emit('logout')
}

const accountModalOpen = ref(false)
const adminModalOpen = ref(false)

const loading = ref(true)
const error = ref<string | null>(null)

// ---------- 絞り込み ----------
const filters = reactive<{ genre: '' | BookGenre; author: string; tag: string }>({
  genre: '',
  author: '',
  tag: '',
})
// タグ選択肢は絞り込みで痩せないよう、未絞り込みの一覧から集める
const tagOptions = ref<string[]>([])
const hasFilters = computed(
  () => filters.genre !== '' || filters.author.trim() !== '' || filters.tag !== '',
)

function activeParams(): BookListParams {
  const params: BookListParams = {}
  if (filters.genre !== '') params.genre = filters.genre
  if (filters.author.trim() !== '') params.author = filters.author.trim()
  if (filters.tag !== '') params.tag = filters.tag
  return params
}

let authorTimer: ReturnType<typeof setTimeout> | undefined
function onAuthorInput() {
  clearTimeout(authorTimer)
  authorTimer = setTimeout(() => loadBooks(), 300) // 入力が落ち着いてから再取得
}

function clearFilters() {
  filters.genre = ''
  filters.author = ''
  filters.tag = ''
  loadBooks()
}

async function loadTagOptions() {
  try {
    const all = await listAllBooks()
    tagOptions.value = [...new Set(all.flatMap((b) => b.tags))].sort()
  } catch {
    // タグ選択肢の取得失敗はボード表示を妨げないので黙って諦める
  }
}

// ---------- 読了カラムの並び替え ----------
const SORT_KEYS: readonly { key: BookSortKey; label: string }[] = [
  { key: 'finished_on', label: '読了日' },
  { key: 'rating', label: '評価' },
  { key: 'registered_on', label: '登録日' },
  { key: 'duration_days', label: '所要日数' },
]

const readSort = reactive<{ key: BookSortKey; dir: SortDir }>({
  key: 'finished_on',
  dir: 'desc',
})

function toggleSortDir() {
  readSort.dir = readSort.dir === 'asc' ? 'desc' : 'asc'
}

// 各カラムを status ごとにページ取得する（読了カラムはサーバー側で並び替え）
const { columns, reloadAll, reloadColumn, hasMore, loadMore, findBook, moveBook } =
  useKanbanColumns(activeParams, (status) =>
    status === 'read' ? { sort: readSort.key, dir: readSort.dir } : {},
  )

function showLoadError(e: unknown) {
  if (handleAuthError(e)) return
  error.value =
    e instanceof ApiError ? e.message : '書籍の取得に失敗しました。時間をおいて再度お試しください。'
}

// keepLoaded: 編集後などに「もっと見る」で読み込んだ件数を保って取り直す（ボードは隠さない）
async function loadBooks(keepLoaded = false) {
  if (!keepLoaded) loading.value = true
  error.value = null
  try {
    await reloadAll(keepLoaded)
  } catch (e) {
    showLoadError(e)
  } finally {
    loading.value = false
  }
}

async function onLoadMore(status: BookStatus) {
  try {
    await loadMore(status)
  } catch (e) {
    showLoadError(e)
  }
}

onMounted(() => {
  loadBooks()
  loadTagOptions()
})

// 並びはサーバー側で決まるので、変更したら読了カラムを先頭から取り直す
watch(readSort, async () => {
  try {
    await reloadColumn('read')
  } catch (e) {
    showLoadError(e)
  }
})

// ---------- ドラッグ&ドロップでのステータス更新 ----------
const draggingId = ref<number | null>(null)
const dragOverStatus = ref<BookStatus | null>(null)

function onDragStart(event: DragEvent, book: Book) {
  draggingId.value = book.id
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', String(book.id))
  }
}

// ドラッグ直後に発火する click を抑止するためのフラグ
let justDragged = false

function onDragEnd() {
  draggingId.value = null
  dragOverStatus.value = null
  justDragged = true
  setTimeout(() => {
    justDragged = false
  }, 0)
}

// ドロップ位置（カーソル Y）から、移動カードを除いた挿入インデックスを求める
function dropIndex(section: HTMLElement, status: BookStatus, movedId: number, clientY: number): number {
  const displayed = columns[status].items
  const cardEls = Array.from(section.querySelectorAll<HTMLElement>('.card'))
  let index = 0
  for (let i = 0; i < cardEls.length; i++) {
    const book = displayed[i]
    if (!book || book.id === movedId) continue // 移動中のカード自身は無視
    const rect = cardEls[i].getBoundingClientRect()
    if (clientY < rect.top + rect.height / 2) break
    index++
  }
  return index
}

async function onDrop(status: BookStatus, event: DragEvent) {
  const id = draggingId.value
  draggingId.value = null
  dragOverStatus.value = null
  if (id === null) return

  const book = findBook(id)
  if (!book) return

  const statusChanged = book.status !== status
  // 読了カラムはキー（読了日など）で並べるため手動並び替えの対象外
  const sortedByKey = status === 'read'
  if (sortedByKey && !statusChanged) return

  const index = dropIndex(event.currentTarget as HTMLElement, status, id, event.clientY)

  // 楽観的更新：カードを移して status と position をローカルに反映（失敗時はサーバーから再取得）。
  // reorder には読み込み済みの分だけ渡す（残りはサーバーが既存順で後ろに詰める）
  const targetIds = moveBook(book, status, index)

  try {
    if (statusChanged) await updateBook(id, { status })
    if (sortedByKey) {
      await reloadColumn(status, true) // キー順の正しい位置に置き直す
    } else {
      await reorderBooks(targetIds)
    }
  } catch (e) {
    if (handleAuthError(e)) return
    error.value =
      e instanceof ApiError ? e.message : '並び替えに失敗しました。時間をおいて再度お試しください。'
    loadBooks(true) // 状態を確実に元へ戻す
  }
}

// ---------- 追加/編集/削除モーダル ----------
const modalOpen = ref(false)
const editingBook = ref<Book | null>(null)

function openAdd() {
  editingBook.value = null
  modalOpen.value = true
}

function openEdit(book: Book) {
  if (justDragged) return // ドラッグ直後のクリックは無視
  editingBook.value = book
  modalOpen.value = true
}

function closeModal() {
  modalOpen.value = false
  editingBook.value = null
}

// 保存/削除後はボードとタグ選択肢を再取得して反映
function onModalDone() {
  closeModal()
  loadBooks(true)
  loadTagOptions()
}
</script>

<template>
  <div class="app">
    <header class="app-header">
      <h1 class="app-title">📚 読書管理ボード</h1>
      <div class="filters">
        <input
          v-model="filters.author"
          type="search"
          class="filter-author"
          placeholder="著者名で絞り込み"
          aria-label="著者名で絞り込み"
          @input="onAuthorInput"
        />
        <label class="filter-field">
          ジャンル
          <select v-model="filters.genre" @change="loadBooks()">
            <option value="">すべて</option>
            <option v-for="g in BOOK_GENRES" :key="g" :value="g">{{ GENRE_LABELS[g] }}</option>
          </select>
        </label>
        <label class="filter-field">
          タグ
          <select v-model="filters.tag" @change="loadBooks()">
            <option value="">すべて</option>
            <option v-for="t in tagOptions" :key="t" :value="t">{{ t }}</option>
          </select>
        </label>
        <button v-if="hasFilters" type="button" class="clear-btn" @click="clearFilters">クリア</button>
        <button type="button" class="add-btn" @click="openAdd">＋ 追加</button>
        <span class="user-email" :title="user.email">{{ user.email }}</span>
        <button
          v-if="user.admin"
          type="button"
          class="header-btn"
          @click="adminModalOpen = true"
        >
          管理
        </button>
        <button type="button" class="header-btn" @click="accountModalOpen = true">
          アカウント
        </button>
        <button type="button" class="header-btn" @click="onLogout">ログアウト</button>
      </div>
    </header>

    <p v-if="loading" class="board-state">読み込み中…</p>

    <div v-else-if="error" class="board-state board-error" role="alert">
      <span>{{ error }}</span>
      <button type="button" class="retry-btn" @click="loadBooks()">再読み込み</button>
    </div>

    <main v-else class="board">
      <section
        v-for="status in BOOK_STATUSES"
        :key="status"
        class="column"
        :class="{ 'drag-over': dragOverStatus === status }"
        :data-status="status"
        @dragover.prevent="dragOverStatus = status"
        @dragleave="dragOverStatus = null"
        @drop.prevent="onDrop(status, $event)"
      >
        <div class="column-header">
          <span class="column-title">{{ COLUMN_LABELS[status] }}</span>
          <span class="column-count">{{ columns[status].total }}</span>
          <div v-if="status === 'read'" class="sort-control">
            <select v-model="readSort.key" aria-label="読了カラムの並び替え">
              <option v-for="s in SORT_KEYS" :key="s.key" :value="s.key">{{ s.label }}</option>
            </select>
            <button
              type="button"
              class="sort-dir"
              :aria-label="readSort.dir === 'asc' ? '昇順' : '降順'"
              @click="toggleSortDir"
            >
              {{ readSort.dir === 'asc' ? '▲' : '▼' }}
            </button>
          </div>
        </div>
        <div class="card-list">
          <BookCard
            v-for="book in columns[status].items"
            :key="book.id"
            :book="book"
            draggable="true"
            role="button"
            tabindex="0"
            :aria-label="`${book.title} を編集`"
            :class="{ dragging: draggingId === book.id }"
            @dragstart="onDragStart($event, book)"
            @dragend="onDragEnd"
            @click="openEdit(book)"
            @keydown.enter="openEdit(book)"
            @keydown.space.prevent="openEdit(book)"
          />
          <p v-if="columns[status].items.length === 0" class="column-empty">まだありません</p>
          <button
            v-if="hasMore(status)"
            type="button"
            class="load-more-btn"
            :disabled="columns[status].loadingMore"
            @click="onLoadMore(status)"
          >
            {{
              columns[status].loadingMore
                ? '読み込み中…'
                : `もっと見る（残り ${columns[status].total - columns[status].items.length} 件）`
            }}
          </button>
        </div>
      </section>
    </main>

    <BookFormModal
      v-if="modalOpen"
      :book="editingBook"
      @close="closeModal"
      @saved="onModalDone"
      @deleted="onModalDone"
    />

    <AccountModal
      v-if="accountModalOpen"
      @close="accountModalOpen = false"
      @unauthorized="emit('logout')"
      @deleted="emit('logout')"
    />

    <AdminModal
      v-if="adminModalOpen"
      :current-user-id="user.id"
      @close="adminModalOpen = false"
      @unauthorized="emit('logout')"
    />
  </div>
</template>

<style scoped>
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 24px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
}
.app-title {
  font-size: 20px;
  font-weight: 700;
}
.filters {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}
.filter-author {
  padding: 7px 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  font: inherit;
}
.filter-field {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--text-sub);
}
.filter-field select {
  padding: 6px 8px;
  border: 1px solid var(--border);
  border-radius: 6px;
  font: inherit;
}
.clear-btn {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 7px 12px;
  font: inherit;
  cursor: pointer;
}
.add-btn {
  background: var(--primary);
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 8px 16px;
  font: inherit;
  cursor: pointer;
}
.user-email {
  font-size: 12px;
  color: var(--text-sub);
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.header-btn {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 7px 12px;
  font: inherit;
  cursor: pointer;
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

.sort-control {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 4px;
}
.sort-control select {
  font-size: 11px;
  padding: 2px 4px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--surface);
}
.sort-dir {
  font-size: 11px;
  line-height: 1;
  padding: 3px 6px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--surface);
  cursor: pointer;
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

@media (max-width: 768px) {
  .board {
    grid-template-columns: 1fr;
  }
}
</style>
