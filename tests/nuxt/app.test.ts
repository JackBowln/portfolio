import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import { h } from 'vue'
import DefaultLayout from '~/layouts/default.vue'
import IndexPage from '~/pages/index.vue'

// F08-T2: the home reads its published blocks; nothing published is an empty state named by the site (settings
// defaults here), and a page shown from pt-BR in another locale carries the notice
describe('home page', () => {
  const page = (blocks: unknown, fallback = false) => ({ key: 'home', fallback, empty: !blocks, blocks, published: blocks ? ['pt-BR'] : [], seo: { title: null, description: null, noindex: false }, media: {}, home: { projects: [], articles: [] }, cacheTags: [] })

  it('shows an empty state while nothing is published', async () => {
    registerEndpoint('/api/public/pages/home', () => page(null))
    const home = await mountSuspended(IndexPage)
    expect(home.get('h1').text()).toBe('[PLACEHOLDER]')
    expect(home.find('[data-testid="page-empty"]').exists()).toBe(true)
    home.unmount()
  })

  it('shows the hero, with the notice when it falls back to pt-BR', async () => {
    const blocks = { hero: { eyebrow: '', title: 'Título publicado', subtitle: '', cta: { label: '', target: 'projects' } }, sections: [], featuredTitle: '', articlesTitle: '', closing: { title: '', text: '', cta: { label: '', target: 'contact' } } }
    registerEndpoint('/api/public/pages/home', () => page(blocks, true))
    clearNuxtState('page:home:pt-BR')
    const home = await mountSuspended(IndexPage)
    expect(home.get('h1').text()).toBe('Título publicado')
    expect(home.find('[data-testid="fallback-notice"]').exists()).toBe(true)
    home.unmount()
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
