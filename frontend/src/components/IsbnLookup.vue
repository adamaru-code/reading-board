<script setup lang="ts">
import { ref, nextTick, onBeforeUnmount } from 'vue'
import { lookupBook } from '../api/books'
import { ApiError } from '../api/http'
import type { BookLookupResult } from '../types/book'

// 書籍フォームの「ISBN / バーコードで登録」欄（追加時のみ使う）。
// 照会・カメラ読取はこの部品の中で完結し、結果だけを親に渡す（タイトル等への反映は親が行う）
const emit = defineEmits<{
  start: [] // 照会を始めた（親は前のエラー表示を消す）
  result: [result: BookLookupResult] // 照会できた（該当なしも含む）
  error: [messages: string[]] // 照会に失敗した
}>()

const isbnInput = ref('')
const lookingUp = ref(false)
// 照会結果の表示：found＝取得できた（緑の帯）／not_found＝該当なし（黄色の帯）／null＝表示なし
const lookupStatus = ref<'found' | 'not_found' | null>(null)

async function onLookup() {
  const isbn = isbnInput.value.trim()
  if (isbn === '') return
  lookingUp.value = true
  lookupStatus.value = null
  emit('start')
  try {
    const result = await lookupBook(isbn)
    lookupStatus.value = result.found ? 'found' : 'not_found'
    emit('result', result)
  } catch (e) {
    emit(
      'error',
      e instanceof ApiError && e.errors.length > 0 ? e.errors : ['ISBN 照会に失敗しました。'],
    )
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

// モーダルを閉じる（この部品が消える）ときにカメラを確実に停止
onBeforeUnmount(stopScan)
</script>

<template>
  <div class="field isbn-lookup">
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
      <button type="button" class="btn-ghost" :disabled="lookingUp" @click="onLookup">
        {{ lookingUp ? '照会中…' : '検索' }}
      </button>
      <button v-if="scanSupported && !scanning" type="button" class="btn-ghost" @click="startScan">
        📷 カメラ
      </button>
      <button v-if="scanning" type="button" class="btn-ghost" @click="stopScan">停止</button>
    </div>
    <div v-if="scanning" class="scanner">
      <video ref="videoEl" class="scan-video" playsinline muted></video>
      <p class="isbn-message">バーコードを枠内に写してください</p>
    </div>
    <!-- role="status"：読み上げソフトにも結果を伝える -->
    <p v-if="lookupStatus === 'found'" class="lookup-result lookup-found" role="status">
      <span aria-hidden="true">✓</span> 書誌情報を取得しました。
    </p>
    <p
      v-else-if="lookupStatus === 'not_found'"
      class="lookup-result lookup-not-found"
      role="status"
    >
      <span aria-hidden="true">ℹ</span> 該当が見つかりませんでした。タイトルを手入力してください。
    </p>
    <p v-if="scanError" class="isbn-message scan-error">{{ scanError }}</p>
  </div>
</template>

<style scoped>
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
.btn-ghost {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 8px 16px;
  font: inherit;
  cursor: pointer;
}
.btn-ghost:disabled {
  opacity: 0.6;
  cursor: default;
}
.isbn-message {
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--text-sub);
}
/* 照会結果の帯（取得できた＝緑／該当なし＝黄）。文字と背景のコントラストは WCAG AA 以上 */
.lookup-result {
  margin: 8px 0 0;
  padding: 8px 10px;
  border-radius: 6px;
  border: 1px solid;
  font-size: 13px;
  font-weight: 600;
}
.lookup-found {
  background: #dcfff1;
  border-color: #4bce97;
  color: #216e4e;
}
.lookup-not-found {
  background: #fff7d6;
  border-color: #e2b203;
  color: #7f5f01;
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
</style>
