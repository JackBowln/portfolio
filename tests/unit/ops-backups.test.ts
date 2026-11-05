// F12-T4: backup keys and their retention, the media manifest from the D1 rows, and the restore comparison
import { describe, expect, it } from 'vitest'
import { backupKeys, compareSnapshots, mediaManifest } from '../../scripts/ops/backups'

describe('backupKeys', () => {
  it('names this run and the one that leaves the 12-week window', () => {
    expect(backupKeys('production', new Date('2026-11-08T04:17:00Z'))).toEqual({
      database: 'd1/production/2026-11-08.sql',
      manifest: 'media/production/manifest-2026-11-08.json',
      expiredDatabase: 'd1/production/2026-08-16.sql',
      expiredManifest: 'media/production/manifest-2026-08-16.json',
    })
  })
})

describe('mediaManifest', () => {
  it('lists the original, the variants and the tracks of every item, with the totals', () => {
    const manifest = mediaManifest('preview', new Date('2026-11-08T00:00:00Z'), [
      { id: 'm1', kind: 'image', sha256: 'aa', size_bytes: 100, original_key: 'originals/aa.jpg', variants: JSON.stringify([{ key: 'media/aa/aa/jpeg-320.jpg', size: 10 }]) },
      { id: 'm2', kind: 'video', sha256: 'bb', size_bytes: 500, original_key: 'media/bb/bb/video.mp4', variants: [] },
    ], [{ media_id: 'm2', key: 'media/bb/bb/captions-pt-BR.vtt', size: 5 }])
    expect(manifest).toMatchObject({ environment: 'preview', items: 2, objects: 4, bytes: 615 })
    expect(manifest.media[1]!.objects.map(object => object.key)).toEqual(['media/bb/bb/video.mp4', 'media/bb/bb/captions-pt-BR.vtt'])
  })
})

describe('compareSnapshots', () => {
  const source = { counts: { articles: 3, media: 2 }, samples: { articles: ['{"id":"a"}', '{"id":"b"}'] } }

  it('passes when counts and samples match', () => {
    expect(compareSnapshots(source, { counts: { articles: 3, media: 2, extra: 1 }, samples: { articles: ['{"id":"b"}', '{"id":"a"}'] } })).toEqual([])
  })

  it('names missing tables, different counts and changed samples', () => {
    expect(compareSnapshots(source, { counts: { articles: 2 }, samples: { articles: ['{"id":"a"}'] } })).toEqual([
      'articles: 3 rows in the source, 2 restored',
      'media: missing in the restored copy',
      'articles: 1 sampled rows differ',
    ])
  })
})
