<script setup lang="ts">
import { ref, reactive, computed, nextTick, onBeforeUnmount } from 'vue'
import { createBook, updateBook, deleteBook, lookupBook } from '../api/books'
import { ApiError } from '../api/http'
import {
  BOOK_STATUSES,
  BOOK_GENRES,
  GENRE_LABELS,
  BOOK_MEDIA_TYPES,
  MEDIA_TYPE_LABELS,
} from '../types/book'
import type { Book, BookStatus, BookGenre, BookMediaType, BookCreateInput } from '../types/book'
import { suggestTags, SUGGEST_LIMIT } from '../lib/tagSuggestions'

// book が渡されれば編集モード、null なら新規追加モード
// knownTags：自分が過去に付けたタグ（よく使う順）。タグ候補に使う
const props = withDefaults(defineProps<{ book: Book | null; knownTags?: string[] }>(), {
  knownTags: () => [],
})
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
  genre: props.book?.genre ?? ('other' as BookGenre),
  media_type: props.book?.media_type ?? ('book' as BookMediaType),
  rating: props.book?.rating ?? 0, // 0 = 未評価
  memo: props.book?.memo ?? '',
})

// タグ（チップ入力）
const tags = ref<string[]>([...(props.book?.tags ?? [])])
const tagInput = ref('')

function addTag() {
  const name = tagInput.value.trim()
  if (name !== '' && !tags.value.includes(name)) tags.value.push(name)
  tagInput.value = ''
}

function removeTag(name: string) {
  tags.value = tags.value.filter((t) => t !== name)
}

// 候補タグ：辞書（タイトル・著者）＋過去に付けたタグ。入力中の文字があれば絞り込む（入力済みは除外）。
// 最初は SUGGEST_LIMIT 件だけ出し、「すべて表示」で全部出す
const showAllSuggestions = ref(false)
const allSuggestedTags = computed(() =>
  suggestTags(form.title, form.author, tags.value, {
    knownTags: props.knownTags,
    query: tagInput.value,
    limit: Infinity,
  }),
)
const suggestedTags = computed(() =>
  showAllSuggestions.value
    ? allSuggestedTags.value
    : allSuggestedTags.value.slice(0, SUGGEST_LIMIT),
)
const hiddenSuggestionCount = computed(
  () => allSuggestedTags.value.length - suggestedTags.value.length,
)

function addSuggestedTag(tag: string) {
  if (!tags.value.includes(tag)) tags.value.push(tag)
  tagInput.value = '' // 絞り込みに使った入力中の文字は消す
}

// ISBN 照会（追加時のみ）。成功でタイトル/著者/形態を反映
const isbnInput = ref('')
const lookingUp = ref(false)
const lookupMessage = ref('')

async function onLookup() {
  const isbn = isbnInput.value.trim()
  if (isbn === '') return
  lookingUp.value = true
  lookupMessage.value = ''
  errors.value = []
  try {
    const result = await lookupBook(isbn)
    form.media_type = result.media_type
    if (result.found) {
      if (result.title) form.title = result.title
      if (result.author) form.author = result.author
      lookupMessage.value = '書誌情報を取得しました。'
    } else {
      lookupMessage.value = '該当が見つかりませんでした。タイトルを手入力してください。'
    }
  } catch (e) {
    errors.value =
      e instanceof ApiError && e.errors.length > 0 ? e.errors : ['ISBN 照会に失敗しました。']
  } finally {
    lookingUp.value = false
  }
}

// バーコード（EAN-13）カメラ読取。対応環境（BarcodeDetector + secure context）でのみ有効
const scanSupported =
  typeof window !== 'undefined' &&
  'BarcodeDetector' in window &&
  !!navigator.mediaDevices?.getUserMedia &&
  window.isSecureContext

const scanning = ref(false)
const scanError = ref('')
const videoEl = ref<HTMLVideoElement | null>(null)
let mediaStream: MediaStream | null = null
let barcodeDetector: BarcodeDetector | null = null
let scanRAF: number | undefined

async function startScan() {
  if (!scanSupported) return
  scanError.value = ''
  try {
    barcodeDetector ||= new BarcodeDetector({ formats: ['ean_13'] })
    mediaStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' },
    })
    scanning.value = true
    await nextTick() // video 要素が描画されてから接続
    if (videoEl.value) {
      videoEl.value.srcObject = mediaStream
      await videoEl.value.play()
    }
    scanLoop()
  } catch {
    scanError.value = 'カメラを起動できませんでした。ISBN手入力をご利用ください。'
    stopScan()
  }
}

async function scanLoop() {
  if (!mediaStream || !barcodeDetector || !videoEl.value) return
  try {
    const codes = await barcodeDetector.detect(videoEl.value)
    if (codes.length > 0) {
      isbnInput.value = codes[0].rawValue
      stopScan()
      onLookup() // 読み取ったら即照会
      return
    }
  } catch {
    // 一時的な検出失敗は無視して次フレームへ
  }
  scanRAF = requestAnimationFrame(scanLoop)
}

function stopScan() {
  if (scanRAF !== undefined) {
    cancelAnimationFrame(scanRAF)
    scanRAF = undefined
  }
  if (mediaStream) {
    mediaStream.getTracks().forEach((track) => track.stop())
    mediaStream = null
  }
  if (videoEl.value) videoEl.value.srcObject = null
  scanning.value = false
}

// モーダル破棄時にカメラを確実に停止
onBeforeUnmount(stopScan)

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
        <div v-if="!isEdit" class="field isbn-lookup">
          <label for="isbn-input" class="field-label">ISBN / バーコードで登録</label>
          <div class="isbn-row">
            <input
              id="isbn-input"
              v-model="isbnInput"
              type="text"
              inputmode="numeric"
              placeholder="ISBN / JAN（13桁 or 10桁）"
              @keydown.enter.prevent="onLookup"
            />
            <button type="button" class="btn btn-ghost" :disabled="lookingUp" @click="onLookup">
              {{ lookingUp ? '照会中…' : '検索' }}
            </button>
            <button
              v-if="scanSupported && !scanning"
              type="button"
              class="btn btn-ghost"
              @click="startScan"
            >
              📷 カメラ
            </button>
            <button v-if="scanning" type="button" class="btn btn-ghost" @click="stopScan">
              停止
            </button>
          </div>
          <div v-if="scanning" class="scanner">
            <video ref="videoEl" class="scan-video" playsinline muted></video>
            <p class="isbn-message">バーコードを枠内に写してください</p>
          </div>
          <p v-if="lookupMessage" class="isbn-message">{{ lookupMessage }}</p>
          <p v-if="scanError" class="isbn-message scan-error">{{ scanError }}</p>
        </div>

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
          <span class="field-label">ジャンル</span>
          <select v-model="form.genre">
            <option v-for="g in BOOK_GENRES" :key="g" :value="g">{{ GENRE_LABELS[g] }}</option>
          </select>
        </label>

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

        <label class="field">
          <span class="field-label">メモ</span>
          <textarea v-model="form.memo" rows="3"></textarea>
        </label>

        <div class="field">
          <span class="field-label">タグ</span>
          <div v-if="tags.length" class="tag-list">
            <span v-for="tag in tags" :key="tag" class="tag-chip">
              {{ tag }}
              <button
                type="button"
                class="tag-remove"
                :aria-label="`${tag} を削除`"
                @click="removeTag(tag)"
              >
                ×
              </button>
            </span>
          </div>
          <input
            v-model="tagInput"
            type="text"
            placeholder="タグを入力して Enter"
            @keydown.enter.prevent="addTag"
            @keydown.,.prevent="addTag"
          />
          <div v-if="suggestedTags.length" class="tag-suggest">
            <span class="tag-suggest-label">候補:</span>
            <button
              v-for="tag in suggestedTags"
              :key="tag"
              type="button"
              class="tag-suggest-chip"
              @click="addSuggestedTag(tag)"
            >
              ＋ {{ tag }}
            </button>
            <button
              v-if="hiddenSuggestionCount > 0"
              type="button"
              class="tag-suggest-more"
              @click="showAllSuggestions = true"
            >
              すべて表示（残り {{ hiddenSuggestionCount }} 件）
            </button>
            <button
              v-else-if="showAllSuggestions && allSuggestedTags.length > SUGGEST_LIMIT"
              type="button"
              class="tag-suggest-more"
              @click="showAllSuggestions = false"
            >
              少なく表示
            </button>
          </div>
        </div>

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
.isbn-lookup {
  padding: 10px;
  background: var(--bg);
  border-radius: 8px;
}
.isbn-row {
  display: flex;
  gap: 8px;
}
.isbn-row input {
  flex: 1;
}
.isbn-message {
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--text-sub);
}
.scan-error {
  color: var(--danger);
}
.scanner {
  margin-top: 8px;
}
.scan-video {
  width: 100%;
  max-height: 220px;
  background: #000;
  border-radius: 6px;
  object-fit: cover;
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

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 6px;
}
.tag-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  background: #ebecf0;
  color: var(--text);
  border-radius: 4px;
  padding: 2px 6px;
}
.tag-remove {
  border: none;
  background: none;
  cursor: pointer;
  color: var(--text-sub);
  font-size: 14px;
  line-height: 1;
  padding: 0;
}

.tag-suggest {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
}
.tag-suggest-label {
  font-size: 11px;
  color: var(--text-sub);
}
.tag-suggest-chip {
  font-size: 12px;
  border: 1px dashed var(--border);
  background: var(--surface);
  color: var(--primary);
  border-radius: 4px;
  padding: 2px 6px;
  cursor: pointer;
}
.tag-suggest-more {
  font-size: 12px;
  border: none;
  background: none;
  color: var(--text-sub);
  text-decoration: underline;
  padding: 2px 4px;
  cursor: pointer;
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
