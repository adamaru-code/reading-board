<script setup lang="ts">
import type { Book } from '../types/book'

const props = defineProps<{ book: Book }>()

// 評価（1〜5）を ★ の on/off 配列に変換。未評価は表示しない。
const stars = () => {
  const rating = props.book.rating
  if (!rating) return []
  return [1, 2, 3, 4, 5].map((n) => n <= rating)
}
</script>

<template>
  <article class="card">
    <div class="card-title">{{ book.title }}</div>
    <div v-if="book.author" class="card-author">{{ book.author }}</div>
    <div v-if="book.rating" class="card-stars" :aria-label="`評価 ${book.rating} / 5`">
      <span v-for="(on, i) in stars()" :key="i" :class="on ? 'on' : 'off'">★</span>
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
</style>
