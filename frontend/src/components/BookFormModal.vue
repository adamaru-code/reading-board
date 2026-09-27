<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { createBook, updateBook, deleteBook } from '../api/books'
import { ApiError } from '../api/http'
import {
  BOOK_STATUSES,
  BOOK_GENRES,
  GENRE_LABELS,
  BOOK_MEDIA_TYPES,
  MEDIA_TYPE_LABELS,
} from '../types/book'
import type {
  Book,
  BookStatus,
  BookGenre,
  BookMediaType,
  BookCreateInput,
  BookLookupResult,
  HiddenTag,
} from '../types/book'
import ConfirmDialog from './ConfirmDialog.vue'
import BaseModal from './BaseModal.vue'
import IsbnLookup from './IsbnLookup.vue'
import TagInput from './TagInput.vue'

// book が渡されれば編集モード、null なら新規追加モード
// knownTags：自分が過去に付けたタグ（よく使う順）。タグ候補に使う
// hiddenTags：候補から隠したタグ（v-model:hidden-tags。隠す・戻すと更新後の一覧を返す）
const props = withDefaults(
  defineProps<{ book: Book | null; knownTags?: string[]; hiddenTags?: HiddenTag[] }>(),
  { knownTags: () => [], hiddenTags: () => [] },
)
const emit = defineEmits<{
  close: []
  saved: []
  deleted: []
  'update:hiddenTags': [tags: HiddenTag[]]
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
  genre: props.book?.genre ?? ('other' as BookGenre),
  media_type: props.book?.media_type ?? ('book' as BookMediaType),
  rating: props.book?.rating ?? 0, // 0 = 未評価
  memo: props.book?.memo ?? '',
})

// タグ（入力・候補・隠す/戻すは TagInput.vue）。保存の直前に入力欄に残った文字を確定させるため ref で持つ
const tags = ref<string[]>([...(props.book?.tags ?? [])])
const tagInputRef = ref<InstanceType<typeof TagInput> | null>(null)

// ISBN 照会の結果（照会・カメラ読取は IsbnLookup.vue）。取れた項目だけ反映し、形態は常に反映
function onLookupResult(result: BookLookupResult) {
  form.media_type = result.media_type
  if (result.found) {
    if (result.title) form.title = result.title
    if (result.author) form.author = result.author
  }
}

const errors = ref<string[]>([])
const submitting = ref(false)

function buildInput(): BookCreateInput {
  return {
    title: form.title.trim(),
    author: form.author.trim() === '' ? null : form.author.trim(),
    status: form.status,
    genre: form.genre,
    media_type: form.media_type,
    rating: form.rating === 0 ? null : form.rating,
    memo: form.memo.trim() === '' ? null : form.memo.trim(),
    tags: tags.value,
  }
}

async function onSubmit() {
  tagInputRef.value?.commitInput() // Enter を押し忘れてタグ欄に残っている文字もタグにする
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

// 「削除」を押したら確認ダイアログを出し、そこで「削除」を選んだら実行する
const confirmingDelete = ref(false)

async function onConfirmDelete() {
  if (!props.book) return
  errors.value = []
  submitting.value = true
  try {
    await deleteBook(props.book.id)
    confirmingDelete.value = false
    emit('deleted')
  } catch (e) {
    confirmingDelete.value = false
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
  <!-- 入力中のフォームを Esc で誤って閉じないよう、Esc では閉じない（背景クリック・キャンセルで閉じる） -->
  <BaseModal
    :title="isEdit ? '書籍を編集' : '書籍を追加'"
    :max-width="440"
    :close-on-esc="false"
    @close="emit('close')"
  >
    <ul v-if="errors.length" class="form-errors" role="alert">
      <li v-for="(msg, i) in errors" :key="i">{{ msg }}</li>
    </ul>

    <form @submit.prevent="onSubmit">
      <IsbnLookup
        v-if="!isEdit"
        @start="errors = []"
        @result="onLookupResult"
        @error="errors = $event"
      />

      <label class="field">
        <span class="field-label">タイトル<span class="required">必須</span></span>
        <input v-model="form.title" type="text" required autofocus />
      </label>

      <label class="field">
        <span class="field-label">著者</span>
        <input v-model="form.author" type="text" />
      </label>

      <div class="field-row">
        <label class="field">
          <span class="field-label">ジャンル</span>
          <select v-model="form.genre">
            <option v-for="g in BOOK_GENRES" :key="g" :value="g">{{ GENRE_LABELS[g] }}</option>
          </select>
        </label>

        <label class="field">
          <span class="field-label">ステータス</span>
          <select v-model="form.status">
            <option v-for="s in BOOK_STATUSES" :key="s" :value="s">
              {{ STATUS_LABELS[s] }}
            </option>
          </select>
        </label>
      </div>

      <div class="field-row">
        <label class="field">
          <span class="field-label">形態</span>
          <select v-model="form.media_type">
            <option v-for="m in BOOK_MEDIA_TYPES" :key="m" :value="m">
              {{ MEDIA_TYPE_LABELS[m] }}
            </option>
          </select>
        </label>

        <label class="field">
          <span class="field-label">評価</span>
          <select v-model.number="form.rating">
            <option :value="0">未評価</option>
            <option v-for="n in 5" :key="n" :value="n">{{ '★'.repeat(n) }}（{{ n }}）</option>
          </select>
        </label>
      </div>

      <TagInput
        ref="tagInputRef"
        v-model="tags"
        :hidden-tags="hiddenTags"
        :title="form.title"
        :author="form.author"
        :known-tags="knownTags"
        @update:hidden-tags="emit('update:hiddenTags', $event)"
        @error="errors = $event"
      />

      <label class="field">
        <span class="field-label">メモ</span>
        <textarea v-model="form.memo" rows="1"></textarea>
      </label>

      <div class="modal-actions">
        <button
          v-if="isEdit"
          type="button"
          class="btn btn-danger"
          :disabled="submitting"
          @click="confirmingDelete = true"
        >
          削除
        </button>
        <span class="spacer"></span>
        <button type="button" class="btn btn-cancel" :disabled="submitting" @click="emit('close')">
          キャンセル
        </button>
        <button type="submit" class="btn btn-primary" :disabled="submitting">
          {{ isEdit ? '更新' : '追加' }}
        </button>
      </div>
    </form>

    <ConfirmDialog
      v-if="confirmingDelete && book"
      title="本を削除しますか？"
      :message="`「${book.title}」を削除します。`"
      note="この操作は取り消せません。"
      :busy="submitting"
      @confirm="onConfirmDelete"
      @cancel="confirmingDelete = false"
    />
  </BaseModal>
</template>

<style scoped>
.form-errors {
  margin: 0 0 16px;
  padding: 10px 12px 10px 28px;
  background: #ffeceb;
  border: 1px solid var(--danger);
  border-radius: 6px;
  color: var(--danger);
  font-size: 13px;
}

/* 2 項目を横に並べる行（ジャンル｜ステータス、形態｜評価） */
.field-row {
  display: grid;
  grid-template-columns: 1fr 1fr; /* 半分ずつの幅 */
  gap: 12px;
}
.required {
  color: var(--danger);
  font-size: 11px;
  margin-left: 6px;
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
/* キャンセル：確認ダイアログ（ConfirmDialog.vue）の「キャンセル」と同じ見た目 */
.btn-cancel {
  background: var(--bg);
  border-radius: 8px;
  padding: 8px 18px;
}
.btn-danger {
  background: var(--surface);
  border-color: var(--danger);
  color: var(--danger);
}
</style>
