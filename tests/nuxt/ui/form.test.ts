// F01-T4: form fields tie label, description and error to the control; errors are announced
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import type { Component } from 'vue'
import UiField from '~/components/ui/Field.vue'
import UiInput from '~/components/ui/Input.vue'
import UiStatusMessage from '~/components/ui/StatusMessage.vue'
import UiTextarea from '~/components/ui/Textarea.vue'

function fieldWith(control: Component, props: { description?: string, required?: boolean } = {}) {
  const error = ref<string>()
  const value = ref('')
  const component = defineComponent({
    setup: () => () => h(UiField, { label: 'E-mail', ...props, error: error.value }, {
      default: (field: Record<string, unknown>) => h(control, {
        ...field,
        'name': 'email',
        'modelValue': value.value,
        'onUpdate:modelValue': (next: string) => (value.value = next),
      }),
    }),
  })
  return { component, error, value }
}

describe('UiField with UiInput', () => {
  it('ties the label, the description and, once there is one, the error to the control', async () => {
    const { component, error } = fieldWith(UiInput, { description: 'Respondo em até 2 dias.' })
    const wrapper = await mountSuspended(component)
    const input = wrapper.get('input')
    const id = input.attributes('id')!

    expect(wrapper.get('label').attributes('for')).toBe(id)
    expect(input.attributes('name')).toBe('email')
    const description = wrapper.get(`#${id}-description`)
    expect(input.attributes('aria-describedby')).toBe(description.attributes('id'))
    expect(input.attributes('aria-invalid')).toBeUndefined()

    error.value = 'Informe um e-mail válido.'
    await wrapper.vm.$nextTick()
    expect(input.attributes('aria-invalid')).toBe('true')
    expect(input.attributes('aria-describedby')).toBe(`${id}-description ${id}-error`)
    expect(wrapper.get(`#${id}-error`).text()).toBe('Informe um e-mail válido.')
  })

  it('the error region is a live region that exists before any error', async () => {
    const { component } = fieldWith(UiInput)
    const wrapper = await mountSuspended(component)
    const id = wrapper.get('input').attributes('id')!
    const region = wrapper.get(`#${id}-error`)
    expect(region.attributes('aria-live')).toBe('polite')
    expect(region.text()).toBe('')
    expect(wrapper.get('input').attributes('aria-describedby')).toBeUndefined()
  })

  it('marks required fields natively and hides the asterisk from assistive tech', async () => {
    const { component } = fieldWith(UiInput, { required: true })
    const wrapper = await mountSuspended(component)
    expect(wrapper.get('input').attributes('required')).toBeDefined()
    expect(wrapper.get('label [aria-hidden="true"]').text()).toBe('*')
  })

  it('updates the model as the user types', async () => {
    const { component, value } = fieldWith(UiInput)
    const wrapper = await mountSuspended(component)
    await wrapper.get('input').setValue('ana@example.com')
    expect(value.value).toBe('ana@example.com')
  })
})

describe('UiField with UiTextarea', () => {
  it('wires the textarea the same way', async () => {
    const { component, error } = fieldWith(UiTextarea, { description: 'Até 2.000 caracteres.' })
    error.value = 'Escreva uma mensagem.'
    const wrapper = await mountSuspended(component)
    const textarea = wrapper.get('textarea')
    const id = textarea.attributes('id')!
    expect(wrapper.get('label').attributes('for')).toBe(id)
    expect(textarea.attributes('aria-invalid')).toBe('true')
    expect(textarea.attributes('aria-describedby')).toBe(`${id}-description ${id}-error`)
  })
})

describe('UiStatusMessage', () => {
  it('is a polite status, and an alert only for errors', async () => {
    for (const tone of ['info', 'success', 'warning'] as const) {
      const wrapper = await mountSuspended(UiStatusMessage, { props: { tone }, slots: { default: () => 'Mensagem' } })
      expect(wrapper.attributes('role'), tone).toBe('status')
      expect(wrapper.get('svg').attributes('aria-hidden')).toBe('true')
    }
    const danger = await mountSuspended(UiStatusMessage, { props: { tone: 'danger' }, slots: { default: () => 'Falhou' } })
    expect(danger.attributes('role')).toBe('alert')
    expect(danger.text()).toBe('Falhou')
  })
})
