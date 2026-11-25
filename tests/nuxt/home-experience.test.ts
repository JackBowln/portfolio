// F13-T3: the home's experience is the about timeline, in its order. A role with no title is left out; the block is
// pinned on desktop only from three roles (the attribute is in the server HTML, the scene reads it); with no roles
// there is no section at all
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import HomeContent from '~/components/pages/HomeContent.vue'
import { EMPTY_PAGE_BLOCKS } from '#shared/pages/blocks'
import type { PageBlocks } from '#shared/pages/blocks'
import type { PublicPage } from '#shared/pages/public'

const role = (title: string) => ({ period: '2024 – 2025', title, text: `Work at ${title}` })

function pageWith(experience: { period: string, title: string, text: string }[]): PublicPage<PageBlocks<'home'>> & { blocks: PageBlocks<'home'> } {
  return {
    key: 'home',
    fallback: false,
    empty: false,
    blocks: { ...EMPTY_PAGE_BLOCKS.home, hero: { ...EMPTY_PAGE_BLOCKS.home.hero, title: 'Título' } },
    published: ['pt-BR'],
    seo: { title: null, description: null, noindex: false },
    media: {},
    home: { projects: [], articles: [], experience },
    cacheTags: [],
  } as never
}

describe('home experience', () => {
  it('lists the roles in order, each with its period and title', async () => {
    const wrapper = await mountSuspended(HomeContent, { props: { page: pageWith([role('Alpha'), role('Beta')]) } })
    const steps = wrapper.findAll('[data-motion="experience-step"]')
    expect(steps.map(step => step.find('h3').text())).toEqual(['Alpha', 'Beta'])
    expect(steps[0]!.find('p').text()).toBe('2024 – 2025')
  })

  it('leaves out a role with no title', async () => {
    const wrapper = await mountSuspended(HomeContent, { props: { page: pageWith([role('Alpha'), role('  '), role('Gamma')]) } })
    expect(wrapper.findAll('[data-motion="experience-step"]').map(step => step.find('h3').text())).toEqual(['Alpha', 'Gamma'])
  })

  it('pins the block only from three roles', async () => {
    const two = await mountSuspended(HomeContent, { props: { page: pageWith([role('A'), role('B')]) } })
    expect(two.find('[data-motion="experience"]').attributes('data-pin')).toBeUndefined()
    const three = await mountSuspended(HomeContent, { props: { page: pageWith([role('A'), role('B'), role('C')]) } })
    expect(three.find('[data-motion="experience"]').attributes('data-pin')).toBeDefined()
  })

  it('renders no section when there are no roles', async () => {
    const wrapper = await mountSuspended(HomeContent, { props: { page: pageWith([]) } })
    expect(wrapper.find('[data-motion="experience"]').exists()).toBe(false)
  })
})
