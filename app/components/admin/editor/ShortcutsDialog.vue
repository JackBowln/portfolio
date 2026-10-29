<script setup lang="ts">
// Admin-only. Every key binding of the editor, from the same list the toolbar uses
import EditorDialog from './EditorDialog.vue'
import { OTHER_SHORTCUTS, TOOLBAR, displayKeys } from './toolbar-actions'

const frame = useTemplateRef<InstanceType<typeof EditorDialog>>('frame')

const rows = computed(() => [
  ...TOOLBAR.flatMap(group => group.actions).filter(action => action.keys).map(action => ({ label: `actions.${action.label}`, keys: action.keys! })),
  ...OTHER_SHORTCUTS.map(item => ({ label: `shortcuts.${item.label}`, keys: item.keys })),
])

defineExpose({ open: () => frame.value?.open() })
</script>

<template>
  <EditorDialog
    ref="frame"
    :title="$t('admin.editor.shortcuts.title')"
  >
    <table class="w-full text-left">
      <caption class="sr-only">
        {{ $t('admin.editor.shortcuts.title') }}
      </caption>
      <thead>
        <tr>
          <th scope="col">
            {{ $t('admin.editor.shortcuts.action') }}
          </th>
          <th scope="col">
            {{ $t('admin.editor.shortcuts.keys') }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="row in rows"
          :key="row.label"
          class="border-t border-border"
        >
          <td class="py-1 pr-4">
            {{ $t(`admin.editor.${row.label}`) }}
          </td>
          <td class="py-1">
            <kbd class="font-mono">{{ displayKeys(row.keys) }}</kbd>
          </td>
        </tr>
      </tbody>
    </table>
    <UiButton
      variant="secondary"
      size="sm"
      class="justify-self-start"
      @click="frame?.close()"
    >
      {{ $t('admin.editor.close') }}
    </UiButton>
  </EditorDialog>
</template>
