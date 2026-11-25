// F13-T4: the home's skills are the about page's skill groups, in the owner's order. A group with no name or no skill is
// left out, a blank skill is dropped, and with no groups there is no section
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import HomeContent from '~/components/pages/HomeContent.vue'
import { EMPTY_PAGE_BLOCKS } from '#shared/pages/blocks'
import type { PageBlocks } from '#shared/pages/blocks'
import type { PublicPage } from '#shared/pages/public'

function pageWith(skills: { group: string, items: string[] }[]): PublicPage<PageBlocks<'home'>> & { blocks: PageBlocks<'home'> } {
  return {
    key: 'home',
    fallback: false,
    empty: false,
    blocks: { ...EMPTY_PAGE_BLOCKS.home, hero: { ...EMPTY_PAGE_BLOCKS.home.hero, title: 'Título' } },
    published: ['pt-BR'],
    seo: { title: null, description: null, noindex: false },
    media: {},
    home: { projects: [], articles: [], experience: [], skills },
    cacheTags: [],
  } as never
}

describe('home skills', () => {
  it('lists the groups in order, each with its skills', async () => {
    const wrapper = await mountSuspended(HomeContent, {
      props: { page: pageWith([{ group: 'Core', items: ['TypeScript', 'Vue'] }, { group: 'Testing', items: ['Vitest'] }]) },
    })
    const groups = wrapper.findAll('[data-motion="skills-group"]')
    expect(groups.map(group => group.find('h3').text())).toEqual(['Core', 'Testing'])
    expect(groups[0]!.findAll('li').map(item => item.text())).toEqual(['TypeScript', 'Vue'])
  })

  it('leaves out a group with no name or no skill, and a blank skill', async () => {
    const wrapper = await mountSuspended(HomeContent, {
      props: { page: pageWith([{ group: ' ', items: ['Orphan'] }, { group: 'Empty', items: [] }, { group: 'Core', items: ['Vue', '  '] }]) },
    })
    const groups = wrapper.findAll('[data-motion="skills-group"]')
    expect(groups.map(group => group.find('h3').text())).toEqual(['Core'])
    expect(groups[0]!.findAll('li')).toHaveLength(1)
  })

  it('renders no section when there are no groups', async () => {
    const wrapper = await mountSuspended(HomeContent, { props: { page: pageWith([]) } })
    expect(wrapper.find('[data-motion="skills-group"]').exists()).toBe(false)
  })
})
