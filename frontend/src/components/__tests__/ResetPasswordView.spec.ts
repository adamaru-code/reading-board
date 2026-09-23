import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import ResetPasswordView from '../ResetPasswordView.vue'
import * as resetApi from '../../api/passwordReset'
import { ApiError } from '../../api/http'

async function fill(password: string, confirmation = password) {
  const wrapper = mount(ResetPasswordView, { props: { token: 'signed-token' } })
  const inputs = wrapper.findAll('input[type="password"]')
  await inputs[0].setValue(password)
  await inputs[1].setValue(confirmation)
  return wrapper
}

describe('ResetPasswordView', () => {
  it('トークンと新しいパスワードを送信し、成功で logged-in を発火する', async () => {
    const user = { id: 3, email: 'friend@example.com', admin: false }
    const spy = vi.spyOn(resetApi, 'resetPassword').mockResolvedValue(user)

    const wrapper = await fill('new-password')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(spy).toHaveBeenCalledWith({
      token: 'signed-token',
      password: 'new-password',
      password_confirmation: 'new-password',
    })
    expect(wrapper.emitted('logged-in')).toEqual([[user]])
  })

  it('無効なリンクのエラーを表示する', async () => {
    vi.spyOn(resetApi, 'resetPassword').mockRejectedValue(
      new ApiError(422, ['再設定リンクが無効か、期限切れです']),
    )

    const wrapper = await fill('new-password')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.find('[role="alert"]').text()).toBe('再設定リンクが無効か、期限切れです')
    expect(wrapper.emitted('logged-in')).toBeUndefined()
  })

  it('短いパスワードは送信しない', async () => {
    const spy = vi.spyOn(resetApi, 'resetPassword')
    const wrapper = await fill('short')
    await wrapper.find('form').trigger('submit')

    expect(spy).not.toHaveBeenCalled()
    expect(wrapper.find('.field-hint').text()).toContain('8 文字以上')
  })
})
