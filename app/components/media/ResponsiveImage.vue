<script setup lang="ts">
// Every public image (ADR-0007 §6): AVIF and WebP sources, a JPEG <img> with srcset, the caller's `sizes`, explicit
// width/height (no layout shift) and the locale's alt. Lazy by default; `priority` is only for the LCP image.
// The ThumbHash placeholder and dominant color sit behind the image until it paints; the focal point sets the crop
import type { PublicImage } from '#shared/media/public'
import type { ImageFormat } from '#shared/media/schemas'

const props = withDefaults(defineProps<{
  image: PublicImage
  /** How wide the image renders, e.g. "(min-width: 64rem) 50vw, 100vw" */
  sizes: string
  priority?: boolean
  /** `cover` fills its box (which sets the size) and crops around the focal point */
  fit?: 'cover' | undefined
}>(), { priority: false, fit: undefined })

if (import.meta.dev && !props.image.decorative && !props.image.alt) {
  console.warn('[ResponsiveImage] informative image without alt; mark it decorative or add the text in the media library')
}

const mediaUrl = useMediaUrl()

function srcset(format: ImageFormat): string {
  return props.image.variants
    .filter(variant => variant.format === format)
    .toSorted((a, b) => a.width - b.width)
    .flatMap((variant) => {
      const url = mediaUrl(variant.key)
      return url ? [`${url} ${variant.width}w`] : []
    })
    .join(', ')
}

// For browsers without srcset: the largest JPEG up to 1280 px, or the smallest one
const fallback = computed(() => {
  const jpegs = props.image.variants.filter(variant => variant.format === 'jpeg').toSorted((a, b) => a.width - b.width)
  const chosen = jpegs.filter(variant => variant.width <= 1280).at(-1) ?? jpegs[0]
  return chosen ? mediaUrl(chosen.key) : undefined
})

const style = computed(() => ({
  objectPosition: `${props.image.focalX * 100}% ${props.image.focalY * 100}%`,
  ...(props.image.dominantColor ? { backgroundColor: props.image.dominantColor } : {}),
  ...(props.image.placeholderDataUrl ? { backgroundImage: `url("${props.image.placeholderDataUrl}")`, backgroundSize: 'cover' } : {}),
}))
</script>

<template>
  <picture>
    <source
      type="image/avif"
      :srcset="srcset('avif')"
      :sizes="sizes"
    >
    <source
      type="image/webp"
      :srcset="srcset('webp')"
      :sizes="sizes"
    >
    <img
      :src="fallback"
      :srcset="srcset('jpeg')"
      :sizes="sizes"
      :width="image.width"
      :height="image.height"
      :alt="image.decorative ? '' : image.alt"
      :loading="priority ? 'eager' : 'lazy'"
      :fetchpriority="priority ? 'high' : undefined"
      decoding="async"
      :class="fit === 'cover' ? 'block size-full object-cover' : 'block h-auto max-w-full'"
      :style="style"
    >
  </picture>
</template>
