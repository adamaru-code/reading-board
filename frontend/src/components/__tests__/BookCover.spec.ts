import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import BookCard from '../BookCard.vue'
import BookFormModal from '../BookFormModal.vue'
import * as booksApi from '../../api/books'
import type { Book, BookLookupResult } from '../../types/book'

const COVER = 'https://books.google.com/books/content?id=abc&printsec=frontcover&img=1&zoom=1'

function makeBook(overrides: Partial<Book> = {}): Book {
  return {
    id: 7,
    title: 'リーダブルコード',
    author: 'Dustin Boswell',
    status: 'reading',
    genre: 'it_tech',
    media_type: 'book',
    rating: null,
    memo: null,
    position: null,
    isbn: null,
    cover_url: null,
    tags: [],
    registered_on: null,
    started_on: null,
    finished_on: null,
    duration_days: null,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
    ...overrides,
  }
}

function lookup(overrides: Partial<BookLookupResult> = {}): BookLookupResult {
  return {
    isbn: '9784873115658',
    found: true,
    title: 'リーダブルコード',
    author: 'Dustin Boswell',
    media_type: 'book',
    cover_url: COVER,
    ...overrides,
  }
}

describe('BookCard の表紙', () => {
  it('表紙があれば左に出し、無ければ今までどおりのカード', () => {
    const withCover = mount(BookCard, { props: { book: makeBook({ cover_url: COVER }) } })
    expect(withCover.find('.card').classes()).toContain('has-cover')
    expect(withCover.find('img.card-cover').attributes('src')).toBe(COVER)

    const noCover = mount(BookCard, { props: { book: makeBook() } })
    expect(noCover.find('.card').classes()).not.toContain('has-cover')
    expect(noCover.find('img').exists()).toBe(false)
  })

  it('画像が読み込めなかったら表紙なしのカードにする', async () => {
    const wrapper = mount(BookCard, { props: { book: makeBook({ cover_url: COVER }) } })
    await wrapper.find('img.card-cover').trigger('error')
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.find('.card').classes()).not.toContain('has-cover')
  })
})

describe('BookFormModal の表紙', () => {
  it('追加：照会で取れた ISBN と表紙を保存する', async () => {
    vi.spyOn(booksApi, 'lookupBook').mockResolvedValue(lookup())
    const create = vi.spyOn(booksApi, 'createBook').mockResolvedValue(makeBook())
    const wrapper = mount(BookFormModal, { props: { book: null } })

    await wrapper.find('#isbn-input').setValue('9784873115658')
    await wrapper.find('#isbn-input').trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(wrapper.find('img.cover-preview').attributes('src')).toBe(COVER)

    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ isbn: '9784873115658', cover_url: COVER }),
    )
  })

  it('編集：ISBN で表紙だけを取得し、タイトルは変えない', async () => {
    vi.spyOn(booksApi, 'lookupBook').mockResolvedValue(
      lookup({ title: '別のタイトル', author: '別の著者' }),
    )
    const update = vi.spyOn(booksApi, 'updateBook').mockResolvedValue(makeBook())
    const wrapper = mount(BookFormModal, { props: { book: makeBook() } })

    expect(wrapper.find('.cover-empty').text()).toBe('表紙なし')
    await wrapper.find('#cover-isbn-input').setValue('978-4-87311-565-8')
    await wrapper.find('#cover-isbn-input').trigger('keydown', { key: 'Enter' })
    await flushPromises()

    expect(wrapper.find('img.cover-preview').attributes('src')).toBe(COVER)
    expect(wrapper.text()).toContain('表紙を取得しました。')
    const title = wrapper.find('input[required]').element as HTMLInputElement
    expect(title.value).toBe('リーダブルコード')

    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(update).toHaveBeenCalledWith(
      7,
      expect.objectContaining({
        title: 'リーダブルコード',
        isbn: '9784873115658',
        cover_url: COVER,
      }),
    )
  })

  it('編集：表紙が見つからなければ今の表紙のまま（黄色の帯）', async () => {
    vi.spyOn(booksApi, 'lookupBook').mockResolvedValue(lookup({ cover_url: null }))
    const wrapper = mount(BookFormModal, {
      props: { book: makeBook({ isbn: '9784873115658', cover_url: COVER }) },
    })

    await wrapper.find('#cover-isbn-input').trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(wrapper.text()).toContain('この ISBN の表紙は見つかりませんでした。')
    expect(wrapper.find('img.cover-preview').attributes('src')).toBe(COVER)
  })

  it('編集：「表紙を外す」で表紙を消して保存できる', async () => {
    const update = vi.spyOn(booksApi, 'updateBook').mockResolvedValue(makeBook())
    const wrapper = mount(BookFormModal, {
      props: { book: makeBook({ isbn: '9784873115658', cover_url: COVER }) },
    })

    await wrapper.find('.cover-remove').trigger('click')
    expect(wrapper.find('.cover-empty').exists()).toBe(true)

    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(update).toHaveBeenCalledWith(7, expect.objectContaining({ cover_url: null }))
  })
})
