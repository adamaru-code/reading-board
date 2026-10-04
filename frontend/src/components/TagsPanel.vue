<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { listMyTags, removeTag, renameTag } from '../api/tags'
import type { MyTag } from '../api/tags'
import { ApiError } from '../api/http'
import ConfirmDialog from './ConfirmDialog.vue'

// アカウント画面の「タグ」タブ：自分の本のタグの一覧（冊数つき）と、名前を変える・まとめる・外す。
// タグは全ユーザーで共有なので、変えるのは自分の本のつながりだけ（ほかの人の本のタグは変わらない）。
// 画面にはこの仕組みを書かない（使う人にはタグは自分の本のものなので、「ほかの人の本」と書くとかえって迷う）
const emit = defineEmits<{ close: []; changed: []; unauthorized: [] }>()

const tags = ref<MyTag[]>([])
const loading = ref(true)
const busy = ref(false)
const errors = ref<string[]>([])
const message = ref('') // 終わったときのお知らせ

const editing = ref<string | null>(null) // 名前を変えている途中のタグ
const newName = ref('')
const removing = ref<MyTag | null>(null) // 外す確認を出しているタグ

// 入力した名前が自分の別のタグと同じなら、1 つにまとめることを先に知らせる
const mergeTarget = computed(() => {
  const name = newName.value.trim()
  return tags.value.find((tag) => tag.name === name && tag.name !== editing.value) ?? null
})

function handleError(e: unknown, fallback: string) {
  if (e instanceof ApiError && e.status === 401) {
    emit('unauthorized')
    return
  }
  errors.value = e instanceof ApiError && e.errors.length > 0 ? e.errors : [fallback]
}

async function load() {
  try {
    tags.value = await listMyTags()
  } catch (e) {
    handleError(e, 'タグの取得に失敗しました。時間をおいて再度お試しください。')
  } finally {
    loading.value = false
  }
}
onMounted(load)

function startEdit(tag: MyTag) {
  editing.value = tag.name
  newName.value = tag.name
  errors.value = []
  message.value = ''
}

function cancelEdit() {
  editing.value = null
}

async function onRename() {
  if (editing.value === null) return
  const from = editing.value
  const to = newName.value.trim()
  busy.value = true
  errors.value = []
  try {
    const result = await renameTag(from, to)
    message.value = result.merged
      ? `「${from}」を「${to}」にまとめました（${result.count} 冊）。`
      : `「${from}」を「${to}」に変えました（${result.count} 冊）。`
    editing.value = null
    await load()
    emit('changed')
  } catch (e) {
    handleError(e, '名前の変更に失敗しました。時間をおいて再度お試しください。')
  } finally {
    busy.value = false
  }
}

async function onConfirmRemove() {
  if (!removing.value) return
  const name = removing.value.name
  busy.value = true
  errors.value = []
  try {
    const result = await removeTag(name)
    message.value = `「${name}」を ${result.count} 冊から外しました。`
    removing.value = null
    await load()
    emit('changed')
  } catch (e) {
    removing.value = null
    handleError(e, 'タグを外せませんでした。時間をおいて再度お試しください。')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="tags-panel">
    <p class="tags-text tags-sub">
      自分の本に付いているタグです。名前を変える・すでにある名前にして 1
      つにまとめる・すべての本から外す、ができます。
    </p>

    <ul v-if="errors.length" class="form-errors" role="alert">
      <li v-for="(msg, i) in errors" :key="i">{{ msg }}</li>
    </ul>
    <p v-if="message" class="done-message" role="status">{{ message }}</p>

    <p v-if="loading" class="tags-text tags-sub">読み込み中…</p>
    <p v-else-if="tags.length === 0" class="tags-text tags-sub">まだタグはありません。</p>
    <ul v-else class="tag-rows">
      <li v-for="tag in tags" :key="tag.name" class="tag-row">
        <template v-if="editing === tag.name">
          <form class="rename-form" @submit.prevent="onRename">
            <input
              v-model="newName"
              class="rename-input"
              aria-label="新しい名前"
              maxlength="255"
              :disabled="busy"
            />
            <button type="submit" class="btn btn-primary btn-small" :disabled="busy">変更</button>
            <button
              type="button"
              class="btn btn-ghost btn-small"
              :disabled="busy"
              @click="cancelEdit"
            >
              やめる
            </button>
          </form>
          <p v-if="mergeTarget" class="merge-note">
            「{{ mergeTarget.name }}」（{{ mergeTarget.count }} 冊）と 1 つにまとめます。
          </p>
        </template>
        <template v-else>
          <span class="tag-chip">{{ tag.name }}</span>
          <span class="tag-count">{{ tag.count }} 冊</span>
          <span class="spacer"></span>
          <button
            type="button"
            class="btn btn-ghost btn-small"
            :disabled="busy || editing !== null"
            @click="startEdit(tag)"
          >
            名前を変える
          </button>
          <button
            type="button"
            class="btn btn-ghost btn-small"
            :disabled="busy || editing !== null"
            @click="removing = tag"
          >
            外す
          </button>
        </template>
      </li>
    </ul>

    <div class="modal-actions">
      <span class="spacer"></span>
      <button type="button" class="btn btn-ghost" @click="emit('close')">閉じる</button>
    </div>

    <ConfirmDialog
      v-if="removing"
      title="タグを外しますか？"
      :message="`「${removing.name}」を、自分の ${removing.count} 冊の本から外します。`"
      note="本は消えません。"
      confirm-label="外す"
      :busy="busy"
      @confirm="onConfirmRemove"
      @cancel="removing = null"
    />
  </div>
</template>

<style scoped>
.tags-text {
  margin: 0 0 10px;
  font-size: 13px;
}
.tags-sub {
  color: var(--text-sub);
}
/* 一覧は画面の高さの 6 割まで伸ばし、それより多いときだけ一覧の中でスクロールする
   （Mac はスクロールバーがふだん隠れていて、続きがあると気づきにくいので、低く切らない） */
.tag-rows {
  margin: 0;
  padding: 0;
  list-style: none;
  max-height: 60vh;
  overflow-y: auto;
}
.tag-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  padding: 6px 0;
  border-bottom: 1px solid var(--border);
}
.tag-chip {
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--slate-tint);
  font-size: 13px;
}
.tag-count {
  font-size: 12px;
  color: var(--text-sub);
  font-variant-numeric: tabular-nums;
}
.rename-form {
  display: flex;
  gap: 6px;
  width: 100%;
}
.rename-input {
  flex: 1;
  min-width: 0;
  padding: 5px 8px;
  border: 1px solid var(--border);
  border-radius: 6px;
  font: inherit;
  font-size: 13px;
}
.merge-note {
  margin: 0;
  width: 100%;
  font-size: 12px;
  color: var(--slate);
}
.form-errors {
  margin: 0 0 10px;
  padding: 10px 12px 10px 28px;
  background: #ffeceb;
  border: 1px solid var(--danger);
  border-radius: 6px;
  color: var(--danger);
  font-size: 13px;
}
.done-message {
  margin: 0 0 10px;
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
.btn-small {
  padding: 4px 10px;
  font-size: 12px;
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
