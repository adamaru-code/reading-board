import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import TagsPanel from '../TagsPanel.vue'
import * as tagsApi from '../../api/tags'
import { ApiError } from '../../api/http'

const TAGS = [
  { name: '健康', count: 3 },
  { name: '健康法', count: 1 },
]

async function mountPanel() {
  const wrapper = mount(TagsPanel)
  await flushPromises()
  return wrapper
}

const rowOf = (wrapper: ReturnType<typeof mount>, name: string) =>
  wrapper.findAll('.tag-row').find((row) => row.find('.tag-chip').text() === name)!

const buttonOf = (row: ReturnType<ReturnType<typeof mount>['find']>, label: string) =>
  row.findAll('button').find((b) => b.text() === label)!

describe('TagsPanel（タグの管理）', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('自分のタグと冊数を一覧にする（無ければ「まだタグはありません」）', async () => {
    vi.spyOn(tagsApi, 'listMyTags').mockResolvedValue(TAGS)
    const wrapper = await mountPanel()
    expect(wrapper.findAll('.tag-row').map((r) => r.find('.tag-count').text())).toEqual([
      '3 冊',
      '1 冊',
    ])

    vi.spyOn(tagsApi, 'listMyTags').mockResolvedValue([])
    expect((await mountPanel()).text()).toContain('まだタグはありません')
  })

  it('「名前を変える」で入力欄になり、変更すると付け替えて一覧を取り直し changed を伝える', async () => {
    const list = vi
      .spyOn(tagsApi, 'listMyTags')
      .mockResolvedValueOnce(TAGS)
      .mockResolvedValueOnce([
        { name: '健康', count: 3 },
        { name: '養生', count: 1 },
      ])
    const rename = vi.spyOn(tagsApi, 'renameTag').mockResolvedValue({ count: 1, merged: false })
    const wrapper = await mountPanel()

    await buttonOf(rowOf(wrapper, '健康法'), '名前を変える').trigger('click')
    await wrapper.find('.rename-input').setValue('養生')
    await wrapper.find('.rename-form').trigger('submit')
    await flushPromises()

    expect(rename).toHaveBeenCalledWith('健康法', '養生')
    expect(list).toHaveBeenCalledTimes(2)
    expect(wrapper.find('.done-message').text()).toBe('「健康法」を「養生」に変えました（1 冊）。')
    expect(wrapper.emitted('changed')).toHaveLength(1)
  })

  it('入力した名前が自分の別のタグと同じなら「1 つにまとめます」と先に知らせ、まとめた結果を出す', async () => {
    vi.spyOn(tagsApi, 'listMyTags').mockResolvedValue(TAGS)
    vi.spyOn(tagsApi, 'renameTag').mockResolvedValue({ count: 1, merged: true })
    const wrapper = await mountPanel()

    await buttonOf(rowOf(wrapper, '健康法'), '名前を変える').trigger('click')
    await wrapper.find('.rename-input').setValue('健康')
    expect(wrapper.find('.merge-note').text()).toBe('「健康」（3 冊）と 1 つにまとめます。')
    await wrapper.find('.rename-form').trigger('submit')
    await flushPromises()
    expect(wrapper.find('.done-message').text()).toBe(
      '「健康法」を「健康」にまとめました（1 冊）。',
    )
  })

  it('「外す」は確認を出し、確認してから外す', async () => {
    vi.spyOn(tagsApi, 'listMyTags').mockResolvedValue(TAGS)
    const remove = vi.spyOn(tagsApi, 'removeTag').mockResolvedValue({ count: 3, merged: false })
    const wrapper = await mountPanel()

    await buttonOf(rowOf(wrapper, '健康'), '外す').trigger('click')
    expect(remove).not.toHaveBeenCalled()
    const dialog = wrapper.find('[role="alertdialog"]')
    expect(dialog.text()).toContain('「健康」を、自分の 3 冊の本から外します。')

    await dialog
      .findAll('button')
      .find((b) => b.text() === '外す')!
      .trigger('click')
    await flushPromises()
    expect(remove).toHaveBeenCalledWith('健康')
    expect(wrapper.find('.done-message').text()).toBe('「健康」を 3 冊から外しました。')
    expect(wrapper.find('[role="alertdialog"]').exists()).toBe(false)
  })

  it('断られたら理由を出し、ログインが切れていたら unauthorized を伝える', async () => {
    vi.spyOn(tagsApi, 'listMyTags').mockResolvedValue(TAGS)
    vi.spyOn(tagsApi, 'renameTag').mockRejectedValueOnce(
      new ApiError(422, ['新しい名前を入力してください']),
    )
    const wrapper = await mountPanel()
    await buttonOf(rowOf(wrapper, '健康法'), '名前を変える').trigger('click')
    await wrapper.find('.rename-input').setValue('')
    await wrapper.find('.rename-form').trigger('submit')
    await flushPromises()
    expect(wrapper.find('[role="alert"]').text()).toContain('新しい名前を入力してください')

    vi.spyOn(tagsApi, 'listMyTags').mockRejectedValue(new ApiError(401, []))
    expect((await mountPanel()).emitted('unauthorized')).toHaveLength(1)
  })
})
