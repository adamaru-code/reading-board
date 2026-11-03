<script setup lang="ts">
import { ref, watch, useId, computed } from 'vue'
import type { Book } from '../types/book'
import { GENRE_LABELS, MEDIA_TYPE_LABELS } from '../types/book'

// hintId：説明の最後に添える操作の案内（KanbanColumn が「Option と矢印キーで移動できます」を渡す）
const props = defineProps<{ book: Book; hintId?: string }>()

// 表紙の画像が読み込めなかった（URL が古いなど）ときは、表紙なしのカードとして出す
const coverBroken = ref(false)
watch(
  () => props.book.cover_url,
  () => {
    coverBroken.value = false
  },
)

// 読み上げ用：カードの名前は「〇〇 を編集」（KanbanColumn が付ける）。ジャンル・著者・評価・タグ・日付・操作の案内は説明として結ぶ
const uid = useId()
const detailsIds = computed(() =>
  [...['badges', 'author', 'stars', 'tags', 'meta'].map((part) => `${uid}-${part}`), props.hintId]
    .filter(Boolean)
    .join(' '),
)

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
  <!-- 表紙があれば左に 60×86 で出す（見本ページで比べて決めた案 B）。無ければ今までどおりのカード -->
  <article
    class="card"
    :class="{ 'has-cover': book.cover_url && !coverBroken }"
    :aria-describedby="detailsIds"
  >
    <img
      v-if="book.cover_url && !coverBroken"
      :src="book.cover_url"
      alt=""
      class="card-cover"
      loading="lazy"
      referrerpolicy="no-referrer"
      @error="coverBroken = true"
    />
    <div class="card-body">
      <div :id="`${uid}-badges`" class="card-badges">
        <span class="genre-badge" :class="`genre-${book.genre}`">{{
          GENRE_LABELS[book.genre]
        }}</span>
        <span v-if="book.media_type === 'magazine'" class="media-badge">
          {{ MEDIA_TYPE_LABELS.magazine }}
        </span>
      </div>
      <div class="card-title">{{ book.title }}</div>
      <div v-if="book.author" :id="`${uid}-author`" class="card-author">{{ book.author }}</div>
      <div
        v-if="book.rating"
        :id="`${uid}-stars`"
        class="card-stars"
        role="img"
        :aria-label="`評価 ${book.rating} / 5`"
      >
        <!-- 塗り ★ と空 ☆ を形でも見分ける（色が分かりにくい人のため。#358） -->
        <span v-for="(on, i) in stars()" :key="i" :class="on ? 'on' : 'off'">{{
          on ? '★' : '☆'
        }}</span>
      </div>
      <div v-if="book.tags.length" :id="`${uid}-tags`" class="card-tags">
        <!-- 読み上げ用に「タグ」と、タグの間の「、」を入れる（無いと「名作再読」のようにつながって読まれる） -->
        <span class="visually-hidden">タグ </span>
        <template v-for="(tag, i) in book.tags" :key="tag">
          <span v-if="i > 0" class="visually-hidden">、</span>
          <span class="tag-chip">{{ tag }}</span>
        </template>
      </div>
      <div v-if="columnDate() || book.duration_days !== null" :id="`${uid}-meta`" class="card-meta">
        <span v-if="columnDate()">{{ columnDate()!.label }} {{ columnDate()!.on }}</span>
        <span v-if="book.status === 'read' && book.duration_days !== null" class="duration">
          {{ book.duration_days === 0 ? '当日に読了' : `${book.duration_days}日で読了` }}
        </span>
      </div>
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
.card.has-cover {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}
/* 表紙：幅 60px × 高さ 86px（本の縦横比）。画像の余白は切り取ってそろえる */
.card-cover {
  width: 60px;
  height: 86px;
  flex: none;
  object-fit: cover;
  border-radius: 3px;
  box-shadow: 0 1px 3px rgba(9, 30, 66, 0.35);
  background: #ebecf0;
}
.card-body {
  flex: 1;
  min-width: 0;
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
