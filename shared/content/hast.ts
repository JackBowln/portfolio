// HAST of a code block (ADR-0006 §4): Shiki runs in the admin browser and the node stores its `pre` element. The
// server accepts only pre > code > span and text, with classes from a closed list and styles that set Shiki's own
// CSS variables, so the renderer can turn it into Vue elements without v-html and nothing else can ride along.
// Shiki is configured with two themes and `defaultColor: false` (F05-T3), which emits only those variables

export interface HastText {
  type: 'text'
  value: string
}

export interface HastElement {
  type: 'element'
  tagName: 'pre' | 'code' | 'span'
  properties: Record<string, string | number>
  children: (HastElement | HastText)[]
}

export interface HastIssue {
  path: (string | number)[]
  message: string
}

/** Themes the admin highlighter uses; F05-T3 confirms them against Shiki's real output */
export const SHIKI_THEMES = ['github-light-default', 'github-dark-default'] as const
const CLASS_TOKENS = new Set<string>(['shiki', 'shiki-themes', 'line', ...SHIKI_THEMES])

const MAX_DEPTH = 8
export const MAX_HAST_NODES = 50_000

const CHILDREN: Record<HastElement['tagName'], ReadonlySet<string>> = {
  pre: new Set(['code']),
  code: new Set(['span', 'text']),
  span: new Set(['span', 'text']),
}
const PROPERTIES: Record<HastElement['tagName'], ReadonlySet<string>> = {
  pre: new Set(['class', 'style', 'tabindex']),
  code: new Set(['class']),
  span: new Set(['class', 'style']),
}

const COLOR = /^#[0-9a-f]{3,8}$/i
const KEYWORDS: Record<string, ReadonlySet<string>> = {
  'font-style': new Set(['normal', 'italic']),
  'font-weight': new Set(['normal', 'bold']),
  'text-decoration': new Set(['none', 'underline', 'line-through', 'underline line-through']),
}
const COLOR_VARIABLE = /^--shiki-(?:light|dark)(?:-bg)?$/
const KEYWORD_VARIABLE = /^--shiki-(?:light|dark)-(font-style|font-weight|text-decoration)$/

/** null when the declaration list sets only Shiki variables to plain colors or fixed keywords */
export function styleIssue(style: string): string | null {
  for (const declaration of style.split(';')) {
    if (declaration.trim() === '') {
      continue
    }
    const colon = declaration.indexOf(':')
    if (colon === -1) {
      return `"${declaration.trim()}" is not a declaration`
    }
    const name = declaration.slice(0, colon).trim()
    const value = declaration.slice(colon + 1).trim()
    const keyword = KEYWORD_VARIABLE.exec(name)
    const valid = keyword ? KEYWORDS[keyword[1]!]!.has(value) : COLOR_VARIABLE.test(name) && COLOR.test(value)
    if (!valid) {
      return `"${name}: ${value}" is not an allowed Shiki style`
    }
  }
  return null
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

function onlyKeys(node: Record<string, unknown>, keys: readonly string[], path: (string | number)[], issues: HastIssue[]): void {
  for (const key of Object.keys(node)) {
    if (!keys.includes(key)) {
      issues.push({ path: [...path, key], message: `unexpected key "${key}"` })
    }
  }
}

function checkProperties(tagName: HastElement['tagName'], properties: unknown, path: (string | number)[], issues: HastIssue[]): void {
  if (!isRecord(properties)) {
    issues.push({ path, message: 'properties must be an object' })
    return
  }
  for (const [name, value] of Object.entries(properties)) {
    const at = [...path, name]
    if (!PROPERTIES[tagName].has(name)) {
      issues.push({ path: at, message: `"${name}" is not allowed on <${tagName}>` })
    }
    else if (name === 'tabindex') {
      if (value !== 0 && value !== '0') {
        issues.push({ path: at, message: 'tabindex must be 0' })
      }
    }
    else if (typeof value !== 'string') {
      issues.push({ path: at, message: `${name} must be a string` })
    }
    else if (name === 'class') {
      const unknown = value.split(/\s+/).filter(token => token !== '' && !CLASS_TOKENS.has(token))
      if (unknown.length > 0) {
        issues.push({ path: at, message: `class "${unknown[0]}" is not allowed` })
      }
    }
    else {
      const issue = styleIssue(value)
      if (issue) {
        issues.push({ path: at, message: issue })
      }
    }
  }
}

/** Every reason the value is not an allowed code-block HAST; empty when it is */
export function hastIssues(value: unknown): HastIssue[] {
  const issues: HastIssue[] = []
  let nodes = 0

  const visit = (node: unknown, path: (string | number)[], depth: number, allowed: ReadonlySet<string>): void => {
    if (++nodes > MAX_HAST_NODES) {
      if (nodes === MAX_HAST_NODES + 1) {
        issues.push({ path, message: `more than ${MAX_HAST_NODES} nodes` })
      }
      return
    }
    if (!isRecord(node)) {
      issues.push({ path, message: 'node must be an object' })
      return
    }
    if (node.type === 'text') {
      onlyKeys(node, ['type', 'value'], path, issues)
      if (!allowed.has('text')) {
        issues.push({ path, message: 'text is not allowed here' })
      }
      if (typeof node.value !== 'string') {
        issues.push({ path: [...path, 'value'], message: 'value must be a string' })
      }
      return
    }
    if (node.type !== 'element') {
      issues.push({ path: [...path, 'type'], message: `node type "${String(node.type)}" is not allowed` })
      return
    }
    onlyKeys(node, ['type', 'tagName', 'properties', 'children'], path, issues)
    const tagName = node.tagName
    if (typeof tagName !== 'string' || !Object.hasOwn(CHILDREN, tagName) || !allowed.has(tagName)) {
      issues.push({ path: [...path, 'tagName'], message: `<${String(tagName)}> is not allowed here` })
      return
    }
    const tag = tagName as HastElement['tagName']
    if (depth > MAX_DEPTH) {
      issues.push({ path, message: `nested deeper than ${MAX_DEPTH}` })
      return
    }
    checkProperties(tag, node.properties, [...path, 'properties'], issues)
    if (!Array.isArray(node.children)) {
      issues.push({ path: [...path, 'children'], message: 'children must be an array' })
      return
    }
    node.children.forEach((child, index) => visit(child, [...path, 'children', index], depth + 1, CHILDREN[tag]))
  }

  visit(value, [], 1, new Set(['pre']))
  return issues
}

/** The text a HAST shows, in order */
export function hastText(node: HastElement | HastText): string {
  return node.type === 'text' ? node.value : node.children.map(hastText).join('')
}

/** Unhighlighted code in the allowed shape: what a code block holds until Shiki has run */
export function plainHast(code: string): HastElement {
  return {
    type: 'element',
    tagName: 'pre',
    properties: {},
    children: [{ type: 'element', tagName: 'code', properties: {}, children: code === '' ? [] : [{ type: 'text', value: code }] }],
  }
}
