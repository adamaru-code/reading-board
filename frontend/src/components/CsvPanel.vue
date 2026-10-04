<script setup lang="ts">
import { ref, useId } from 'vue'
import { importBooks } from '../api/books'
import { ApiError } from '../api/http'
import type { BookImportPreview } from '../types/book'

// アカウント画面の「CSV」タブ：自分の本の書き出しと、CSV の読み込み（まとめて登録）。
// 読み込みは ファイルを選ぶ → 確認（足す冊数・飛ばす本）→「取り込む」の 2 段階。間違った行があれば何も取り込まない
const emit = defineEmits<{ close: []; imported: []; unauthorized: [] }>()

// 自分の本をすべて CSV で保存する（GET /api/books/export。同じオリジンなのでログインの Cookie が付く）
const EXPORT_URL = '/api/books/export'

const fileInputId = useId()
const csvText = ref<string | null>(null) // 選んだファイルの中身（確認のあと、取り込むときにもう一度送る）
const fileName = ref('')
const preview = ref<BookImportPreview | null>(null)
const errors = ref<string[]>([])
const busy = ref(false)
const created = ref<number | null>(null) // 取り込んだ冊数（終わったら出す）

function handleError(e: unknown) {
  if (e instanceof ApiError && e.status === 401) {
    emit('unauthorized')
    return
  }
  errors.value =
    e instanceof ApiError && e.errors.length > 0
      ? e.errors
      : ['CSV の読み込みに失敗しました。時間をおいて再度お試しください。']
}

// ファイルを選んだら、登録せずに件数だけ確かめる
async function onFileChange(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  preview.value = null
  errors.value = []
  created.value = null
  csvText.value = null
  if (!file) return
  fileName.value = file.name
  busy.value = true
  try {
    const text = await file.text()
    preview.value = await importBooks(text, true)
    csvText.value = text
  } catch (e) {
    handleError(e)
  } finally {
    busy.value = false
  }
}

async function onImport() {
  if (csvText.value === null) return
  busy.value = true
  errors.value = []
  try {
    const result = await importBooks(csvText.value, false)
    created.value = result.created
    preview.value = null
    csvText.value = null
    emit('imported')
  } catch (e) {
    handleError(e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="csv-panel">
    <section class="csv-section" aria-labelledby="csv-export-title">
      <h3 id="csv-export-title" class="csv-title">書き出し</h3>
      <p class="csv-text">
        自分の本をすべて CSV ファイルで保存します。Excel・Numbers・Google
        スプレッドシートで表として開けます。
      </p>
      <p class="csv-text csv-sub">
        入る項目：タイトル・著者・状態・ジャンル・形態・評価・タグ・メモ・ISBN・登録日・開始日・読了日・所要日数（絞り込みに関係なく全件）
      </p>
      <div class="csv-actions">
        <a :href="EXPORT_URL" class="btn btn-primary export-link" download>CSV で書き出す</a>
      </div>
    </section>

    <section class="csv-section" aria-labelledby="csv-import-title">
      <h3 id="csv-import-title" class="csv-title">読み込み</h3>
      <p class="csv-text">
        CSV ファイルの本をまとめて登録します。書き出した CSV
        と同じ見出しにしてください（タイトルは必須）。
      </p>
      <p class="csv-text csv-sub">
        すでにある本（同じ ISBN、または同じタイトルと著者）は飛ばします。間違った行が 1
        行でもあれば、何も取り込みません。表紙はあとで編集画面から取得できます。
      </p>
      <label :for="fileInputId" class="file-label">CSV ファイルを選ぶ</label>
      <input
        :id="fileInputId"
        type="file"
        class="file-input"
        accept=".csv,text/csv"
        :disabled="busy"
        @change="onFileChange"
      />

      <p v-if="busy" class="csv-text csv-sub" role="status">確認しています…</p>

      <ul v-if="errors.length" class="form-errors" role="alert">
        <li v-for="(msg, i) in errors" :key="i">{{ msg }}</li>
      </ul>

      <div v-if="preview" class="import-preview" role="status">
        <p class="csv-text">
          「{{ fileName }}」から <strong>{{ preview.to_create }} 冊</strong>を新しく足します。
        </p>
        <template v-if="preview.skipped.length">
          <p class="csv-text csv-sub">
            すでにあるので飛ばす本（{{ preview.skipped.length }} 冊）：
          </p>
          <ul class="skipped-list">
            <li v-for="s in preview.skipped" :key="s.line">{{ s.line }} 行目：{{ s.title }}</li>
          </ul>
        </template>
        <div class="csv-actions">
          <button
            type="button"
            class="btn btn-primary"
            :disabled="busy || preview.to_create === 0"
            @click="onImport"
          >
            {{ busy ? '取り込み中…' : '取り込む' }}
          </button>
        </div>
      </div>

      <p v-if="created !== null" class="done-message" role="status">
        {{ created }} 冊を取り込みました。
      </p>
    </section>

    <div class="modal-actions">
      <span class="spacer"></span>
      <button type="button" class="btn btn-ghost" @click="emit('close')">閉じる</button>
    </div>
  </div>
</template>

<style scoped>
.csv-section + .csv-section {
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid var(--border);
}
.csv-title {
  margin: 0 0 6px;
  font-size: 14px;
}
.csv-text {
  margin: 0 0 8px;
  font-size: 13px;
}
.csv-sub {
  color: var(--text-sub);
}
.csv-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 4px;
}
/* ファイルを選ぶ欄。見出しを付けて、ふつうの入力欄の幅に */
.file-label {
  display: block;
  margin: 4px 0;
  font-size: 13px;
  font-weight: 600;
}
.file-input {
  width: 100%;
  font: inherit;
  font-size: 13px;
}
.import-preview {
  margin-top: 10px;
  padding: 10px 12px;
  border-radius: 6px;
  background: var(--slate-tint);
}
.skipped-list {
  margin: 0 0 8px;
  padding-left: 18px;
  max-height: 120px;
  overflow-y: auto;
  font-size: 12px;
  color: var(--text-sub);
}
.form-errors {
  margin: 10px 0 0;
  padding: 10px 12px 10px 28px;
  max-height: 160px;
  overflow-y: auto;
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
/* リンクをボタンと同じ見た目にする */
.export-link {
  display: inline-block;
  text-decoration: none;
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
