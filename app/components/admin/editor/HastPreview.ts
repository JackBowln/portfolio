// Admin-only. Renders a code block's HAST as Vue elements for the editor preview; no v-html. Only what the schema
// allows can be here (the node view checks it with hastIssues before showing it); the public renderer is F05-T4
import { defineComponent, h } from 'vue'
import type { VNode } from 'vue'
import type { HastElement, HastText } from '#shared/content/hast'

function render(node: HastElement | HastText): VNode | string {
  if (node.type === 'text') {
    return node.value
  }
  const { class: className, style, tabindex } = node.properties
  return h(node.tagName, { class: className, style, tabindex }, node.children.map(render))
}

export default defineComponent({
  name: 'HastPreview',
  props: { hast: { type: Object as () => HastElement, required: true } },
  setup: props => () => render(props.hast),
})
