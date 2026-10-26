import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import IndexPage from '~/pages/index.vue'

describe('home page', () => {
  it('renders the placeholder heading inside main', async () => {
    const page = await mountSuspended(IndexPage)
    expect(page.get('main h1').text()).toBe('[PLACEHOLDER]')
  })
})
