import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import BookFormModal from '../BookFormModal.vue'

const chips = (wrapper: ReturnType<typeof mount>) =>
  wrapper.findAll('.tag-suggest-chip').map((c) => c.text().replace('＋', '').trim())

describe('BookFormModal のタグ候補', () => {
  it('過去に付けたタグを候補に出す', () => {
    const wrapper = mount(BookFormModal, { props: { book: null, knownTags: ['仕事', '読書会'] } })
    expect(chips(wrapper)).toEqual(expect.arrayContaining(['仕事', '読書会']))
  })

  it('タグ欄に文字を打つと候補が絞り込まれ、選ぶと追加されて入力欄が空になる', async () => {
    const wrapper = mount(BookFormModal, { props: { book: null, knownTags: ['仕事', '読書会'] } })
    const input = wrapper.find('input[placeholder="タグを入力して Enter"]')

    await input.setValue('読書')
    expect(chips(wrapper)).toEqual(['読書会'])

    await wrapper.find('.tag-suggest-chip').trigger('click')
    expect(wrapper.findAll('.tag-chip').map((c) => c.text())).toEqual([
      expect.stringContaining('読書会'),
    ])
    expect((input.element as HTMLInputElement).value).toBe('')
  })
})
