<script setup lang="ts">
import { ref, computed } from 'vue'
import { ApiError } from '../api/http'
import type { HiddenTag } from '../types/book'
import { suggestTags, SUGGEST_LIMIT } from '../lib/tagSuggestions'
import { hideTag, unhideTag } from '../api/hiddenTags'

// 書籍フォームの「タグ」欄：チップ入力＋候補タグ＋候補から隠す/戻す。
// v-model：本に付けるタグ／v-model:hidden-tags：候補から隠したタグ（隠す・戻すと更新後の一覧を返す）
const tags = defineModel<string[]>({ required: true })
const hiddenTags = defineModel<HiddenTag[]>('hiddenTags', { default: () => [] })

// title・author：候補の辞書に使う／knownTags：自分が過去に付けたタグ（よく使う順）
const props = withDefaults(defineProps<{ title: string; author: string; knownTags?: string[] }>(), {
  knownTags: () => [],
})
const emit = defineEmits<{ error: [messages: string[]] }>()

const tagInput = ref('')

// タグ名の書き方をそろえる（全角英数字 → 半角、半角カナ → 全角など。バックエンドの Tag.normalize_name と同じ NFKC）
function normalizeTagName(name: string): string {
  return name.normalize('NFKC').trim()
}

function addTag() {
  const name = normalizeTagName(tagInput.value)
  if (name !== '' && !tags.value.includes(name)) tags.value = [...tags.value, name]
  tagInput.value = ''
}

function removeTag(name: string) {
  tags.value = tags.value.filter((t) => t !== name)
}

function addSuggestedTag(tag: string) {
  if (!tags.value.includes(tag)) tags.value = [...tags.value, tag]
  tagInput.value = '' // 絞り込みに使った入力中の文字は消す
}

// 保存の直前に親から呼ぶ：Enter を押し忘れてタグ欄に残っている文字もタグにする
defineExpose({ commitInput: addTag })

// 候補タグ：辞書（タイトル・著者）＋過去に付けたタグ。入力中の文字があれば絞り込む（入力済みは除外）。
// 最初は SUGGEST_LIMIT 件だけ出し、「すべて表示」で全部出す
const showAllSuggestions = ref(false)
const allSuggestedTags = computed(() =>
  suggestTags(props.title, props.author, tags.value, {
    knownTags: props.knownTags,
    query: tagInput.value,
    limit: Infinity,
    hiddenTags: hiddenTags.value.map((t) => t.name),
  }),
)
const suggestedTags = computed(() =>
  showAllSuggestions.value
    ? allSuggestedTags.value
    : allSuggestedTags.value.slice(0, SUGGEST_LIMIT),
)
const moreSuggestionCount = computed(
  () => allSuggestedTags.value.length - suggestedTags.value.length,
)

// ---------- 候補から隠す / 戻す（本に付いているタグは変わらない） ----------
const showHiddenTags = ref(false)
const hidingTag = ref(false)

function errorMessages(e: unknown, fallback: string): string[] {
  return e instanceof ApiError && e.errors.length > 0 ? e.errors : [fallback]
}

async function onHideSuggestion(name: string) {
  hidingTag.value = true
  try {
    const hidden = await hideTag(name)
    const rest = hiddenTags.value.filter((t) => t.id !== hidden.id)
    hiddenTags.value = [...rest, hidden].sort((a, b) => a.name.localeCompare(b.name, 'ja'))
  } catch (e) {
    emit('error', errorMessages(e, '候補を隠せませんでした。'))
  } finally {
    hidingTag.value = false
  }
}

async function onUnhideSuggestion(tag: HiddenTag) {
  hidingTag.value = true
  try {
    await unhideTag(tag.id)
    hiddenTags.value = hiddenTags.value.filter((t) => t.id !== tag.id)
  } catch (e) {
    emit('error', errorMessages(e, '候補に戻せませんでした。'))
  } finally {
    hidingTag.value = false
  }
}
</script>

<template>
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
      <span v-for="tag in suggestedTags" :key="tag" class="tag-suggest-item">
        <button
          type="button"
          class="tag-suggest-chip"
          :aria-label="`「${tag}」をタグに追加`"
          :title="`「${tag}」をタグに追加`"
          @click="addSuggestedTag(tag)"
        >
          {{ tag }}
        </button>
        <button
          type="button"
          class="tag-suggest-hide"
          :aria-label="`「${tag}」を候補から隠す`"
          title="候補から隠す（本のタグは消えません）"
          :disabled="hidingTag"
          @click="onHideSuggestion(tag)"
        >
          ×
        </button>
      </span>
      <button
        v-if="moreSuggestionCount > 0"
        type="button"
        class="tag-suggest-more"
        @click="showAllSuggestions = true"
      >
        すべて表示（残り {{ moreSuggestionCount }} 件）
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
    <div v-if="hiddenTags.length" class="tag-hidden">
      <button
        type="button"
        class="tag-suggest-more"
        :aria-expanded="showHiddenTags"
        @click="showHiddenTags = !showHiddenTags"
      >
        隠した候補（{{ hiddenTags.length }}）{{ showHiddenTags ? '▲' : '▼' }}
      </button>
      <ul v-if="showHiddenTags" class="tag-hidden-list">
        <li v-for="tag in hiddenTags" :key="tag.id" class="tag-hidden-item">
          <span>{{ tag.name }}</span>
          <button
            type="button"
            class="tag-unhide"
            :disabled="hidingTag"
            @click="onUnhideSuggestion(tag)"
          >
            候補に戻す
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
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
.tag-suggest-item {
  display: inline-flex;
  align-items: stretch;
}
.tag-suggest-item .tag-suggest-chip {
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
}
.tag-suggest-hide {
  font-size: 12px;
  border: 1px dashed var(--border);
  border-left: none;
  border-radius: 0 4px 4px 0;
  background: var(--surface);
  color: var(--text-sub);
  padding: 2px 6px;
  cursor: pointer;
}
.tag-suggest-hide:hover:not(:disabled) {
  color: var(--danger);
}
.tag-hidden {
  margin-top: 6px;
}
.tag-hidden-list {
  list-style: none;
  margin: 4px 0 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.tag-hidden-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--text-sub);
  background: var(--bg);
  border-radius: 4px;
  padding: 2px 4px 2px 8px;
}
.tag-unhide {
  font-size: 11px;
  border: 1px solid var(--border);
  background: var(--surface);
  border-radius: 4px;
  padding: 1px 6px;
  cursor: pointer;
}
</style>
