import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import RegisterView from '../RegisterView.vue'
import * as registrationApi from '../../api/registration'
import { ApiError } from '../../api/http'

async function fill(
  wrapper: ReturnType<typeof mount>,
  code: string | null,
  password = 'new-password',
) {
  if (code !== null) await wrapper.find('input[type="text"]').setValue(code)
  await wrapper.find('input[type="email"]').setValue(' new@example.com ')
  const passwords = wrapper.findAll('input[type="password"]')
  await passwords[0].setValue(password)
  await passwords[1].setValue(password)
}

describe('RegisterView', () => {
  it('招待リンクのコードを初期値にする', () => {
    const wrapper = mount(RegisterView, { props: { initialCode: 'ABC123' } })
    expect((wrapper.find('input[type="text"]').element as HTMLInputElement).value).toBe('ABC123')
  })

  it('入力値を送信し、成功で logged-in を発火する', async () => {
    const user = { id: 3, email: 'new@example.com', admin: false }
    const spy = vi.spyOn(registrationApi, 'register').mockResolvedValue(user)
    const wrapper = mount(RegisterView)

    await fill(wrapper, ' ABC123 ')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(spy).toHaveBeenCalledWith({
      invitation_code: 'ABC123',
      email: 'new@example.com',
      password: 'new-password',
      password_confirmation: 'new-password',
    })
    expect(wrapper.emitted('logged-in')).toEqual([[user]])
  })

  it('API のエラーを表示する', async () => {
    vi.spyOn(registrationApi, 'register').mockRejectedValue(
      new ApiError(422, ['招待コードが無効です']),
    )
    const wrapper = mount(RegisterView)

    await fill(wrapper, 'used-code')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.find('[role="alert"]').text()).toBe('招待コードが無効です')
    expect(wrapper.emitted('logged-in')).toBeUndefined()
  })

  it('パスワードが短いと送信しない', async () => {
    const spy = vi.spyOn(registrationApi, 'register')
    const wrapper = mount(RegisterView)

    await fill(wrapper, 'ABC123', 'short')
    await wrapper.find('form').trigger('submit')

    expect(spy).not.toHaveBeenCalled()
    expect(wrapper.find('.field-hint').text()).toContain('8 文字以上')
  })

  it('ログインへの切り替えを発火する', async () => {
    const wrapper = mount(RegisterView)
    await wrapper.find('.switch-link').trigger('click')
    expect(wrapper.emitted('show-login')).toHaveLength(1)
  })
})
