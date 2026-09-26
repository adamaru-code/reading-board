import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import BookFormModal from '../BookFormModal.vue'
import ConfirmDialog from '../ConfirmDialog.vue'
import * as booksApi from '../../api/books'
import { ApiError } from '../../api/http'
import type { Book } from '../../types/book'

const book = {
  id: 7,
  title: 'こころ',
  author: '夏目漱石',
  status: 'read',
  genre: 'classic_novel',
  media_type: 'book',
  rating: null,
  memo: null,
  position: null,
  tags: [],
  registered_on: null,
  started_on: null,
  finished_on: null,
  duration_days: null,
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
} as Book

function mountEdit() {
  return mount(BookFormModal, { props: { book } })
}

describe('BookFormModal の削除', () => {
  it('「削除」を押すと確認ダイアログを出し、キャンセルなら削除しない', async () => {
    const spy = vi.spyOn(booksApi, 'deleteBook')
    const wrapper = mountEdit()

    await wrapper.find('.modal-actions .btn-danger').trigger('click')
    const dialog = wrapper.findComponent(ConfirmDialog)
    expect(dialog.exists()).toBe(true)
    expect(dialog.text()).toContain('「こころ」を削除します。')

    await dialog.find('.btn-ghost').trigger('click')
    expect(wrapper.findComponent(ConfirmDialog).exists()).toBe(false)
    expect(spy).not.toHaveBeenCalled()
    expect(wrapper.emitted('deleted')).toBeUndefined()
  })

  it('確認ダイアログで「削除」を選ぶと削除して deleted を発火する', async () => {
    const spy = vi.spyOn(booksApi, 'deleteBook').mockResolvedValue()
    const wrapper = mountEdit()

    await wrapper.find('.modal-actions .btn-danger').trigger('click')
    await wrapper.findComponent(ConfirmDialog).find('.btn-danger').trigger('click')
    await flushPromises()

    expect(spy).toHaveBeenCalledWith(7)
    expect(wrapper.emitted('deleted')).toHaveLength(1)
  })

  it('削除に失敗したら確認ダイアログを閉じてエラーを表示する', async () => {
    vi.spyOn(booksApi, 'deleteBook').mockRejectedValue(new ApiError(404, ['本が見つかりません']))
    const wrapper = mountEdit()

    await wrapper.find('.modal-actions .btn-danger').trigger('click')
    await wrapper.findComponent(ConfirmDialog).find('.btn-danger').trigger('click')
    await flushPromises()

    expect(wrapper.findComponent(ConfirmDialog).exists()).toBe(false)
    expect(wrapper.find('[role="alert"]').text()).toContain('本が見つかりません')
    expect(wrapper.emitted('deleted')).toBeUndefined()
  })
})
