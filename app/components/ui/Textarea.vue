<script setup lang="ts">
// Multi-line input wired by UiField, like UiInput
defineOptions({ inheritAttrs: false })

withDefaults(defineProps<{
  id: string
  rows?: number
  describedby?: string | undefined
  invalid?: boolean
  required?: boolean
  disabled?: boolean
}>(), { rows: 5, describedby: undefined, invalid: false, required: false, disabled: false })

const model = defineModel<string>({ default: '' })
</script>

<template>
  <textarea
    v-bind="$attrs"
    :id="id"
    v-model="model"
    :rows="rows"
    :required="required"
    :disabled="disabled"
    :aria-describedby="describedby"
    :aria-invalid="invalid ? 'true' : undefined"
    class="w-full rounded-control border border-border bg-bg px-3 py-2 text-text hover:border-text aria-invalid:border-danger disabled:cursor-not-allowed disabled:opacity-(--opacity-disabled)"
  />
</template>
