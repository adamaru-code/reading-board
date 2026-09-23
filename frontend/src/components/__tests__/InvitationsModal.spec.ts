import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import InvitationsModal from '../InvitationsModal.vue'
import * as invitationsApi from '../../api/invitations'
import { ApiError } from '../../api/http'
import type { Invitation } from '../../types/auth'

const invitation = (id: number, overrides: Partial<Invitation> = {}): Invitation => ({
  id,
  code: `CODE${id}`,
  status: 'unused',
  expires_at: '2026-09-30T00:00:00Z',
  used_at: null,
  used_by_email: null,
  created_at: '2026-09-23T00:00:00Z',
  ...overrides,
})

async function mountWith(list: Invitation[]) {
  vi.spyOn(invitationsApi, 'listInvitations').mockResolvedValue(list)
  const wrapper = mount(InvitationsModal)
  await flushPromises()
  return wrapper
}

describe('InvitationsModal', () => {
  it('一覧に状態と使った人を表示し、操作ボタンは未使用だけに出す', async () => {
    const wrapper = await mountWith([
      invitation(2),
      invitation(1, { status: 'used', used_by_email: 'new@example.com' }),
    ])

    const items = wrapper.findAll('.invitation')
    expect(items).toHaveLength(2)
    expect(items[0].text()).toContain('未使用')
    expect(items[0].find('.invitation-actions').exists()).toBe(true)
    expect(items[1].text()).toContain('使用済み')
    expect(items[1].text()).toContain('new@example.com が登録')
    expect(items[1].find('.invitation-actions').exists()).toBe(false)
  })

  it('発行すると先頭に追加する', async () => {
    const wrapper = await mountWith([invitation(1)])
    vi.spyOn(invitationsApi, 'createInvitation').mockResolvedValue(invitation(2))

    await wrapper.find('.btn-primary').trigger('click')
    await flushPromises()

    expect(wrapper.findAll('.invitation-code').map((c) => c.text())).toEqual(['CODE2', 'CODE1'])
  })

  it('削除すると一覧から消え、失敗時はエラーを出す', async () => {
    const wrapper = await mountWith([invitation(1), invitation(2)])
    const spy = vi.spyOn(invitationsApi, 'deleteInvitation').mockResolvedValue()

    await wrapper.findAll('.btn-danger')[0].trigger('click')
    await flushPromises()

    expect(spy).toHaveBeenCalledWith(1)
    expect(wrapper.findAll('.invitation-code').map((c) => c.text())).toEqual(['CODE2'])

    spy.mockRejectedValue(new ApiError(422, ['使用済みの招待は削除できません']))
    await wrapper.find('.btn-danger').trigger('click')
    await flushPromises()
    expect(wrapper.find('[role="alert"]').text()).toBe('使用済みの招待は削除できません')
  })

  it('リンクをコピーする', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    const wrapper = await mountWith([invitation(1)])

    await wrapper.find('.btn-ghost.btn-small').trigger('click')
    await flushPromises()

    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/?invite=CODE1`)
    expect(wrapper.find('.btn-ghost.btn-small').text()).toBe('コピーしました')
  })

  it('401 なら unauthorized を発火する', async () => {
    vi.spyOn(invitationsApi, 'listInvitations').mockRejectedValue(new ApiError(401, []))
    const wrapper = mount(InvitationsModal)
    await flushPromises()
    expect(wrapper.emitted('unauthorized')).toHaveLength(1)
  })
})
