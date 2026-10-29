// Public media URLs from runtimeConfig.public.mediaBaseUrl (ADR-0007 §5); a key that is not a delivered object
// gives undefined, so it never reaches an src
import { mediaUrl } from '#shared/media/public'

export function useMediaUrl() {
  const { mediaBaseUrl } = useRuntimeConfig().public
  return (key: string) => mediaUrl(mediaBaseUrl, key)
}
