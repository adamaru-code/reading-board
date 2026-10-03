<script setup lang="ts">
import { computed } from 'vue'
import type { Book, BookStats } from '../types/book'
import { GENRE_LABELS, MEDIA_TYPE_LABELS } from '../types/book'
import { READ_LIST_PAGE_SIZE } from '../composables/useKanbanColumns'

// 読了一覧（/read）：読了本を 1 冊 1 行で左右 2 段に並べる。左の段から縦に埋めて右の段へ続け、各段の上に列の見出しを付ける。
// 見出しの右（並び替え）は header-actions スロットに親が入れる。props・emit は KanbanColumn.vue にそろえている
const props = defineProps<{
  items: Book[]
  total: number
  hasMore: boolean
  loadingMore: boolean
  stats?: BookStats | null // 今年・今月の読了冊数（取得前・取得失敗は null で出さない）
  filtered?: boolean // 絞り込んで取った一覧か（0 件の文言を変える）
}>()
const emit = defineEmits<{
  open: [book: Book] // 行をクリック / Enter / Space
  'load-more': []
}>()

// 列の見出しと、見出し・値のそろえ方（タイトル・著者・ジャンルは左、形態・評価・読了日は列の中央、日数は数字の桁をそろえて右）。
// 形態の列（雑誌バッジ）は見出しの文字を出さない
const COLUMN_HEADINGS: readonly { label: string; align: 'left' | 'center' | 'right' }[] = [
  { label: 'タイトル', align: 'left' },
  { label: '著者', align: 'left' },
  { label: 'ジャンル', align: 'left' },
  { label: '', align: 'center' },
  { label: '評価', align: 'center' },
  { label: '読了日', align: 'center' },
  { label: '日数', align: 'right' },
]

// 左の段を LEFT_PANE_MIN 冊まで先に埋めてから右の段へ（本が少なくても横に並ばず、上から縦に増える）。
// 一度に読み込む 50 冊までは左 25 冊・右に残り（50 冊で左右 25 冊ずつ）。「もっと見る」で 51 冊以上になったら
// 前半を左、後半を右（100 冊で 50・50。左が 1 冊多いことがある）
const LEFT_PANE_MIN = READ_LIST_PAGE_SIZE / 2
const panes = computed(() => {
  const count = props.items.length
  const left = Math.max(Math.ceil(count / 2), Math.min(count, LEFT_PANE_MIN))
  return [props.items.slice(0, left), props.items.slice(left)].filter((pane) => pane.length > 0)
})

// 評価（1〜5）を ★ の on/off 配列に変換（BookCard.vue と同じ）。未評価は空（画面には「—」を出す）
function stars(rating: number | null): boolean[] {
  if (!rating) return []
  return [1, 2, 3, 4, 5].map((n) => n <= rating)
}

// 所要日数の表示。開始日と読了日が同じ本は「0日」だと読んでいないように見えるので「当日」
function durationText(days: number | null): string {
  if (days === null) return ''
  return days === 0 ? '当日' : `${days}日`
}
</script>

<template>
  <section class="read-list" aria-labelledby="read-list-title">
    <div class="list-header">
      <h2 id="read-list-title" class="list-title">読了</h2>
      <span class="list-count">{{ total }}</span>
      <span v-if="stats" class="list-stats">
        今年 {{ stats.finished_this_year }} 冊・今月 {{ stats.finished_this_month }} 冊
      </span>
      <slot name="header-actions" />
    </div>

    <p v-if="items.length === 0" class="list-empty">
      {{ filtered ? '当てはまる本はありません' : 'まだありません' }}
    </p>
    <div v-else class="panes">
      <div v-for="(pane, i) in panes" :key="i" class="pane">
        <div class="row-head" aria-hidden="true">
          <span v-for="(heading, n) in COLUMN_HEADINGS" :key="n" :class="`align-${heading.align}`">
            {{ heading.label }}
          </span>
        </div>
        <ul class="rows">
          <li
            v-for="book in pane"
            :key="book.id"
            class="row"
            role="button"
            tabindex="0"
            :aria-label="`${book.title} を編集`"
            @click="emit('open', book)"
            @keydown.enter="emit('open', book)"
            @keydown.space.prevent="emit('open', book)"
          >
            <span class="row-title" :title="book.title">{{ book.title }}</span>
            <span class="row-author" :title="book.author ?? ''">{{ book.author }}</span>
            <span class="row-genre">
              <span
                class="genre-badge"
                :class="`genre-${book.genre}`"
                :title="GENRE_LABELS[book.genre]"
              >
                {{ GENRE_LABELS[book.genre] }}
              </span>
            </span>
            <span class="row-media">
              <span v-if="book.media_type === 'magazine'" class="media-badge">
                {{ MEDIA_TYPE_LABELS.magazine }}
              </span>
            </span>
            <span
              class="row-stars"
              :aria-label="book.rating ? `評価 ${book.rating} / 5` : '未評価'"
            >
              <span v-for="(on, n) in stars(book.rating)" :key="n" :class="on ? 'on' : 'off'"
                >★</span
              >
              <span v-if="!book.rating" class="no-rating" aria-hidden="true">—</span>
            </span>
            <span class="row-date">{{ book.finished_on }}</span>
            <span class="row-days">{{ durationText(book.duration_days) }}</span>
          </li>
        </ul>
      </div>
    </div>

    <button
      v-if="hasMore"
      type="button"
      class="load-more-btn"
      :disabled="loadingMore"
      @click="emit('load-more')"
    >
      {{ loadingMore ? '読み込み中…' : `もっと見る（残り ${total - items.length} 件）` }}
    </button>
  </section>
</template>

<style scoped>
/* 外枠はボードの読了カラム（KanbanColumn.vue）と同じ灰色の地に緑の線 */
.read-list {
  margin: 24px;
  background: #ebecf0;
  border-radius: 10px;
  padding: 10px 12px 12px;
  border-top: 3px solid var(--col-read);
}
.list-header {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 8px;
  padding: 4px 4px 10px;
}
.list-title {
  font-size: 14px;
  font-weight: 700;
}
.list-count {
  font-size: 12px;
  font-weight: 600;
  color: #fff;
  background: var(--col-read-strong);
  border-radius: 999px;
  padding: 1px 8px;
}
.list-stats {
  font-size: 12px;
  color: var(--text-sub);
}
.list-empty {
  color: var(--text-sub);
  font-size: 13px;
  padding: 6px;
  margin: 0;
}

/* 左右 2 段 */
.panes {
  /* 列の幅（タイトル｜著者｜ジャンル｜形態｜評価｜読了日｜日数）。見出しと行で共通にする。
     見出し（11px）と行（13px）で文字の大きさが違うので、文字の大きさで変わる em ではなく、
     どこでも同じ長さになる rem で書く（em だと見出しの列が狭くなり、見出しが値より右にずれる） */
  --read-columns: minmax(0, 1fr) minmax(0, 5.75rem) minmax(0, 6.25rem) 2.25rem 3.75rem 4.75rem
    2.5rem;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  align-items: start;
}
.rows {
  list-style: none;
  margin: 0;
  padding: 0;
}
/* 見出しと行で同じ列幅（--read-columns）にして、見出しの真下に値をそろえる */
.row,
.row-head {
  display: grid;
  grid-template-columns: var(--read-columns);
  align-items: center;
  gap: 10px;
}
.row-head {
  padding: 2px 10px 6px;
  margin-bottom: 6px;
  font-size: 11px;
  font-weight: 700;
  color: var(--text-sub);
  white-space: nowrap;
  border-bottom: 1px solid #c1c7d0;
}
.row-head .align-center {
  text-align: center;
}
.row-head .align-right {
  text-align: right;
}
.row {
  background: var(--surface);
  border-radius: 6px;
  padding: 6px 10px;
  margin-bottom: 4px;
  box-shadow: 0 1px 1px rgba(9, 30, 66, 0.12);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
}
.row:hover {
  background: #f7f8f9;
}
.row:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 1px;
}
.row-title,
.row-author {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.row-title {
  font-weight: 600;
}
.row-author {
  color: var(--text-sub);
  font-size: 12px;
}
/* 形態・評価・読了日は列の中央（見出しと同じ位置）。著者・ジャンルは左 */
.row-media,
.row-stars,
.row-date {
  text-align: center;
}
.row-genre {
  min-width: 0;
}
/* 長いジャンル名は … で切る（色は style.css の .genre-*） */
.row-genre .genre-badge {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  vertical-align: middle;
}
.row-stars {
  font-size: 12px;
  letter-spacing: -1px;
  white-space: nowrap;
}
.row-stars .on {
  color: var(--star);
}
.row-stars .off {
  color: var(--star-empty);
}
/* 未評価：評価を付けていないことが分かるよう、薄い灰色の「—」 */
.row-stars .no-rating {
  color: var(--star-empty);
}
.row-date,
.row-days {
  font-size: 12px;
  color: var(--text-sub);
  white-space: nowrap;
}
.row-days {
  text-align: right;
}
.row-days {
  color: var(--col-read-strong);
  font-weight: 600;
}

.load-more-btn {
  display: block;
  width: 100%;
  margin-top: 8px;
  padding: 8px;
  border: 1px dashed #c1c7d0;
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

/* スマホ幅：1 段にして見出しを消し、1 冊を「タイトル」と「著者・ジャンル・雑誌・★・日付・日数」の 2 行にする */
@media (max-width: 768px) {
  .read-list {
    margin: 16px;
  }
  .panes {
    grid-template-columns: 1fr;
    gap: 0;
  }
  .row-head {
    display: none;
  }
  .row {
    grid-template-columns: minmax(0, 1fr) minmax(0, auto) auto auto auto auto;
    grid-template-areas:
      'title title title title title title'
      'author genre media stars date days';
    row-gap: 2px;
  }
  .row-media,
  .row-stars,
  .row-date {
    text-align: left;
  }
  .row-title {
    grid-area: title;
  }
  .row-author {
    grid-area: author;
  }
  .row-genre {
    grid-area: genre;
  }
  .row-media {
    grid-area: media;
  }
  .row-stars {
    grid-area: stars;
  }
  .row-date {
    grid-area: date;
  }
  .row-days {
    grid-area: days;
  }
}
</style>
