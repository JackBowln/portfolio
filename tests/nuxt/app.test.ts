import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import { h } from 'vue'
import DefaultLayout from '~/layouts/default.vue'
import IndexPage from '~/pages/index.vue'

describe('home page', () => {
  it('renders the placeholder heading', async () => {
    const page = await mountSuspended(IndexPage)
    expect(page.get('h1').text()).toBe('[PLACEHOLDER]')
  })
})

// F01-T5: the layout owns the single <main>, the skip link's target, after the skip link and the header
describe('default layout', () => {
  it('puts the page inside main#main, after the skip link and the header', async () => {
    const layout = await mountSuspended(DefaultLayout, { slots: { default: () => h('h1', 'Page') } })
    expect(layout.findAll('main')).toHaveLength(1)
    expect(layout.get('main#main').attributes('tabindex')).toBe('-1')
    expect(layout.get('main#main h1').text()).toBe('Page')
    const order = [...layout.element.children].map(element => element.tagName.toLowerCase())
    expect(order).toEqual(['a', 'header', 'main', 'footer'])
    expect(layout.get('a').attributes('href')).toBe('#main')
  })
})
