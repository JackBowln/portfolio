// Public page data without useAsyncData (F06-T5, decision 1): useAsyncData added ~5 kB to every public route's
// initial JS (perf-log, F06-T3). Fetched during SSR and sent in the payload under `key`; fetched in the browser after
// a client-side navigation. A 404 from the API becomes the page's 404; other failures are server errors. The data's
// `cacheTags` are added to the page's own response (with the layout's), so a purge reaches the HTML as well. Every
// composable is called before the first await: after it, the Nuxt instance is no longer current here (NUXT_E1001)
export async function usePublicData<T extends { cacheTags?: string[] }>(key: string, path: string, query: Record<string, string | number | undefined>) {
  const data = useState<T | null>(key, () => null)
  const requestFetch = useRequestFetch()
  const cacheTag = import.meta.server ? useResponseHeader('cache-tag') : null
  if (data.value === null) {
    try {
      data.value = await requestFetch(path, { query }) as T
    }
    catch (error) {
      const status = (error as { statusCode?: number, status?: number }).statusCode ?? (error as { status?: number }).status
      throw createError({ statusCode: status === 404 ? 404 : 500, statusMessage: status === 404 ? 'Not Found' : 'Server Error', fatal: true })
    }
  }
  if (cacheTag && data.value?.cacheTags?.length) {
    cacheTag.value = mergeCacheTags(cacheTag.value, data.value.cacheTags)
  }
  return data as Ref<T>
}
