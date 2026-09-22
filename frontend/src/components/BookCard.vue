<script setup lang="ts">
import type { Book } from '../types/book'
import { GENRE_LABELS, MEDIA_TYPE_LABELS } from '../types/book'

const props = defineProps<{ book: Book }>()

// 評価（1〜5）を ★ の on/off 配列に変換。未評価は表示しない。
const stars = () => {
  const rating = props.book.rating
  if (!rating) return []
  return [1, 2, 3, 4, 5].map((n) => n <= rating)
}

// カードが居るカラム（status）に対応する日付ラベルと値
const columnDate = () => {
  const b = props.book
  switch (b.status) {
    case 'want_to_read':
      return b.registered_on ? { label: '登録', on: b.registered_on } : null
    case 'reading':
      return b.started_on ? { label: '開始', on: b.started_on } : null
    case 'read':
      return b.finished_on ? { label: '読了', on: b.finished_on } : null
  }
}
</script>

<template>
  <article class="card">
    <div class="card-badges">
      <span class="genre-badge" :class="`genre-${book.genre}`">{{ GENRE_LABELS[book.genre] }}</span>
      <span v-if="book.media_type === 'magazine'" class="media-badge">
        {{ MEDIA_TYPE_LABELS.magazine }}
      </span>
    </div>
    <div class="card-title">{{ book.title }}</div>
    <div v-if="book.author" class="card-author">{{ book.author }}</div>
    <div v-if="book.rating" class="card-stars" :aria-label="`評価 ${book.rating} / 5`">
      <span v-for="(on, i) in stars()" :key="i" :class="on ? 'on' : 'off'">★</span>
    </div>
    <div v-if="book.tags.length" class="card-tags">
      <span v-for="tag in book.tags" :key="tag" class="tag-chip">{{ tag }}</span>
    </div>
    <div v-if="columnDate() || book.duration_days !== null" class="card-meta">
      <span v-if="columnDate()">{{ columnDate()!.label }} {{ columnDate()!.on }}</span>
      <span v-if="book.status === 'read' && book.duration_days !== null" class="duration">
        {{ book.duration_days }}日で読了
      </span>
    </div>
  </article>
</template>

<style scoped>
.card {
  background: var(--surface);
  border-radius: 8px;
  padding: 10px 12px;
  box-shadow: 0 1px 2px rgba(9, 30, 66, 0.15);
  border: 1px solid transparent;
  cursor: pointer;
}
.card:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}

.card-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 6px;
}
.genre-badge,
.media-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 1px 7px;
  border-radius: 999px;
  white-space: nowrap;
}
/* ジャンル別（明るいパステル地＋同系の濃文字、prototype 準拠） */
.genre-classic_novel {
  background: #ffe1ef;
  color: #b01b62;
}
.genre-liberal_arts {
  background: #dfe9f6;
  color: #2b5a8c;
}
.genre-health_body {
  background: #d6f1ea;
  color: #0d6b62;
}
.genre-practical {
  background: #fce4d5;
  color: #9c3d0f;
}
.genre-other {
  background: #e7e9ec;
  color: #4b5563;
}
/* 形態（雑誌のみ表示） */
.media-badge {
  background: var(--col-want);
  color: #fff;
}

.card-title {
  font-size: 14px;
  font-weight: 600;
  line-height: 1.4;
}

.card-author {
  font-size: 12px;
  color: var(--text-sub);
  margin-top: 2px;
}

.card-stars {
  margin-top: 6px;
  font-size: 13px;
  letter-spacing: 1px;
}
.card-stars .on {
  color: var(--star);
}
.card-stars .off {
  color: var(--star-empty);
}

.card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 6px;
}
.tag-chip {
  font-size: 10px;
  color: var(--text-sub);
  background: #ebecf0;
  border-radius: 4px;
  padding: 1px 6px;
}

.card-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 6px;
  font-size: 11px;
  color: var(--text-sub);
}
.card-meta .duration {
  color: var(--col-read);
  font-weight: 700;
}
</style>
