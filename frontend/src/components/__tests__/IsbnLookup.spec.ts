import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import IsbnLookup from '../IsbnLookup.vue'
import BookFormModal from '../BookFormModal.vue'
import * as booksApi from '../../api/books'
import { ApiError } from '../../api/http'

describe('IsbnLookup', () => {
  it('照会できたら result を渡し、「取得しました」を出す', async () => {
    const result = {
      isbn: '9784480037060',
      found: true,
      title: '論語',
      author: '孔子',
      media_type: 'book' as const,
    }
    const spy = vi.spyOn(booksApi, 'lookupBook').mockResolvedValue(result)
    const wrapper = mount(IsbnLookup)

    await wrapper.find('#isbn-input').setValue(' 9784480037060 ')
    await wrapper.find('.isbn-row button').trigger('click')
    await flushPromises()

    expect(spy).toHaveBeenCalledWith('9784480037060')
    expect(wrapper.emitted('start')).toHaveLength(1)
    expect(wrapper.emitted('result')).toEqual([[result]])
    const banner = wrapper.find('[role="status"]')
    expect(banner.classes()).toContain('lookup-found')
    expect(banner.text()).toContain('書誌情報を取得しました。')
  })

  it('該当なしなら黄色の帯で「見つかりませんでした」を出す', async () => {
    vi.spyOn(booksApi, 'lookupBook').mockResolvedValue({
      isbn: '9780000000000',
      found: false,
      title: null,
      author: null,
      media_type: 'book',
    })
    const wrapper = mount(IsbnLookup)

    await wrapper.find('#isbn-input').setValue('9780000000000')
    await wrapper.find('.isbn-row button').trigger('click')
    await flushPromises()

    const banner = wrapper.find('[role="status"]')
    expect(banner.classes()).toContain('lookup-not-found')
    expect(banner.text()).toContain('該当が見つかりませんでした。')
  })

  it('照会に失敗したら error でメッセージを渡す', async () => {
    vi.spyOn(booksApi, 'lookupBook').mockRejectedValue(new ApiError(422, ['ISBN が不正です']))
    const wrapper = mount(IsbnLookup)

    await wrapper.find('#isbn-input').setValue('123')
    await wrapper.find('.isbn-row button').trigger('click')
    await flushPromises()

    expect(wrapper.emitted('error')).toEqual([[['ISBN が不正です']]])
    expect(wrapper.emitted('result')).toBeUndefined()
  })
})

describe('BookFormModal の ISBN 照会', () => {
  it('照会結果をタイトル・著者・形態に反映する', async () => {
    vi.spyOn(booksApi, 'lookupBook').mockResolvedValue({
      isbn: '4910000000000',
      found: true,
      title: '表現者クライテリオン',
      author: null,
      media_type: 'magazine',
    })
    const wrapper = mount(BookFormModal, { props: { book: null } })

    await wrapper.find('#isbn-input').setValue('4910000000000')
    await wrapper.find('#isbn-input').trigger('keydown', { key: 'Enter' })
    await flushPromises()

    const title = wrapper.find('input[required]').element as HTMLInputElement
    expect(title.value).toBe('表現者クライテリオン')
    const selects = wrapper.findAll('select').map((s) => (s.element as HTMLSelectElement).value)
    expect(selects).toContain('magazine')
  })
})
