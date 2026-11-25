// F13-T2: the home's stats strip is part of the server HTML as the owner wrote it (the final values), a figure with no
// value or no label is left out, and a page with no figures renders no strip at all
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import HomeContent from '~/components/pages/HomeContent.vue'
import { EMPTY_PAGE_BLOCKS } from '#shared/pages/blocks'
import type { PageBlocks } from '#shared/pages/blocks'
import type { PublicPage } from '#shared/pages/public'

function pageWith(stats: PageBlocks<'home'>['stats']): PublicPage<PageBlocks<'home'>> & { blocks: PageBlocks<'home'> } {
  return {
    key: 'home',
    fallback: false,
    empty: false,
    blocks: { ...EMPTY_PAGE_BLOCKS.home, hero: { ...EMPTY_PAGE_BLOCKS.home.hero, title: 'Título' }, stats },
    published: ['pt-BR'],
    seo: { title: null, description: null, noindex: false },
    media: {},
    cacheTags: [],
  } as never
}

describe('home stats strip', () => {
  it('renders each figure as written, label first, in the order the owner chose', async () => {
    const wrapper = await mountSuspended(HomeContent, {
      props: { page: pageWith([{ value: '6+', label: 'Anos de experiência' }, { value: '~5M', label: 'Utilizadores' }]) },
    })
    const figures = wrapper.findAll('dl > div')
    expect(figures).toHaveLength(2)
    expect(figures[0]!.find('dt').text()).toBe('Anos de experiência')
    expect(figures[0]!.find('dd').text()).toBe('6+')
    expect(figures[1]!.find('dd').text()).toBe('~5M')
  })

  it('leaves out a figure with no value or no label', async () => {
    const wrapper = await mountSuspended(HomeContent, {
      props: { page: pageWith([{ value: '', label: 'Sem número' }, { value: '90%+', label: '' }, { value: '70–80%', label: 'Mais rápido' }]) },
    })
    const figures = wrapper.findAll('dl > div')
    expect(figures).toHaveLength(1)
    expect(figures[0]!.find('dd').text()).toBe('70–80%')
  })

  it('renders no strip when there are no figures', async () => {
    const wrapper = await mountSuspended(HomeContent, { props: { page: pageWith([]) } })
    expect(wrapper.find('dl').exists()).toBe(false)
  })
})
