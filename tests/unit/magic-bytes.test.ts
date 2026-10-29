// F04-T1: the type of an upload comes from its bytes, and markup in its head marks a polyglot (ADR-0007 §3)
import { describe, expect, it } from 'vitest'
import { containsMarkup, sniffMediaType } from '../../server/utils/magic-bytes'
import { fileOf, POLYGLOT_JPEG, SIGNATURES, SVG } from '../support/media'
import type { FixtureType } from '../support/media'

const bytes = (value: string | number[]) => new Uint8Array(typeof value === 'string' ? Buffer.from(value, 'latin1') : value)

describe('sniffMediaType', () => {
  it('recognizes every accepted type by its signature', () => {
    for (const type of Object.keys(SIGNATURES) as FixtureType[]) {
      expect(sniffMediaType(new Uint8Array(fileOf(type, 256))), type).toBe(type)
    }
  })

  it('tells AVIF from MP4 by the ftyp brands, compatible brands included', () => {
    const ftyp = (major: string, compatible: string[]) => {
      const body = `ftyp${major}\0\0\0\0${compatible.join('')}`
      return bytes([0, 0, 0, 4 + body.length, ...Buffer.from(body, 'latin1')])
    }
    expect(sniffMediaType(ftyp('mif1', ['mif1', 'avif']))).toBe('image/avif')
    expect(sniffMediaType(ftyp('avis', ['avis']))).toBe('image/avif')
    expect(sniffMediaType(ftyp('mp42', ['mp42', 'isom']))).toBe('video/mp4')
    expect(sniffMediaType(ftyp('heic', ['mif1', 'heic']))).toBeNull()
    expect(sniffMediaType(ftyp('qt  ', ['qt  ']))).toBeNull()
  })

  it('accepts WebVTT with a BOM and only with a proper header line', () => {
    expect(sniffMediaType(bytes([0xEF, 0xBB, 0xBF, ...Buffer.from('WEBVTT\n')]))).toBe('text/vtt')
    expect(sniffMediaType(bytes('WEBVTT'))).toBe('text/vtt')
    expect(sniffMediaType(bytes('WEBVTTX\n'))).toBeNull()
  })

  it('refuses SVG, HTML, plain Matroska and unknown bytes', () => {
    expect(sniffMediaType(new Uint8Array(SVG))).toBeNull()
    expect(sniffMediaType(bytes('<!doctype html><p>x'))).toBeNull()
    expect(sniffMediaType(bytes([0x1A, 0x45, 0xDF, 0xA3, ...Buffer.from('matroska')]))).toBeNull()
    expect(sniffMediaType(bytes('GIF89a'))).toBeNull()
    expect(sniffMediaType(new Uint8Array())).toBeNull()
  })
})

describe('containsMarkup', () => {
  it('finds HTML, SVG, XML and PHP in any letter case', () => {
    expect(containsMarkup(new Uint8Array(POLYGLOT_JPEG))).toBe(true)
    expect(containsMarkup(new Uint8Array(SVG))).toBe(true)
    for (const sample of ['<SCRIPT>', '<Html>', '<?xml', '<!DOCTYPE html>', '<iframe src=x>', '<?php echo 1;']) {
      expect(containsMarkup(bytes(`ÿØ${sample}`)), sample).toBe(true)
    }
  })

  it('ignores binary data and WebVTT cue tags', () => {
    expect(containsMarkup(new Uint8Array(fileOf('image/jpeg', 4096)))).toBe(false)
    expect(containsMarkup(bytes('WEBVTT\n\n00:00.000 --> 00:01.000\n<v Ana><i>Olá</i> <c.yellow>mundo</c>\n'))).toBe(false)
    expect(containsMarkup(bytes('<scrip <htm <sv'))).toBe(false)
  })
})
