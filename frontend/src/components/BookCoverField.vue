<script setup lang="ts">
import { ref, watch } from 'vue'
import type { BookLookupResult } from '../types/book'
import IsbnLookup from './IsbnLookup.vue'

// 書籍フォームの「表紙」欄：左に表紙（カードと同じ 60×86）、右に ISBN での表紙の取得と「表紙を外す」。
// lookup：ISBN で表紙だけを取得できるか（編集のとき。追加のときは照会で取れた表紙を見せるだけ）。
// BookFormModal.vue から分けた（#388）
const isbn = defineModel<string>('isbn', { required: true })
const coverUrl = defineModel<string | null>('coverUrl', { required: true })
defineProps<{ lookup: boolean }>()
const emit = defineEmits<{ start: []; error: [messages: string[]] }>()

// 表紙の画像が読み込めなかった（URL が古いなど）ときは表紙なしとして表示する。表紙が変わったら読み込み直す
const coverBroken = ref(false)
watch(coverUrl, () => {
  coverBroken.value = false
})

// 表紙と ISBN だけを変える（タイトルなどは変えない）。表紙が見つからなければ今の表紙のまま
function onCoverResult(result: BookLookupResult) {
  if (!result.cover_url) return
  isbn.value = result.isbn
  coverUrl.value = result.cover_url
}
</script>

<template>
  <div class="field">
    <span class="field-label">表紙</span>
    <div class="cover-field">
      <img
        v-if="coverUrl && !coverBroken"
        :src="coverUrl"
        alt="表紙"
        class="cover-preview"
        referrerpolicy="no-referrer"
        @error="coverBroken = true"
      />
      <div v-else class="cover-preview cover-empty">表紙なし</div>
      <div class="cover-actions">
        <IsbnLookup
          v-if="lookup"
          mode="cover"
          :initial-isbn="isbn"
          @start="emit('start')"
          @result="onCoverResult"
          @error="emit('error', $event)"
        />
        <button v-if="coverUrl" type="button" class="cover-remove" @click="coverUrl = null">
          表紙を外す
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 表紙欄：左に表紙（カードと同じ 60×86）、右に ISBN での取得と「表紙を外す」 */
.cover-field {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 10px;
  background: var(--bg);
  border-radius: 8px;
}
.cover-preview {
  width: 60px;
  height: 86px;
  flex: none;
  object-fit: cover;
  border-radius: 3px;
  box-shadow: 0 1px 3px rgba(9, 30, 66, 0.35);
}
.cover-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: none;
  border: 1px dashed var(--border);
  background: var(--surface);
  color: var(--text-sub);
  font-size: 11px;
}
.cover-actions {
  flex: 1;
  min-width: 0;
}
.cover-remove {
  margin-top: 8px;
  padding: 0;
  border: none;
  background: none;
  color: var(--text-sub);
  font: inherit;
  font-size: 12px;
  text-decoration: underline;
  cursor: pointer;
}
</style>
