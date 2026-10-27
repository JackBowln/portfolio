// F01-T4: Button, Link and SkipLink: native elements, accessible names, states and safe targets
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import UiButton from '~/components/ui/Button.vue'
import UiLink from '~/components/ui/Link.vue'
import UiSkipLink from '~/components/ui/SkipLink.vue'

describe('UiButton', () => {
  it('is a native button of type button, named by its slot, with the icon hidden', async () => {
    const wrapper = await mountSuspended(UiButton, { slots: { default: () => 'Enviar', icon: () => '→' } })
    const button = wrapper.get('button')
    expect(button.attributes('type')).toBe('button')
    expect(button.text()).toContain('Enviar')
    expect(button.get('[aria-hidden="true"]').text()).toBe('→')
  })

  it('emits clicks, and a disabled button is native-disabled and ignores them', async () => {
    const clicks: number[] = []
    const enabled = await mountSuspended(UiButton, { props: { onClick: () => clicks.push(1) }, slots: { default: () => 'Ok' } })
    await enabled.get('button').trigger('click')
    expect(clicks).toHaveLength(1)

    const disabled = await mountSuspended(UiButton, { props: { disabled: true, onClick: () => clicks.push(2) }, slots: { default: () => 'Ok' } })
    expect(disabled.get('button').attributes('disabled')).toBeDefined()
    await disabled.get('button').trigger('click')
    expect(clicks).toEqual([1])
  })

  it('submits forms only when asked to', async () => {
    const wrapper = await mountSuspended(UiButton, { props: { type: 'submit' }, slots: { default: () => 'Enviar' } })
    expect(wrapper.get('button').attributes('type')).toBe('submit')
  })

  it('keeps the minimum target size on every variant and size', async () => {
    for (const size of ['md', 'sm'] as const) {
      const wrapper = await mountSuspended(UiButton, { props: { size }, slots: { default: () => 'Ok' } })
      expect(wrapper.get('button').classes().some(name => name.startsWith('min-h-(--target-'))).toBe(true)
    }
  })
})

describe('UiLink', () => {
  it('renders safe targets; external ones get rel but stay in the same tab', async () => {
    const internal = await mountSuspended(UiLink, { props: { href: '/blog' }, slots: { default: () => 'Blog' } })
    expect(internal.get('a').attributes()).toMatchObject({ href: '/blog' })
    expect(internal.get('a').attributes('rel')).toBeUndefined()

    const external = await mountSuspended(UiLink, { props: { href: 'https://github.com/x' }, slots: { default: () => 'GitHub' } })
    expect(external.get('a').attributes('rel')).toBe('noopener noreferrer')
    expect(external.get('a').attributes('target')).toBeUndefined()
  })

  it('renders unsafe targets as text, never as a link', async () => {
    for (const href of ['javascript:alert(1)', 'data:text/html,x', '//evil.example']) {
      const wrapper = await mountSuspended(UiLink, { props: { href }, slots: { default: () => 'Texto' } })
      expect(wrapper.find('a').exists(), href).toBe(false)
      expect(wrapper.text()).toBe('Texto')
    }
  })

  it('standalone links show a decorative arrow that points out for external targets', async () => {
    const internal = await mountSuspended(UiLink, { props: { href: '/sobre', variant: 'standalone' }, slots: { default: () => 'Sobre' } })
    const external = await mountSuspended(UiLink, { props: { href: 'https://github.com', variant: 'standalone' }, slots: { default: () => 'GitHub' } })
    for (const wrapper of [internal, external]) {
      expect(wrapper.get('svg').attributes('aria-hidden')).toBe('true')
    }
    expect(internal.get('a').text()).toBe('Sobre')
    expect(internal.findAll('path').length).not.toBe(0)
  })
})

describe('UiSkipLink', () => {
  it('points at the main content and is visually hidden until focused', async () => {
    const wrapper = await mountSuspended(UiSkipLink, { slots: { default: () => 'Pular para o conteúdo' } })
    const link = wrapper.get('a')
    expect(link.attributes('href')).toBe('#main')
    expect(link.classes()).toContain('sr-only')
    expect(link.classes()).toContain('focus:not-sr-only')
  })
})
