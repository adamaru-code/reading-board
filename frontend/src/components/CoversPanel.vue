<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { countMissingCovers, fetchCovers } from '../api/books'
import { ApiError } from '../api/http'

// アカウント画面の「表紙」タブ：ISBN があって表紙が無い本に、Google Books の表紙をまとめて付ける。
// サーバーは 1 回に 10 冊まで処理するので、残りが 0 になるか止まる（Google の上限など）まで繰り返し呼ぶ
const emit = defineEmits<{ close: []; updated: []; unauthorized: [] }>()

const missing = ref<number | null>(null) // 開いたときの対象の冊数（読み込み中は null）
const busy = ref(false)
const done = ref(0) // 今回問い合わせた冊数（進み具合）
const total = ref(0) // 今回の対象の冊数
const updated = ref<number | null>(null) // 表紙を付けた冊数（終わったら出す）
const notFound = ref(0)
const stopMessage = ref<string | null>(null) // 止まった理由（サーバーの文）
const errors = ref<string[]>([])

function handleError(e: unknown) {
  if (e instanceof ApiError && e.status === 401) {
    emit('unauthorized')
    return
  }
  errors.value =
    e instanceof ApiError && e.errors.length > 0
      ? e.errors
      : ['表紙の取得に失敗しました。時間をおいて再度お試しください。']
}

async function loadCount() {
  try {
    missing.value = await countMissingCovers()
  } catch (e) {
    handleError(e)
  }
}

async function onFetch() {
  busy.value = true
  errors.value = []
  stopMessage.value = null
  updated.value = null
  notFound.value = 0
  done.value = 0
  total.value = missing.value ?? 0
  let added = 0
  let afterId = 0
  try {
    for (;;) {
      const result = await fetchCovers(afterId)
      added += result.updated
      notFound.value += result.not_found
      done.value += result.updated + result.not_found
      afterId = result.last_id
      if (result.stopped) {
        stopMessage.value = result.message
        break
      }
      if (result.remaining === 0) break
    }
  } catch (e) {
    handleError(e)
  } finally {
    updated.value = added
    busy.value = false
    if (added > 0) emit('updated')
    await loadCount()
  }
}

onMounted(loadCount)
</script>

<template>
  <div class="covers-panel">
    <p class="covers-text">
      ISBN がある本に、Google Books の表紙をまとめて付けます（表紙がすでにある本・ISBN
      が無い本は対象外）。
    </p>
    <p class="covers-text covers-sub">
      見つからなかった本は、次に押したときにもう一度探します。Google には 1
      日に問い合わせられる回数の上限があり、上限に達したらそこで止めます。
    </p>

    <p v-if="missing !== null" class="covers-count" role="status">
      ISBN があって表紙が無い本：<strong>{{ missing }} 冊</strong>
    </p>

    <div class="covers-actions">
      <button type="button" class="btn btn-primary" :disabled="busy || !missing" @click="onFetch">
        {{ busy ? `取得中… ${done} / ${total} 冊` : '表紙をまとめて取得' }}
      </button>
    </div>

    <ul v-if="errors.length" class="form-errors" role="alert">
      <li v-for="(msg, i) in errors" :key="i">{{ msg }}</li>
    </ul>

    <p v-if="updated !== null && !errors.length" class="done-message" role="status">
      表紙を付けた本 {{ updated }} 冊・見つからなかった本 {{ notFound }} 冊
    </p>
    <p v-if="stopMessage" class="stop-message" role="alert">{{ stopMessage }}</p>

    <div class="modal-actions">
      <span class="spacer"></span>
      <button type="button" class="btn btn-ghost" @click="emit('close')">閉じる</button>
    </div>
  </div>
</template>

<style scoped>
.covers-text {
  margin: 0 0 8px;
  font-size: 13px;
}
.covers-sub {
  color: var(--text-sub);
}
.covers-count {
  margin: 12px 0 8px;
  font-size: 14px;
}
.covers-actions {
  display: flex;
  justify-content: flex-end;
}
.form-errors {
  margin: 10px 0 0;
  padding: 10px 12px 10px 28px;
  background: #ffeceb;
  border: 1px solid var(--danger);
  border-radius: 6px;
  color: var(--danger);
  font-size: 13px;
}
.done-message {
  margin: 10px 0 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--col-read-strong);
}
.stop-message {
  margin: 8px 0 0;
  padding: 10px 12px;
  border-radius: 6px;
  background: var(--slate-tint);
  font-size: 13px;
}
.btn {
  border: 1px solid transparent;
  border-radius: 6px;
  padding: 8px 16px;
  font: inherit;
  cursor: pointer;
}
.btn:disabled {
  opacity: 0.6;
  cursor: default;
}
.btn-primary {
  background: var(--primary);
  color: #fff;
}
.btn-ghost {
  background: var(--surface);
  border-color: var(--border);
}
.modal-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 20px;
}
.spacer {
  flex: 1;
}
</style>
