import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import * as hiddenTagsApi from '../../api/hiddenTags'
import BookFormModal from '../BookFormModal.vue'

const chips = (wrapper: ReturnType<typeof mount>) =>
  wrapper.findAll('.tag-suggest-chip').map((c) => c.text().trim())

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

  it('候補の × で隠すと API を呼び、更新後の隠したタグ一覧を返す（本のタグは追加されない）', async () => {
    const spy = vi.spyOn(hiddenTagsApi, 'hideTag').mockResolvedValue({ id: 5, name: '仕事' })
    const wrapper = mount(BookFormModal, {
      props: { book: null, knownTags: ['仕事'], hiddenTags: [{ id: 1, name: 'あ' }] },
    })

    await wrapper.find('[aria-label="「仕事」を候補から隠す"]').trigger('click')
    await flushPromises()

    expect(spy).toHaveBeenCalledWith('仕事')
    expect(wrapper.emitted('update:hiddenTags')).toEqual([
      [
        [
          { id: 1, name: 'あ' },
          { id: 5, name: '仕事' },
        ],
      ],
    ])
    expect(wrapper.findAll('.tag-chip')).toHaveLength(0)
  })

  it('隠したタグは候補に出ず、「隠した候補」から戻せる', async () => {
    const spy = vi.spyOn(hiddenTagsApi, 'unhideTag').mockResolvedValue()
    const hiddenTags = [{ id: 5, name: '仕事' }]
    const wrapper = mount(BookFormModal, { props: { book: null, knownTags: ['仕事'], hiddenTags } })

    expect(chips(wrapper)).not.toContain('仕事')
    const toggle = wrapper.find('.tag-hidden .tag-suggest-more')
    expect(toggle.text()).toContain('隠した候補（1）')

    await toggle.trigger('click')
    await wrapper.find('.tag-unhide').trigger('click')
    await flushPromises()

    expect(spy).toHaveBeenCalledWith(5)
    expect(wrapper.emitted('update:hiddenTags')).toEqual([[[]]])
  })

  it('候補はタグ名だけを表示し（「＋」なし）、読み上げ用に「追加」の説明を付ける', () => {
    const wrapper = mount(BookFormModal, { props: { book: null, knownTags: ['仕事'] } })
    const chip = wrapper.findAll('.tag-suggest-chip').find((c) => c.text() === '仕事')!
    expect(chip.text()).toBe('仕事')
    expect(chip.attributes('aria-label')).toBe('「仕事」をタグに追加')
  })
})
