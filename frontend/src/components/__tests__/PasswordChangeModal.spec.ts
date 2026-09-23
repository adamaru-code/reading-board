import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import PasswordChangeModal from '../PasswordChangeModal.vue'
import * as passwordApi from '../../api/password'
import { ApiError } from '../../api/http'

async function fill(current: string, password: string, confirmation: string) {
  const wrapper = mount(PasswordChangeModal)
  const inputs = wrapper.findAll('input[type="password"]')
  await inputs[0].setValue(current)
  await inputs[1].setValue(password)
  await inputs[2].setValue(confirmation)
  return wrapper
}

describe('PasswordChangeModal', () => {
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
