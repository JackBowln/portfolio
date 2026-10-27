// F01-T4: structural and content primitives
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import UiContainer from '~/components/ui/Container.vue'
import UiGrid from '~/components/ui/Grid.vue'
import UiHeading from '~/components/ui/Heading.vue'
import UiIcon from '~/components/ui/Icon.vue'
import UiProse from '~/components/ui/Prose.vue'
import UiTag from '~/components/ui/Tag.vue'
import UiVisuallyHidden from '~/components/ui/VisuallyHidden.vue'

describe('UiHeading', () => {
  it('uses the level for the element and the size only for the look', async () => {
    const wrapper = await mountSuspended(UiHeading, { props: { level: 2, size: 6 }, slots: { default: () => 'Projetos' } })
    expect(wrapper.element.tagName).toBe('H2')
    expect(wrapper.classes()).toContain('text-step-6')
    expect(wrapper.classes()).toContain('font-display')
  })

  it('defaults to a size per level and to sans below the display steps', async () => {
    const wrapper = await mountSuspended(UiHeading, { props: { level: 4 }, slots: { default: () => 'x' } })
    expect(wrapper.element.tagName).toBe('H4')
    expect(wrapper.classes()).toEqual(expect.arrayContaining(['text-step-1', 'font-sans']))
  })
})

describe('UiIcon', () => {
  it('is decorative by default and an image with a name when labelled', async () => {
    const decorative = await mountSuspended(UiIcon, { props: { name: 'check' } })
    expect(decorative.attributes()).toMatchObject({ 'aria-hidden': 'true', 'focusable': 'false' })
    expect(decorative.attributes('role')).toBeUndefined()

    const labelled = await mountSuspended(UiIcon, { props: { name: 'check', label: 'Concluído' } })
    expect(labelled.attributes()).toMatchObject({ 'role': 'img', 'aria-label': 'Concluído' })
    expect(labelled.attributes('aria-hidden')).toBeUndefined()
  })

  it('draws every path of the icon', async () => {
    const wrapper = await mountSuspended(UiIcon, { props: { name: 'info' } })
    expect(wrapper.findAll('path').map(path => path.attributes('d'))).toEqual([...ICONS.info])
  })
})

describe('layout and text', () => {
  it('UiContainer and UiGrid render the requested element with the token classes', async () => {
    const container = await mountSuspended(UiContainer, { props: { as: 'section', size: 'reading' }, slots: { default: () => 'x' } })
    expect(container.element.tagName).toBe('SECTION')
    expect(container.classes()).toEqual(expect.arrayContaining(['px-gutter', 'max-w-(--container-reading)']))

    const grid = await mountSuspended(UiGrid, { props: { as: 'ul' }, slots: { default: () => 'x' } })
    expect(grid.element.tagName).toBe('UL')
    expect(grid.classes()).toEqual(expect.arrayContaining(['grid-cols-4', 'md:grid-cols-8', 'lg:grid-cols-12']))
  })

  it('UiProse, UiTag and UiVisuallyHidden only wrap what they receive', async () => {
    const prose = await mountSuspended(UiProse, { slots: { default: () => 'Texto' } })
    expect(prose.classes()).toContain('ui-prose')
    expect(prose.text()).toBe('Texto')

    const tag = await mountSuspended(UiTag, { props: { tone: 'accent' }, slots: { default: () => 'Nuxt' } })
    expect(tag.element.tagName).toBe('SPAN')
    expect(tag.text()).toBe('Nuxt')

    const hidden = await mountSuspended(UiVisuallyHidden, { slots: { default: () => 'Só leitor de tela' } })
    expect(hidden.classes()).toContain('sr-only')
  })
})
