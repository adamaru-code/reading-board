import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import CsvPanel from '../CsvPanel.vue'
import * as booksApi from '../../api/books'
import { ApiError } from '../../api/http'

const CSV_TEXT = 'タイトル\n新しい本\nリーダブルコード\n'

// ファイルを選んだことにする（jsdom の input[type=file] には files を直接入れられないので差し替える）
async function chooseFile(wrapper: ReturnType<typeof mount>, text = CSV_TEXT) {
  const input = wrapper.find('input[type="file"]')
  const file = new File([text], 'books.csv', { type: 'text/csv' })
  Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
  await input.trigger('change')
  await flushPromises()
}

describe('CsvPanel（CSV の書き出し・読み込み）', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('ファイルを選ぶと登録せずに確かめ（dry_run）、足す冊数と飛ばす本を出す', async () => {
    const spy = vi.spyOn(booksApi, 'importBooks').mockResolvedValue({
      to_create: 1,
      skipped: [{ line: 3, title: 'リーダブルコード' }],
    } as never)
    const wrapper = mount(CsvPanel)
    await chooseFile(wrapper)

    expect(spy).toHaveBeenCalledWith(CSV_TEXT, true)
    const preview = wrapper.find('.import-preview')
    expect(preview.text()).toContain('「books.csv」から 1 冊を新しく足します')
    expect(preview.find('.skipped-list').text()).toBe('3 行目：リーダブルコード')
    expect(wrapper.emitted('imported')).toBeUndefined()
  })

  it('「取り込む」で同じ中身を本番で送り、取り込んだ冊数を出して imported を伝える', async () => {
    const spy = vi
      .spyOn(booksApi, 'importBooks')
      .mockResolvedValueOnce({ to_create: 1, skipped: [] } as never)
      .mockResolvedValueOnce({ created: 1, skipped: [] } as never)
    const wrapper = mount(CsvPanel)
    await chooseFile(wrapper)
    await wrapper.find('.import-preview button').trigger('click')
    await flushPromises()

    expect(spy).toHaveBeenLastCalledWith(CSV_TEXT, false)
    expect(wrapper.find('.done-message').text()).toBe('1 冊を取り込みました。')
    expect(wrapper.find('.import-preview').exists()).toBe(false)
    expect(wrapper.emitted('imported')).toHaveLength(1)
  })

  it('足す本が 0 冊なら「取り込む」は押せない', async () => {
    vi.spyOn(booksApi, 'importBooks').mockResolvedValue({
      to_create: 0,
      skipped: [{ line: 2, title: 'リーダブルコード' }],
    } as never)
    const wrapper = mount(CsvPanel)
    await chooseFile(wrapper)
    expect(wrapper.find('.import-preview button').attributes('disabled')).toBeDefined()
  })

  it('間違った行があれば行番号付きのエラーを出し、取り込むボタンは出さない', async () => {
    vi.spyOn(booksApi, 'importBooks').mockRejectedValue(
      new ApiError(422, ['3 行目：評価は 1〜5 の数字か空欄にしてください（「9」は使えません）']),
    )
    const wrapper = mount(CsvPanel)
    await chooseFile(wrapper)
    expect(wrapper.find('[role="alert"]').text()).toContain('3 行目：評価は 1〜5')
    expect(wrapper.find('.import-preview').exists()).toBe(false)
  })

  it('ログインが切れていたら unauthorized を伝える', async () => {
    vi.spyOn(booksApi, 'importBooks').mockRejectedValue(new ApiError(401, []))
    const wrapper = mount(CsvPanel)
    await chooseFile(wrapper)
    expect(wrapper.emitted('unauthorized')).toHaveLength(1)
  })
})
