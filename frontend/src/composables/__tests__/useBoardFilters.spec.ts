import { describe, it, expect, vi } from 'vitest'
import * as booksApi from '../../api/books'
import { useBoardFilters } from '../useBoardFilters'
import type { Book } from '../../types/book'

describe('useBoardFilters', () => {
  it('使っている条件だけを API に渡し、その数を数える。resetFilters で空に戻す', () => {
    const { filters, activeParams, activeFilterCount, resetFilters } = useBoardFilters()
    expect(activeParams()).toEqual({})
    expect(activeFilterCount.value).toBe(0)

    filters.keyword = '  こころ  '
    filters.genre = 'classic_novel'
    filters.rating = '4'
    expect(activeParams()).toEqual({ q: 'こころ', genre: 'classic_novel', rating: '4' })
    expect(activeFilterCount.value).toBe(3)

    // 空白だけのキーワードは使っていない扱い
    filters.keyword = '   '
    expect(activeFilterCount.value).toBe(2)

    resetFilters()
    expect(activeParams()).toEqual({})
    expect(activeFilterCount.value).toBe(0)
  })

  it('タグの選択肢は名前の順、よく使うタグは多い順（同じ数なら名前の順）', async () => {
    const book = (tags: string[]) => ({ tags }) as unknown as Book
    vi.spyOn(booksApi, 'listAllBooks').mockResolvedValue([
      book(['仕事', '小説']),
      book(['小説']),
      book(['あとで', '仕事', '小説']),
    ])
    const { tagOptions, frequentTags, loadTagOptions } = useBoardFilters()
    await loadTagOptions()

    expect(tagOptions.value).toEqual(['あとで', '仕事', '小説'].sort())
    expect(frequentTags.value).toEqual(['小説', '仕事', 'あとで'])
  })
})
