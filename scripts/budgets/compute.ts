// Pure budget math over the Vite client manifest (no file system access), unit-tested in tests/unit/

export interface ManifestChunk {
  file: string
  isEntry?: boolean
  isDynamicEntry?: boolean
  imports?: string[]
  dynamicImports?: string[]
  css?: string[]
}

export type Manifest = Record<string, ManifestChunk>

export interface RouteBudget {
  path: string
  /** Manifest key of the route's page component, matched exactly or as a path suffix */
  page: string
  /** Limits in kB (1000 bytes) gzip */
  js: number
  css: number
}

export interface RouteReport {
  id: string
  path: string
  jsKb: number
  cssKb: number
  jsLimit: number
  cssLimit: number
  files: string[]
  forbidden: string[]
  ok: boolean
}

export function findChunkKey(manifest: Manifest, page: string): string | undefined {
  return Object.keys(manifest).find(key => key === page || key.endsWith(`/${page}`))
}

/** Manifest keys reachable from `roots` through static imports only */
export function staticClosure(manifest: Manifest, roots: string[]): Set<string> {
  const seen = new Set<string>()
  const pending = [...roots]
  while (pending.length > 0) {
    const key = pending.pop()
    if (key === undefined || seen.has(key) || !manifest[key]) {
      continue
    }
    seen.add(key)
    pending.push(...(manifest[key].imports ?? []))
  }
  return seen
}

export function evaluateRoute(
  id: string,
  budget: RouteBudget,
  manifest: Manifest,
  gzipBytes: (file: string) => number,
  forbiddenPatterns: string[],
): RouteReport {
  const entry = Object.keys(manifest).find(key => manifest[key]?.isEntry)
  const page = findChunkKey(manifest, budget.page)
  if (!entry || !page) {
    throw new Error(`Route ${id}: ${entry ? `page chunk "${budget.page}" not found` : 'no entry chunk'} in the manifest`)
  }

  const keys = staticClosure(manifest, [entry, page])
  const chunks = [...keys].map(key => manifest[key]).filter(chunk => chunk !== undefined)
  const jsFiles = [...new Set(chunks.map(chunk => chunk.file).filter(file => file.endsWith('.js')))]
  const cssFiles = [...new Set(chunks.flatMap(chunk => chunk.css ?? []))]
  const toKb = (files: string[]) => files.reduce((sum, file) => sum + gzipBytes(file), 0) / 1000

  const jsKb = toKb(jsFiles)
  const cssKb = toKb(cssFiles)
  const forbidden = [...keys].filter(key => forbiddenPatterns.some(pattern => key.includes(pattern)))

  return {
    id,
    path: budget.path,
    jsKb,
    cssKb,
    jsLimit: budget.js,
    cssLimit: budget.css,
    files: [...jsFiles, ...cssFiles],
    forbidden,
    ok: jsKb <= budget.js && cssKb <= budget.css && forbidden.length === 0,
  }
}
