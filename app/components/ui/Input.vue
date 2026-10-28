<script setup lang="ts">
// Text input wired by UiField (id, describedby, invalid, required). Other attributes (name, autocomplete,
// inputmode, placeholder) pass through to the <input>
defineOptions({ inheritAttrs: false })

withDefaults(defineProps<{
  id: string
  type?: 'text' | 'email' | 'url' | 'search' | 'tel' | 'password'
  describedby?: string | undefined
  invalid?: boolean
  required?: boolean
  disabled?: boolean
}>(), { type: 'text', describedby: undefined, invalid: false, required: false, disabled: false })

const model = defineModel<string>({ default: '' })
</script>

<template>
  <input
    v-bind="$attrs"
    :id="id"
    v-model="model"
    :type="type"
    :required="required"
    :disabled="disabled"
    :aria-describedby="describedby"
    :aria-invalid="invalid ? 'true' : undefined"
    class="min-h-(--target-comfortable) w-full rounded-control border border-border bg-bg px-3 text-text hover:border-text aria-invalid:border-danger disabled:cursor-not-allowed disabled:opacity-(--opacity-disabled)"
  >
</template>
