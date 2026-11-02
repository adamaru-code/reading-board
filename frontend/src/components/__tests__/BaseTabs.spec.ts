import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import BaseTabs from '../BaseTabs.vue'

const TABS = [
  { key: 'a', label: 'A' },
  { key: 'b', label: 'B' },
  { key: 'c', label: 'C' },
] as const

// v-model（選んでいるタブ）を親から渡したときと同じように動かす
function mountTabs() {
  const selected = ref<'a' | 'b' | 'c'>('a')
  const wrapper = mount(
    {
      components: { BaseTabs },
      setup: () => ({ selected, TABS }),
      template:
        '<BaseTabs v-model="selected" :tabs="TABS"><p class="body">{{ selected }}</p></BaseTabs>',
    },
    { attachTo: document.body },
  )
  const tabs = () => wrapper.findAll('[role="tab"]')
  return { wrapper, selected, tabs }
}

describe('BaseTabs', () => {
  it('→ で次、← で前のタブへ切り替えてフォーカスを移す。端では反対の端へ回る', async () => {
    const { wrapper, selected, tabs } = mountTabs()

    await tabs()[0]!.trigger('keydown', { key: 'ArrowRight' })
    expect(selected.value).toBe('b')
    expect(document.activeElement).toBe(tabs()[1]!.element)

    await tabs()[1]!.trigger('keydown', { key: 'ArrowLeft' })
    await tabs()[0]!.trigger('keydown', { key: 'ArrowLeft' })
    expect(selected.value).toBe('c')
    expect(document.activeElement).toBe(tabs()[2]!.element)

    await tabs()[2]!.trigger('keydown', { key: 'ArrowRight' })
    expect(selected.value).toBe('a')
    wrapper.unmount()
  })

  it('Home で最初、End で最後のタブ。ほかのキーでは変わらない', async () => {
    const { wrapper, selected, tabs } = mountTabs()

    await tabs()[0]!.trigger('keydown', { key: 'End' })
    expect(selected.value).toBe('c')
    await tabs()[2]!.trigger('keydown', { key: 'Home' })
    expect(selected.value).toBe('a')
    await tabs()[0]!.trigger('keydown', { key: 'ArrowDown' })
    expect(selected.value).toBe('a')
    wrapper.unmount()
  })

  it('選んでいるタブだけ Tab で止まり、中身（tabpanel）と id で結ばれる', async () => {
    const { wrapper, tabs } = mountTabs()
    await tabs()[1]!.trigger('click')

    expect(tabs().map((t) => t.attributes('tabindex'))).toEqual(['-1', '0', '-1'])
    expect(tabs().map((t) => t.attributes('aria-selected'))).toEqual(['false', 'true', 'false'])
    const panel = wrapper.find('[role="tabpanel"]')
    expect(panel.attributes('aria-labelledby')).toBe(tabs()[1]!.attributes('id'))
    expect(tabs()[1]!.attributes('aria-controls')).toBe(panel.attributes('id'))
    expect(panel.find('.body').text()).toBe('b')
    wrapper.unmount()
  })
})
