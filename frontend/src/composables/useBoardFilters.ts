// ボードの絞り込み（キーワード・ジャンル・タグ・評価）と、タグの選択肢。KanbanBoard.vue から分けた（#370）
import { reactive, ref, computed } from 'vue'
import { listAllBooks } from '../api/books'
import type { BookGenre, BookListParams, RatingFilter } from '../types/book'

export function useBoardFilters() {
  const filters = reactive<{
    genre: '' | BookGenre
    keyword: string
    tag: string
    rating: '' | RatingFilter
  }>({
    genre: '',
    keyword: '',
    tag: '',
    rating: '',
  })
  // タグ選択肢は絞り込みで痩せないよう、未絞り込みの一覧から集める
  const tagOptions = ref<string[]>([])
  // 自分が付けたタグをよく使う順に（書籍フォームのタグ候補に使う）
  const frequentTags = ref<string[]>([])

  // 使っている絞り込みの数（スマホのヘッダの「絞り込み 2 ▼」に出す）
  const activeFilterCount = computed(() => {
    const used = [filters.keyword.trim(), filters.genre, filters.tag, filters.rating]
    return used.filter((value) => value !== '').length
  })

  // API に渡す形（使っていない条件は送らない）
  function activeParams(): BookListParams {
    const params: BookListParams = {}
    if (filters.genre !== '') params.genre = filters.genre
    if (filters.keyword.trim() !== '') params.q = filters.keyword.trim()
    if (filters.tag !== '') params.tag = filters.tag
    if (filters.rating !== '') params.rating = filters.rating
    return params
  }

  // 条件を空に戻す（取り直しは呼び出し側で行う）
  function resetFilters() {
    filters.genre = ''
    filters.keyword = ''
    filters.tag = ''
    filters.rating = ''
  }

  async function loadTagOptions() {
    try {
      const all = await listAllBooks()
      const counts = new Map<string, number>()
      for (const tag of all.flatMap((b) => b.tags)) counts.set(tag, (counts.get(tag) ?? 0) + 1)
      tagOptions.value = [...counts.keys()].sort()
      frequentTags.value = [...counts.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ja'))
        .map(([tag]) => tag)
    } catch {
      // タグ選択肢の取得失敗はボード表示を妨げないので黙って諦める
    }
  }

  return {
    filters,
    tagOptions,
    frequentTags,
    activeFilterCount,
    activeParams,
    resetFilters,
    loadTagOptions,
  }
}
