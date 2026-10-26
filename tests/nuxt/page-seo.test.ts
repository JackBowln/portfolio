import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'

async function headOf(options: Parameters<typeof usePageSeo>[0]) {
  const wrapper = await mountSuspended(defineComponent({
    setup() {
      usePageSeo(options)
      return () => h('main')
    },
  }))
  await nextTick()
  await new Promise(resolve => setTimeout(resolve, 20))
  const head = {
    title: document.title,
    canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href'),
    hreflang: [...document.querySelectorAll('link[rel="alternate"][hreflang]')].map(link => link.getAttribute('hreflang')),
    robots: document.querySelector('meta[name="robots"]')?.getAttribute('content') ?? null,
  }
  // Head entries live as long as the component; unmount so the next test starts clean
  wrapper.unmount()
  return head
}

describe('usePageSeo', () => {
  it('writes the templated title, canonical and hreflang of all locales by default', async () => {
    const head = await headOf({ title: 'Teste', description: 'Descrição' })

    expect(head.title).toBe('Teste — [PLACEHOLDER]')
    expect(head.canonical).toMatch(/^https?:\/\/[^/]+\//)
    expect(head.hreflang).toEqual(['pt-BR', 'en', 'es', 'de', 'fr', 'x-default'])
    expect(head.robots).toBeNull()
  })

  it('limits hreflang to the published locales, with x-default to pt-BR without English', async () => {
    const head = await headOf({ title: 'Teste', description: 'Descrição', published: ['pt-BR', 'de'] })

    expect(head.hreflang).toEqual(['pt-BR', 'de', 'x-default'])
  })
})
