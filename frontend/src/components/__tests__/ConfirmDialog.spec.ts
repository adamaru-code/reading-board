import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ConfirmDialog from '../ConfirmDialog.vue'

const props = {
  title: '本を削除しますか？',
  message: '「こころ」を削除します。',
  note: 'この操作は取り消せません。',
}

describe('ConfirmDialog', () => {
  it('見出し・メッセージ・補足とボタンを表示する', () => {
    const wrapper = mount(ConfirmDialog, { props })
    expect(wrapper.find('#confirm-title').text()).toContain('本を削除しますか？')
    expect(wrapper.find('#confirm-message').text()).toBe('「こころ」を削除します。')
    expect(wrapper.find('.confirm-note').text()).toBe('この操作は取り消せません。')
    expect(wrapper.findAll('button').map((b) => b.text())).toEqual(['キャンセル', '削除'])
  })

  it('開いた時点で「キャンセル」にフォーカスする（誤って削除しないように）', () => {
    const wrapper = mount(ConfirmDialog, { props, attachTo: document.body })
    expect(document.activeElement).toBe(wrapper.find('.btn-ghost').element)
    wrapper.unmount()
  })

  it('「削除」で confirm、「キャンセル」・Esc・背景クリックで cancel を発火する', async () => {
    const wrapper = mount(ConfirmDialog, { props })
    await wrapper.find('.btn-danger').trigger('click')
    expect(wrapper.emitted('confirm')).toHaveLength(1)

    await wrapper.find('.btn-ghost').trigger('click')
    await wrapper.find('.confirm').trigger('keydown', { key: 'Escape' })
    await wrapper.find('.confirm-overlay').trigger('click')
    expect(wrapper.emitted('cancel')).toHaveLength(3)
  })

  it('Tab は確認ダイアログの中だけを回り、後ろ（親の画面）へは届かない', () => {
    const onWindowKeydown = vi.fn()
    window.addEventListener('keydown', onWindowKeydown)
    const wrapper = mount(ConfirmDialog, { props, attachTo: document.body })
    const cancel = wrapper.find('.btn-ghost').element as HTMLElement
    const confirm = wrapper.find('.btn-danger').element as HTMLElement
    const pressTab = (shiftKey = false) => {
      const event = new KeyboardEvent('keydown', {
        key: 'Tab',
        shiftKey,
        bubbles: true,
        cancelable: true,
      })
      document.activeElement!.dispatchEvent(event)
      return event
    }

    confirm.focus()
    expect(pressTab().defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(cancel)
    expect(pressTab(true).defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(confirm)
    expect(onWindowKeydown).not.toHaveBeenCalled()

    wrapper.unmount()
    window.removeEventListener('keydown', onWindowKeydown)
  })

  it('閉じると、開く前の場所（「削除」ボタン）へフォーカスを戻す', () => {
    const opener = document.createElement('button')
    document.body.appendChild(opener)
    opener.focus()

    const wrapper = mount(ConfirmDialog, { props, attachTo: document.body })
    expect(document.activeElement).not.toBe(opener)
    wrapper.unmount()
    expect(document.activeElement).toBe(opener)
    opener.remove()
  })

  it('閉じたとき、ほかの部品がすでにフォーカスを移していたら、そのままにする', () => {
    const opener = document.createElement('button')
    const other = document.createElement('button')
    document.body.append(opener, other)
    opener.focus()

    const wrapper = mount(ConfirmDialog, { props, attachTo: document.body })
    other.focus()
    wrapper.unmount()
    expect(document.activeElement).toBe(other)
    opener.remove()
    other.remove()
  })

  it('処理中はボタンを押せない', () => {
    const wrapper = mount(ConfirmDialog, { props: { ...props, busy: true } })
    expect(wrapper.find('.btn-danger').text()).toBe('処理中…')
    wrapper.findAll('button').forEach((b) => expect(b.attributes('disabled')).toBeDefined())
  })
})
