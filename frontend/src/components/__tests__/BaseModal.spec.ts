import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import BaseModal from '../BaseModal.vue'
import BookFormModal from '../BookFormModal.vue'

describe('BaseModal', () => {
  it('見出しを出し、ダイアログと aria-labelledby で結ぶ', () => {
    const wrapper = mount(BaseModal, {
      props: { title: '管理' },
      slots: { default: '<p>中身</p>' },
    })
    const dialog = wrapper.find('[role="dialog"]')
    const heading = wrapper.find('h2')

    expect(heading.text()).toBe('管理')
    expect(dialog.attributes('aria-labelledby')).toBe(heading.attributes('id'))
    expect(dialog.text()).toContain('中身')
  })

  it('背景をクリックすると close、枠の中のクリックでは close しない', async () => {
    const wrapper = mount(BaseModal, { props: { title: 't' } })

    await wrapper.find('[role="dialog"]').trigger('click')
    expect(wrapper.emitted('close')).toBeUndefined()

    await wrapper.find('.modal-overlay').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('フォーカスが外（ヘッダーのボタンなど）にあっても Esc で close。closeOnEsc=false なら close しない', () => {
    const wrapper = mount(BaseModal, { props: { title: 't' } })
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(wrapper.emitted('close')).toHaveLength(1)
    wrapper.unmount()

    const noEsc = mount(BaseModal, { props: { title: 't', closeOnEsc: false } })
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(noEsc.emitted('close')).toBeUndefined()
    noEsc.unmount()
  })

  it('開くとフォーカスを枠へ移し、閉じると開く前のボタンへ戻す', () => {
    const opener = document.createElement('button')
    document.body.appendChild(opener)
    opener.focus()

    const wrapper = mount(BaseModal, { props: { title: 't' }, attachTo: document.body })
    expect(document.activeElement).toBe(wrapper.find('[role="dialog"]').element)

    wrapper.unmount()
    expect(document.activeElement).toBe(opener)
    opener.remove()
  })

  it('書籍フォームは Esc では閉じない（入力中の内容を守る）', () => {
    const wrapper = mount(BookFormModal, { props: { book: null } })
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(wrapper.emitted('close')).toBeUndefined()
    expect(wrapper.find('h2').text()).toBe('書籍を追加')
  })
})
