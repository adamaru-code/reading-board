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

  it('候補が多いときは 8 件だけ出し、「すべて表示」で残りも出し、「少なく表示」で戻す', async () => {
    // よく使う順で 11 個（「歴史」は 9 番目以降）
    const knownTags = [
      '積読',
      '名著',
      '健康法',
      '古典',
      '再読したい',
      '定期購読',
      '東洋思想',
      '日本文学',
      '評論',
      '野口整体',
      '歴史',
    ]
    const wrapper = mount(BookFormModal, { props: { book: null, knownTags } })

    expect(chips(wrapper)).toHaveLength(8)
    expect(chips(wrapper)).not.toContain('歴史')
    const more = wrapper.find('.tag-suggest-more')
    expect(more.text()).toBe('すべて表示（残り 3 件）')

    await more.trigger('click')
    expect(chips(wrapper)).toHaveLength(11)
    expect(chips(wrapper)).toContain('歴史')

    await wrapper.find('.tag-suggest-more').trigger('click')
    expect(wrapper.find('.tag-suggest-more').text()).toBe('すべて表示（残り 3 件）')
    expect(chips(wrapper)).toHaveLength(8)
  })
})
