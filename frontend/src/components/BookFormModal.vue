<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { createBook, updateBook, deleteBook } from '../api/books'
import { ApiError } from '../api/http'
import { BOOK_STATUSES } from '../types/book'
import type { Book, BookStatus, BookCreateInput } from '../types/book'

// book が渡されれば編集モード、null なら新規追加モード
const props = defineProps<{ book: Book | null }>()
const emit = defineEmits<{
  close: []
  saved: []
  deleted: []
}>()

const isEdit = computed(() => props.book !== null)

const STATUS_LABELS: Record<BookStatus, string> = {
  want_to_read: '読みたい',
  reading: '読書中',
  read: '読了',
}

// フォームの入力値（編集時は既存値で初期化）
const form = reactive({
  title: props.book?.title ?? '',
  author: props.book?.author ?? '',
  status: props.book?.status ?? ('want_to_read' as BookStatus),
  rating: props.book?.rating ?? 0, // 0 = 未評価
  memo: props.book?.memo ?? '',
})

const errors = ref<string[]>([])
const submitting = ref(false)

function buildInput(): BookCreateInput {
  return {
    title: form.title.trim(),
    author: form.author.trim() === '' ? null : form.author.trim(),
    status: form.status,
    rating: form.rating === 0 ? null : form.rating,
    memo: form.memo.trim() === '' ? null : form.memo.trim(),
  }
}

async function onSubmit() {
  errors.value = []
  submitting.value = true
  try {
    if (props.book) {
      await updateBook(props.book.id, buildInput())
    } else {
      await createBook(buildInput())
    }
    emit('saved')
  } catch (e) {
    errors.value =
      e instanceof ApiError && e.errors.length > 0
        ? e.errors
        : ['保存に失敗しました。時間をおいて再度お試しください。']
  } finally {
    submitting.value = false
  }
}

async function onDelete() {
  if (!props.book) return
  if (!window.confirm(`「${props.book.title}」を削除しますか？`)) return
  errors.value = []
  submitting.value = true
  try {
    await deleteBook(props.book.id)
    emit('deleted')
  } catch (e) {
    errors.value =
      e instanceof ApiError && e.errors.length > 0
        ? e.errors
        : ['削除に失敗しました。時間をおいて再度お試しください。']
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="modal-overlay" @click.self="emit('close')">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <h2 id="modal-title" class="modal-title">{{ isEdit ? '書籍を編集' : '書籍を追加' }}</h2>

      <ul v-if="errors.length" class="form-errors" role="alert">
        <li v-for="(msg, i) in errors" :key="i">{{ msg }}</li>
      </ul>

      <form @submit.prevent="onSubmit">
        <label class="field">
          <span class="field-label">タイトル<span class="required">必須</span></span>
          <input v-model="form.title" type="text" required autofocus />
        </label>

        <label class="field">
          <span class="field-label">著者</span>
          <input v-model="form.author" type="text" />
        </label>

        <label class="field">
          <span class="field-label">ステータス</span>
          <select v-model="form.status">
            <option v-for="s in BOOK_STATUSES" :key="s" :value="s">{{ STATUS_LABELS[s] }}</option>
          </select>
        </label>

        <label class="field">
          <span class="field-label">評価</span>
          <select v-model.number="form.rating">
            <option :value="0">未評価</option>
            <option v-for="n in 5" :key="n" :value="n">{{ '★'.repeat(n) }}（{{ n }}）</option>
          </select>
        </label>

        <label class="field">
          <span class="field-label">メモ</span>
          <textarea v-model="form.memo" rows="3"></textarea>
        </label>

        <div class="modal-actions">
          <button
            v-if="isEdit"
            type="button"
            class="btn btn-danger"
            :disabled="submitting"
            @click="onDelete"
          >
            削除
          </button>
          <span class="spacer"></span>
          <button type="button" class="btn btn-ghost" :disabled="submitting" @click="emit('close')">
            キャンセル
          </button>
          <button type="submit" class="btn btn-primary" :disabled="submitting">
            {{ isEdit ? '更新' : '追加' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(9, 30, 66, 0.5);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 48px 16px;
  z-index: 100;
}
.modal {
  background: var(--surface);
  border-radius: 10px;
  padding: 20px;
  width: 100%;
  max-width: 440px;
  box-shadow: 0 8px 24px rgba(9, 30, 66, 0.25);
}
.modal-title {
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 16px;
}

.form-errors {
  margin: 0 0 16px;
  padding: 10px 12px 10px 28px;
  background: #ffeceb;
  border: 1px solid var(--danger);
  border-radius: 6px;
  color: var(--danger);
  font-size: 13px;
}

.field {
  display: block;
  margin-bottom: 14px;
}
.field-label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 4px;
}
.required {
  color: var(--danger);
  font-size: 11px;
  margin-left: 6px;
}
.field input,
.field select,
.field textarea {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  font: inherit;
  box-sizing: border-box;
}
.field textarea {
  resize: vertical;
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
.btn-danger {
  background: var(--surface);
  border-color: var(--danger);
  color: var(--danger);
}
</style>
