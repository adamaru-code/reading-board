import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import UsersPanel from '../UsersPanel.vue'
import * as usersApi from '../../api/users'
import { ApiError } from '../../api/http'

const users = [
  { id: 1, email: 'owner@example.com', admin: true, created_at: '2026-09-01T00:00:00Z' },
  { id: 3, email: 'friend@example.com', admin: false, created_at: '2026-09-23T00:00:00Z' },
]

async function mountPanel() {
  vi.spyOn(usersApi, 'listUsers').mockResolvedValue(users)
  const wrapper = mount(UsersPanel)
  await flushPromises()
  return wrapper
}

describe('UsersPanel', () => {
  it('ユーザー一覧と管理者バッジを表示する', async () => {
    const wrapper = await mountPanel()
    const items = wrapper.findAll('.user')
    expect(items.map((i) => i.find('.user-email').text())).toEqual([
      'owner@example.com',
      'friend@example.com',
    ])
    expect(items[0].find('.badge').exists()).toBe(true)
    expect(items[1].find('.badge').exists()).toBe(false)
  })

  it('再設定リンクを発行すると、そのユーザーの下にリンクを出してコピーできる', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    const spy = vi
      .spyOn(usersApi, 'createPasswordResetLink')
      .mockResolvedValue({ token: 'tok/en', expires_at: '2026-09-24T00:00:00Z' })
    const wrapper = await mountPanel()

    await wrapper.findAll('.user')[1].find('button').trigger('click')
    await flushPromises()

    expect(spy).toHaveBeenCalledWith(3)
    const url = `${window.location.origin}/?reset=tok%2Fen`
    const issued = wrapper.findAll('.user')[1].find('.issued-url')
    expect((issued.element as HTMLInputElement).value).toBe(url)

    await wrapper.find('.issued .btn-primary').trigger('click')
    await flushPromises()
    expect(writeText).toHaveBeenCalledWith(url)
    expect(wrapper.find('.issued .btn-primary').text()).toBe('コピーしました')
  })

  it('401 なら unauthorized を発火する', async () => {
    vi.spyOn(usersApi, 'listUsers').mockRejectedValue(new ApiError(401, []))
    const wrapper = mount(UsersPanel)
    await flushPromises()
    expect(wrapper.emitted('unauthorized')).toHaveLength(1)
  })
})
