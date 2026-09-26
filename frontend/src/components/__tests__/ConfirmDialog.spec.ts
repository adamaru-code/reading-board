import { describe, it, expect } from 'vitest'
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

  it('処理中はボタンを押せない', () => {
    const wrapper = mount(ConfirmDialog, { props: { ...props, busy: true } })
    expect(wrapper.find('.btn-danger').text()).toBe('処理中…')
    wrapper.findAll('button').forEach((b) => expect(b.attributes('disabled')).toBeDefined())
  })
})
