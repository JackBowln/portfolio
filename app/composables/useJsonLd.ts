// JSON-LD in <head> (F11-T1): the response already carries it serialized and escaped (server/services/seo), so the
// page ships no helper; nothing when the response has none. A data block, not a script: the CSP ignores it.
// Kept on the client too, so a client-side navigation replaces the previous page's block
export function useJsonLd(source: () => string | undefined) {
  useHead(() => {
    const json = source()
    return { script: json ? [{ key: 'json-ld', type: 'application/ld+json', innerHTML: json }] : [] }
  })
}
