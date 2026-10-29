// F04-T4: the focal point picker (native sliders with readable values) and the alt rule of the metadata form
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import type { PublicImage } from '#shared/media/public'
import FocalPointPicker from '~/components/admin/media/FocalPointPicker.vue'
import MediaMetadataForm from '~/components/admin/media/MediaMetadataForm.vue'
import type { MediaDetail } from '~/utils/admin/media'

const SHA = 'cd'.repeat(32)
const image: PublicImage = {
  width: 800,
  height: 600,
  variants: [{ format: 'webp', width: 320, height: 240, key: `media/cd/${SHA}/webp-320.webp` }],
  placeholderDataUrl: null,
  dominantColor: null,
  focalX: 0.5,
  focalY: 0.5,
  alt: '',
  decorative: false,
  caption: null,
  credit: null,
}

describe('FocalPointPicker', () => {
  it('offers two labelled 0–100 sliders that update the point', async () => {
    const updates: { x: number, y: number }[] = []
    const wrapper = await mountSuspended(FocalPointPicker, { props: { 'image': image, 'modelValue': { x: 0.25, y: 0.8 }, 'onUpdate:modelValue': (value: { x: number, y: number }) => updates.push(value) } })
    const sliders = wrapper.findAll('input[type="range"]')
    expect(sliders.map(slider => [slider.attributes('min'), slider.attributes('max'), (slider.element as HTMLInputElement).value])).toEqual([['0', '100', '25'], ['0', '100', '80']])
    expect(sliders[0]!.attributes('aria-valuetext')).toBe('25%')
    expect(wrapper.findAll('label').map(label => label.text())).toEqual(['Foco horizontal: 25%', 'Foco vertical: 80%'])

    await sliders[1]!.setValue('40')
    expect(updates.at(-1)).toEqual({ x: 0.25, y: 0.4 })
    // The click-to-set preview is a pointer shortcut, hidden from assistive tech
    expect(wrapper.get('[data-testid="focal-preview"]').attributes('aria-hidden')).toBe('true')
  })
})

describe('MediaMetadataForm', () => {
  const media = { id: 'm1', kind: 'image', decorative: false, localizations: [] } as unknown as MediaDetail

  it('requires the pt-BR alt for an informative image and ties the error to the field', async () => {
    const wrapper = await mountSuspended(MediaMetadataForm, { props: { media } })
    await wrapper.get('form').trigger('submit')
    const alt = wrapper.get('[data-locale="pt-BR"] textarea')
    expect(alt.attributes('aria-invalid')).toBe('true')
    expect(wrapper.get('[data-locale="pt-BR"]').text()).toContain('Escreva o texto alternativo em português ou marque a imagem como decorativa.')
    expect(wrapper.emitted('saved')).toBeUndefined()
  })

  it('hides the alt fields once the image is marked decorative', async () => {
    const wrapper = await mountSuspended(MediaMetadataForm, { props: { media } })
    await wrapper.get('input[type="checkbox"]').setValue(true)
    expect(wrapper.findAll('textarea')).toHaveLength(0)
    expect(wrapper.findAll('[data-locale]')).toHaveLength(5)
  })
})
