<script setup lang="ts">
import { ref, reactive, watch, onMounted } from 'vue'
import { logout } from '../api/session'
import { listHiddenTags } from '../api/hiddenTags'
import { ApiError } from '../api/http'
import { BOOK_STATUSES, STATUS_LABELS } from '../types/book'
import type { Book, BookStatus, BookSortKey, SortDir, HiddenTag } from '../types/book'
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
import { useBoardFilters } from '../composables/useBoardFilters'
import { useBookStats } from '../composables/useBookStats'
import { useCardMove } from '../composables/useCardMove'

// view：board＝3 カラムのボード（/）、read＝読了一覧（/read）、stats＝統計（/stats）。
// どれもこの部品が受け持ち、ヘッダ・絞り込み・モーダル・読み込み済みの本を共有する（切り替えても条件が残る）。
// 絞り込み・統計・カードの移動は composables/ に分けてある（#370）
const props = withDefaults(defineProps<{ user: User; view?: BoardView }>(), { view: 'board' })
const emit = defineEmits<{ logout: [] }>()

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

// ---------- 絞り込み・タグ ----------
const {
  filters,
  tagOptions,
  frequentTags,
  activeFilterCount,
  activeParams,
  resetFilters,
  loadTagOptions,
} = useBoardFilters()

function clearFilters() {
  resetFilters()
  loadBooks()
}

// タグ候補から隠したタグ（書籍フォームで隠す・戻すと更新される）
const hiddenTags = ref<HiddenTag[]>([])

async function loadHiddenTags() {
  try {
    hiddenTags.value = await listHiddenTags()
  } catch {
    // 取得できなくても候補がすべて出るだけなので、ボード表示は妨げない
  }
}

// ---------- 統計（読了一覧の見出し・統計画面。そのどちらかを開いているときだけ取る） ----------
const { stats, statsFailed, loadStats, changeStatsYear } = useBookStats(
  () => props.view !== 'board',
  handleAuthError,
)

// CSV で本を取り込んだら、ボード・タグの選択肢・統計を取り直す
function onImported() {
  loadBooks(true)
  loadTagOptions()
  loadStats()
}

// タグの名前を変えた・まとめた・外したら、カードのタグ・タグの選択肢・隠した候補を取り直す
function onTagsChanged() {
  loadBooks(true)
  loadTagOptions()
  loadHiddenTags()
}

// ---------- 本の一覧（読了本の並び替えは、ボードの読了カラムと読了一覧で共通） ----------
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

// ボード → 読了一覧・統計に切り替えたとき
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

// ---------- カードの移動（ドラッグ・Option ＋ 矢印キー） ----------
const { draggingId, onDragStart, onDragEnd, wasJustDragged, onDrop, moveMessage, onCardMove } =
  useCardMove({
    columns,
    findBook,
    moveBook,
    reloadColumn,
    onAuthError: handleAuthError,
    onMoveFailed: (message) => {
      error.value = message
      loadBooks(true) // 状態を確実に元へ戻す
    },
  })

// ---------- 追加/編集/削除モーダル ----------
const modalOpen = ref(false)
const editingBook = ref<Book | null>(null)

function openAdd() {
  editingBook.value = null
  modalOpen.value = true
}

function openEdit(book: Book) {
  if (wasJustDragged()) return // ドラッグ直後のクリックは無視
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
      :active-filters="activeFilterCount"
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
        v-model:rating="filters.rating"
        :tag-options="tagOptions"
        @change="loadBooks()"
        @clear="clearFilters"
      />
    </BoardHeader>

    <!-- キーボードでカードを動かした結果の読み上げ（画面には出さない） -->
    <p class="visually-hidden" aria-live="assertive" aria-atomic="true">
      {{ moveMessage }}
    </p>

    <p v-if="loading" class="board-state">読み込み中…</p>

    <div v-else-if="error" class="board-state board-error" role="alert">
      <span>{{ error }}</span>
      <button type="button" class="retry-btn" @click="loadBooks()">再読み込み</button>
    </div>

    <StatsView
      v-else-if="view === 'stats'"
      :stats="stats"
      :failed="statsFailed"
      @change-year="changeStatsYear"
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
        :title="STATUS_LABELS[status]"
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
        @card-move="onCardMove"
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
      @covers-updated="loadBooks(true)"
      @tags-changed="onTagsChanged"
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
