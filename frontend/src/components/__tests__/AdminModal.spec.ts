import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import AdminModal from '../AdminModal.vue'
import InvitationsPanel from '../InvitationsPanel.vue'
import UsersPanel from '../UsersPanel.vue'
import * as invitationsApi from '../../api/invitations'
import * as usersApi from '../../api/users'

describe('AdminModal', () => {
  it('招待タブで開き、ユーザータブに切り替えられる', async () => {
    vi.spyOn(invitationsApi, 'listInvitations').mockResolvedValue([])
    vi.spyOn(usersApi, 'listUsers').mockResolvedValue([])
    const wrapper = mount(AdminModal, { props: { currentUserId: 1 } })
    await flushPromises()

    expect(wrapper.findComponent(InvitationsPanel).exists()).toBe(true)
    expect(wrapper.findComponent(UsersPanel).exists()).toBe(false)

    await wrapper.findAll('[role="tab"]')[1].trigger('click')
    await flushPromises()

    expect(wrapper.findComponent(UsersPanel).exists()).toBe(true)
    expect(wrapper.findComponent(InvitationsPanel).exists()).toBe(false)
  })

  it('閉じるで close を発火する', async () => {
    vi.spyOn(invitationsApi, 'listInvitations').mockResolvedValue([])
    const wrapper = mount(AdminModal, { props: { currentUserId: 1 } })
    await wrapper.find('.btn-close').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
  })
})
