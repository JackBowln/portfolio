// F05-T2: the HAST allowlist of code blocks on its own (ADR-0006 §4): only Shiki's shape gets through
import { describe, expect, it } from 'vitest'
import { MAX_HAST_NODES, hastIssues, hastText, styleIssue } from '../../shared/content/hast'
import { CODE, shikiPre } from '../support/documents'

type Json = any // eslint-disable-line @typescript-eslint/no-explicit-any -- payloads are built by hand to be wrong

const messages = (value: unknown) => hastIssues(value).map(issue => `${issue.path.join('.')}: ${issue.message}`)

describe('hastIssues', () => {
  it('accepts Shiki-shaped output and reads its text back', () => {
    expect(hastIssues(shikiPre(CODE))).toEqual([])
    expect(hastText(shikiPre(CODE))).toBe(CODE)
  })

  it('accepts tabindex as a number and code without properties beyond class', () => {
    const pre = shikiPre('x') as Json
    pre.properties.tabindex = 0
    pre.children[0].properties = { class: 'line' }
    expect(hastIssues(pre)).toEqual([])
  })

  it.each<[string, (pre: Json) => void, RegExp]>([
    ['a non-object node', (pre) => { pre.children[0].children.push('text') }, /node must be an object/],
    ['text directly in pre', (pre) => { pre.children.push({ type: 'text', value: 'x' }) }, /children\.1: text is not allowed here/],
    ['text without a string value', (pre) => { pre.children[0].children[1].value = 1 }, /value: value must be a string/],
    ['text with extra keys', (pre) => { pre.children[0].children[1].data = {} }, /unexpected key "data"/],
    ['an element with extra keys', (pre) => { pre.position = {} }, /unexpected key "position"/],
    ['properties that are not an object', (pre) => { pre.children[0].properties = [] }, /properties must be an object/],
    ['a tabindex other than 0', (pre) => { pre.properties.tabindex = '-1' }, /tabindex must be 0/],
    ['a class that is not a string', (pre) => { pre.properties.class = ['shiki'] }, /class must be a string/],
    ['style on code', (pre) => { pre.children[0].properties.style = '--shiki-light:#fff' }, /"style" is not allowed on <code>/],
    ['children that are not an array', (pre) => { pre.children[0].children = 'x' }, /children must be an array/],
    ['a missing tagName', (pre) => { delete pre.children[0].tagName }, /<undefined> is not allowed here/],
    ['a tagName from the prototype', (pre) => { pre.children[0].tagName = 'constructor' }, /<constructor> is not allowed here/],
    ['code inside a span', (pre) => { pre.children[0].children[0].children.push({ type: 'element', tagName: 'code', properties: {}, children: [] }) }, /<code> is not allowed here/],
  ])('refuses %s', (_name, change, pattern) => {
    const pre = shikiPre(CODE) as Json
    change(pre)
    expect(messages(pre).some(message => pattern.test(message)), messages(pre).join('\n')).toBe(true)
  })

  it('refuses spans nested deeper than the limit', () => {
    let span: Json = { type: 'text', value: 'x' }
    for (let level = 0; level < 10; level++) {
      span = { type: 'element', tagName: 'span', properties: {}, children: [span] }
    }
    expect(messages({ type: 'element', tagName: 'pre', properties: {}, children: [{ type: 'element', tagName: 'code', properties: {}, children: [span] }] })).toContainEqual(expect.stringMatching(/nested deeper than 8/))
  })

  it('stops at the node limit and reports it once', () => {
    const children = Array.from({ length: MAX_HAST_NODES + 10 }, () => ({ type: 'text', value: 'x' }))
    const issues = messages({ type: 'element', tagName: 'pre', properties: {}, children: [{ type: 'element', tagName: 'code', properties: {}, children }] })
    expect(issues.filter(issue => /more than 50000 nodes/.test(issue))).toHaveLength(1)
  })
})

describe('styleIssue', () => {
  it.each([
    '--shiki-light:#24292e;--shiki-dark:#e1e4e8',
    '--shiki-light-bg:#fff; --shiki-dark-bg:#24292eff;',
    '--shiki-light-font-style:italic;--shiki-dark-font-weight:bold;--shiki-light-text-decoration:underline line-through',
    '',
  ])('accepts %j', (style) => {
    expect(styleIssue(style)).toBeNull()
  })

  it.each([
    'color:red',
    '--shiki-light',
    '--shiki-light:red',
    '--shiki-light:#24292e !important',
    '--shiki-light-font-style:oblique',
    '--shiki-light-bg:url(x)',
    '--shiki-other:#fff',
    'background-image:url(https://evil.example)',
    '--shiki-light:#fff;behavior:url(x.htc)',
  ])('refuses %j', (style) => {
    expect(styleIssue(style)).toMatch(/is not/)
  })
})
