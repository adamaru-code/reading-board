import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import AccountModal from '../AccountModal.vue'
import * as passwordApi from '../../api/password'
import * as registrationApi from '../../api/registration'
import { ApiError } from '../../api/http'

async function fill(current: string, password: string, confirmation: string) {
  const wrapper = mount(AccountModal)
  const inputs = wrapper.findAll('input[type="password"]')
  await inputs[0].setValue(current)
  await inputs[1].setValue(password)
  await inputs[2].setValue(confirmation)
  return wrapper
}

describe('AccountModal（パスワード変更）', () => {
  it('入力値を送信し、成功メッセージを表示する', async () => {
    const spy = vi.spyOn(passwordApi, 'changePassword').mockResolvedValue()

    const wrapper = await fill('old-password', 'new-password', 'new-password')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(spy).toHaveBeenCalledWith({
      current_password: 'old-password',
      password: 'new-password',
      password_confirmation: 'new-password',
    })
    expect(wrapper.find('[role="status"]').text()).toContain('パスワードを変更しました')
  })

  it('確認が一致しないと送信せずヒントを出す', async () => {
    const spy = vi.spyOn(passwordApi, 'changePassword')

    const wrapper = await fill('old-password', 'new-password', 'mismatch-pw')
    await wrapper.find('form').trigger('submit')

    expect(spy).not.toHaveBeenCalled()
    expect(wrapper.find('.field-hint').text()).toBe('新しいパスワード（確認）が一致しません')
    expect(wrapper.find('button[type="submit"]').attributes('disabled')).toBeDefined()
  })

  it('8 文字未満はヒントを出す', async () => {
    const wrapper = await fill('old-password', 'short', '')
    expect(wrapper.find('.field-hint').text()).toContain('8 文字以上')
  })

  it('API のエラーを表示する', async () => {
    vi.spyOn(passwordApi, 'changePassword').mockRejectedValue(
      new ApiError(422, ['現在のパスワードが違います']),
    )

    const wrapper = await fill('wrong', 'new-password', 'new-password')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.find('[role="alert"]').text()).toBe('現在のパスワードが違います')
  })

  it('401 なら unauthorized を発火する', async () => {
    vi.spyOn(passwordApi, 'changePassword').mockRejectedValue(new ApiError(401, []))

    const wrapper = await fill('old-password', 'new-password', 'new-password')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.emitted('unauthorized')).toHaveLength(1)
  })
})

describe('AccountModal（アカウント削除）', () => {
  async function openDeleteTab() {
    const wrapper = mount(AccountModal)
    await wrapper.findAll('[role="tab"]')[1].trigger('click')
    await wrapper.find('input[type="password"]').setValue('current-pw')
    return wrapper
  }

  it('確認にチェックするまで削除できない', async () => {
    const spy = vi.spyOn(registrationApi, 'deleteAccount')
    const wrapper = await openDeleteTab()

    const button = wrapper.find('button.btn-danger')
    expect(button.attributes('disabled')).toBeDefined()
    await wrapper.find('.delete-form').trigger('submit')
    expect(spy).not.toHaveBeenCalled()
  })

  it('削除に成功すると deleted を発火する', async () => {
    const spy = vi.spyOn(registrationApi, 'deleteAccount').mockResolvedValue()
    const wrapper = await openDeleteTab()

    await wrapper.find('input[type="checkbox"]').setValue(true)
    await wrapper.find('.delete-form').trigger('submit')
    await flushPromises()

    expect(spy).toHaveBeenCalledWith('current-pw')
    expect(wrapper.emitted('deleted')).toHaveLength(1)
  })

  it('API のエラーを表示する', async () => {
    vi.spyOn(registrationApi, 'deleteAccount').mockRejectedValue(
      new ApiError(422, ['最後の管理者は削除できません']),
    )
    const wrapper = await openDeleteTab()

    await wrapper.find('input[type="checkbox"]').setValue(true)
    await wrapper.find('.delete-form').trigger('submit')
    await flushPromises()

    expect(wrapper.find('[role="alert"]').text()).toBe('最後の管理者は削除できません')
    expect(wrapper.emitted('deleted')).toBeUndefined()
  })
})
