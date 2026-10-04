<script setup lang="ts">
import { ref, reactive, watch, onMounted } from 'vue'
import { listAllBooks, updateBook, reorderBooks, getBookStats } from '../api/books'
import { logout } from '../api/session'
import { listHiddenTags } from '../api/hiddenTags'
import { ApiError } from '../api/http'
import { BOOK_STATUSES } from '../types/book'
import type {
  Book,
  BookStatus,
  BookGenre,
  BookListParams,
  BookSortKey,
  SortDir,
  HiddenTag,
  BookStats,
} from '../types/book'
import type { BoardView } from '../types/view'
import type { User } from '../types/auth'
import BoardHeader from './BoardHeader.vue'
import BoardFilters from './BoardFilters.vue'
import KanbanColumn from './KanbanColumn.vue'
import ReadList from './ReadList.vue'
import ReadSortControl from './ReadSortControl.vue'
import StatsView from './StatsView.vue'
import BookFormModal from './BookFormModal.vue'
import AccountModal from './AccountModal.vue'
import AdminModal from './AdminModal.vue'
import { useKanbanColumns, READ_LIST_PAGE_SIZE } from '../composables/useKanbanColumns'

// view：board＝3 カラムのボード（/）、read＝読了一覧（/read）。
// どちらもこの部品が受け持ち、ヘッダ・絞り込み・モーダル・読み込み済みの本を共有する（切り替えても条件が残る）
const props = withDefaults(defineProps<{ user: User; view?: BoardView }>(), { view: 'board' })
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
const filters = reactive<{ genre: '' | BookGenre; keyword: string; tag: string }>({
  genre: '',
  keyword: '',
  tag: '',
})
// タグ選択肢は絞り込みで痩せないよう、未絞り込みの一覧から集める
const tagOptions = ref<string[]>([])
// 自分が付けたタグをよく使う順に（書籍フォームのタグ候補に使う）
const frequentTags = ref<string[]>([])
// タグ候補から隠したタグ（書籍フォームで隠す・戻すと更新される）
const hiddenTags = ref<HiddenTag[]>([])

// 読了冊数（読了一覧の見出しと統計画面に出す。そのどちらかを開いているときだけ取る）
const stats = ref<BookStats | null>(null)
const statsFailed = ref(false)
// 統計画面で選んだ年（未選択なら今年。保存・削除のあとも選んだ年のまま取り直す）
const statsYear = ref<number | undefined>(undefined)

async function loadStats() {
  if (props.view === 'board') return
  try {
    stats.value = await getBookStats(statsYear.value)
    statsFailed.value = false
  } catch (e) {
    if (handleAuthError(e)) return
    // 読了一覧では冊数が出ないだけ（一覧の表示は妨げない）。統計画面ではお知らせを出す
    statsFailed.value = true
  }
}

// CSV で本を取り込んだら、ボード・タグの選択肢・統計を取り直す
function onImported() {
  loadBooks(true)
  loadTagOptions()
  loadStats()
}

function onStatsYearChange(year: number) {
  statsYear.value = year
  loadStats()
}

async function loadHiddenTags() {
  try {
    hiddenTags.value = await listHiddenTags()
  } catch {
    // 取得できなくても候補がすべて出るだけなので、ボード表示は妨げない
  }
}
function activeParams(): BookListParams {
  const params: BookListParams = {}
  if (filters.genre !== '') params.genre = filters.genre
  if (filters.keyword.trim() !== '') params.q = filters.keyword.trim()
  if (filters.tag !== '') params.tag = filters.tag
  return params
}

function clearFilters() {
  filters.genre = ''
  filters.keyword = ''
  filters.tag = ''
  loadBooks()
}

async function loadTagOptions() {
  try {
    const all = await listAllBooks()
    const counts = new Map<string, number>()
    for (const tag of all.flatMap((b) => b.tags)) counts.set(tag, (counts.get(tag) ?? 0) + 1)
    tagOptions.value = [...counts.keys()].sort()
    frequentTags.value = [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ja'))
      .map(([tag]) => tag)
  } catch {
    // タグ選択肢の取得失敗はボード表示を妨げないので黙って諦める
  }
}

// ---------- 読了本の並び替え（ボードの読了カラムと読了一覧で共通） ----------
const readSort = reactive<{ key: BookSortKey; dir: SortDir }>({
  key: 'finished_on',
  dir: 'desc',
})

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

// 今の一覧が絞り込んで取ったものか（0 件のときの文言を「当てはまる本はありません」にする）。
// 入力中の欄ではなく、実際に取り直した条件で決める
const filtered = ref(false)

// keepLoaded: 編集後などに「もっと見る」で読み込んだ件数を保って取り直す（ボードは隠さない）
async function loadBooks(keepLoaded = false) {
  if (!keepLoaded) loading.value = true
  error.value = null
  filtered.value = Object.keys(activeParams()).length > 0
  try {
    await reloadAll(keepLoaded)
  } catch (e) {
    showLoadError(e)
  } finally {
    loading.value = false
  }
  // 先頭 20 件に戻したとき（最初の表示・絞り込みの変更）、読了一覧なら 50 件まで足す
  if (!keepLoaded) fillReadList()
}

async function onLoadMore(status: BookStatus, pageSize?: number) {
  try {
    await loadMore(status, pageSize)
  } catch (e) {
    showLoadError(e)
  }
}

// 読了一覧では一度に READ_LIST_PAGE_SIZE 件まで出す。ボードで 20 件だけ読み込んでいたら、足りない分を足す
function fillReadList() {
  if (props.view !== 'read' || loading.value || error.value) return
  const shortage = READ_LIST_PAGE_SIZE - columns.read.items.length
  if (shortage > 0 && hasMore('read')) onLoadMore('read', shortage)
}

onMounted(() => {
  loadBooks()
  loadTagOptions()
  loadHiddenTags()
  loadStats()
})

// ボード → 読了一覧に切り替えたとき
watch(
  () => props.view,
  () => {
    fillReadList()
    loadStats()
  },
)

// 並びはサーバー側で決まるので、変更したら読了カラムを先頭から取り直す（読了一覧なら 50 件まで）
watch(readSort, async () => {
  try {
    await reloadColumn('read')
    fillReadList()
  } catch (e) {
    showLoadError(e)
  }
})

// ---------- ドラッグ&ドロップでのステータス更新 ----------
const draggingId = ref<number | null>(null)

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
  justDragged = true
  setTimeout(() => {
    justDragged = false
  }, 0)
}

// index：落とされたカラム内の位置（KanbanColumn が移動中のカードを除いて数える）
async function onDrop(status: BookStatus, index: number) {
  const id = draggingId.value
  draggingId.value = null
  if (id === null) return

  const book = findBook(id)
  if (!book) return

  const statusChanged = book.status !== status
  // 読了カラムはキー（読了日など）で並べるため手動並び替えの対象外
  const sortedByKey = status === 'read'
  if (sortedByKey && !statusChanged) return

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
  loadStats()
}

// 削除後は、その本だけに付いていたタグの「隠した候補」もサーバーで消えるので取り直す
function onBookDeleted() {
  onModalDone()
  loadHiddenTags()
}
</script>

<template>
  <div class="app">
    <BoardHeader
      :user="user"
      :view="view"
      @add="openAdd"
      @admin="adminModalOpen = true"
      @account="accountModalOpen = true"
      @logout="onLogout"
    >
      <!-- 統計は絞り込みに連動しないので、統計画面では絞り込みを出さない -->
      <BoardFilters
        v-if="view !== 'stats'"
        v-model:keyword="filters.keyword"
        v-model:genre="filters.genre"
        v-model:tag="filters.tag"
        :tag-options="tagOptions"
        @change="loadBooks()"
        @clear="clearFilters"
      />
    </BoardHeader>

    <p v-if="loading" class="board-state">読み込み中…</p>

    <div v-else-if="error" class="board-state board-error" role="alert">
      <span>{{ error }}</span>
      <button type="button" class="retry-btn" @click="loadBooks()">再読み込み</button>
    </div>

    <StatsView
      v-else-if="view === 'stats'"
      :stats="stats"
      :failed="statsFailed"
      @change-year="onStatsYearChange"
    />

    <main v-else-if="view === 'read'">
      <ReadList
        :items="columns.read.items"
        :total="columns.read.total"
        :has-more="hasMore('read')"
        :loading-more="columns.read.loadingMore"
        :filtered="filtered"
        :stats="stats"
        @open="openEdit"
        @load-more="onLoadMore('read', READ_LIST_PAGE_SIZE)"
      >
        <template #header-actions>
          <ReadSortControl v-model:sort-key="readSort.key" v-model:dir="readSort.dir" />
        </template>
      </ReadList>
    </main>

    <main v-else class="board">
      <KanbanColumn
        v-for="status in BOOK_STATUSES"
        :key="status"
        :status="status"
        :title="COLUMN_LABELS[status]"
        :items="columns[status].items"
        :total="columns[status].total"
        :has-more="hasMore(status)"
        :loading-more="columns[status].loadingMore"
        :filtered="filtered"
        :title-to="status === 'read' ? { name: 'read' } : undefined"
        :title-link-label="status === 'read' ? '読了一覧を開く' : undefined"
        :dragging-id="draggingId"
        @open="openEdit"
        @card-dragstart="onDragStart"
        @card-dragend="onDragEnd"
        @drop="onDrop(status, $event)"
        @load-more="onLoadMore(status)"
      >
        <template v-if="status === 'read'" #header-actions>
          <ReadSortControl v-model:sort-key="readSort.key" v-model:dir="readSort.dir" />
        </template>
      </KanbanColumn>
    </main>

    <BookFormModal
      v-if="modalOpen"
      :book="editingBook"
      :known-tags="frequentTags"
      v-model:hidden-tags="hiddenTags"
      @close="closeModal"
      @saved="onModalDone"
      @deleted="onBookDeleted"
    />

    <AccountModal
      v-if="accountModalOpen"
      @close="accountModalOpen = false"
      @unauthorized="emit('logout')"
      @deleted="emit('logout')"
      @imported="onImported"
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

@media (max-width: 768px) {
  .board {
    grid-template-columns: 1fr;
  }
}
</style>
