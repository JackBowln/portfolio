<script setup lang="ts">
// Form field frame: label, optional description and the error region, all tied to the control by id.
// The control comes through the scoped slot and takes its wiring with v-bind:
//   <UiField v-slot="field" :label="t('…')" :error="errors.email"><UiInput v-model="email" v-bind="field" /></UiField>
// Required fields carry the native `required`; the visual asterisk is hidden from assistive tech
const props = defineProps<{
  label: string
  description?: string | undefined
  error?: string | undefined
  required?: boolean
}>()

const id = useId()
const descriptionId = `${id}-description`
const errorId = `${id}-error`

const field = computed(() => ({
  id,
  describedby: [props.description ? descriptionId : '', props.error ? errorId : ''].filter(Boolean).join(' ') || undefined,
  invalid: !!props.error,
  required: !!props.required,
}))
</script>

<template>
  <div class="grid gap-2">
    <label
      :for="id"
      class="font-strong"
    >
      {{ label }}<span
        v-if="required"
        aria-hidden="true"
        class="text-danger"
      > *</span>
    </label>
    <p
      v-if="description"
      :id="descriptionId"
      class="text-step--1 text-text-muted"
    >
      {{ description }}
    </p>
    <slot v-bind="field" />
    <UiFieldError
      :id="errorId"
      :message="error"
    />
  </div>
</template>
