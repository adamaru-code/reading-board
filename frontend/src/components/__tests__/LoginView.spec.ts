import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import LoginView from '../LoginView.vue'
import * as sessionApi from '../../api/session'
import { ApiError } from '../../api/http'

async function submit(email: string, password: string) {
  const wrapper = mount(LoginView)
  await wrapper.find('input[type="email"]').setValue(email)
  await wrapper.find('input[type="password"]').setValue(password)
  await wrapper.find('form').trigger('submit')
  await flushPromises()
  return wrapper
}

describe('LoginView', () => {
  it('ログイン成功で logged-in を発火する', async () => {
    const user = { id: 1, email: 'owner@example.com', admin: true }
    const loginSpy = vi.spyOn(sessionApi, 'login').mockResolvedValue(user)

    const wrapper = await submit(' owner@example.com ', 'secret')

    expect(loginSpy).toHaveBeenCalledWith('owner@example.com', 'secret')
    expect(wrapper.emitted('logged-in')).toEqual([[user]])
  })

  it('失敗時は API のエラーメッセージを表示する', async () => {
    vi.spyOn(sessionApi, 'login').mockRejectedValue(
      new ApiError(401, ['メールアドレスまたはパスワードが違います']),
    )

    const wrapper = await submit('owner@example.com', 'wrong')

    expect(wrapper.find('[role="alert"]').text()).toBe('メールアドレスまたはパスワードが違います')
    expect(wrapper.emitted('logged-in')).toBeUndefined()
  })
})

describe('LoginView の新規登録リンク', () => {
  it('show-register を発火する', async () => {
    const wrapper = mount(LoginView)
    await wrapper.find('.switch-link').trigger('click')
    expect(wrapper.emitted('show-register')).toHaveLength(1)
  })
})
