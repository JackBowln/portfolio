// Which provider a request uses (F09-T3, decision 2): Workers AI through the AI binding (preview and production);
// the fake only when the test build asks for it locally (TRANSLATION_PROVIDER=fake, passed by `pnpm preview:test`).
// A fake requested in preview or production is refused: no test path reaches a real environment
import type { AiModel } from '../../../shared/translation/models.ts'
import { createAppError } from '../../utils/errors.ts'
import { logger } from '../../utils/logger.ts'
import { createFakeProvider } from './providers/fake.ts'
import type { TranslationProvider } from './providers/types.ts'
import { createWorkersAiProvider } from './providers/workers-ai.ts'

export function providerFor(env: Env): (model: AiModel) => TranslationProvider {
  return (model) => {
    if (env.TRANSLATION_PROVIDER === 'fake') {
      if (env.ENVIRONMENT !== 'local') {
        logger.error('translation.fake_provider_refused', { environment: env.ENVIRONMENT })
        throw createAppError('internal')
      }
      return createFakeProvider()
    }
    if (!env.AI) {
      throw createAppError('conflict', 'Cannot translate', [{ path: 'provider', message: 'unavailable' }])
    }
    return createWorkersAiProvider(env.AI as never, model)
  }
}
