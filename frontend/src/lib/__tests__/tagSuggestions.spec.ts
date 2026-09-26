import { describe, it, expect } from 'vitest'
import { suggestTags } from '../tagSuggestions'

describe('suggestTags', () => {
  it('タイトル・著者のキーワードに対応するタグを提案する', () => {
    const tags = suggestTags('罪と罰', 'ドストエフスキー', [])
    expect(tags).toEqual(expect.arrayContaining(['海外文学', '名著', 'ロシア文学']))
  })

  it('入力済みのタグは除外し、重複しない', () => {
    const tags = suggestTags('こころ', '夏目漱石', ['名著'])
    expect(tags).not.toContain('名著')
    expect(new Set(tags).size).toBe(tags.length)
  })

  it('キーワードに当たらなくても定番タグを返す', () => {
    expect(suggestTags('無関係な本', '', [])).toEqual(['名著', '再読したい', '積読'])
  })

  it('最大 8 件に制限する', () => {
    const tags = suggestTags('入門 論語 整体 100分de名著 文庫 新書', '', [])
    expect(tags.length).toBe(8)
  })

  it('過去に付けたタグを、辞書の候補の後・定番タグの前に並べる', () => {
    const tags = suggestTags('罪と罰', 'ドストエフスキー', [], { knownTags: ['仕事', '海外文学'] })
    expect(tags.slice(0, 5)).toEqual(['海外文学', '名著', 'ロシア文学', '仕事', '再読したい'])
  })

  it('入力中の文字を含む候補に絞り込み、前方一致を先にする（辞書の全タグも対象）', () => {
    const tags = suggestTags('無関係な本', '', [], {
      knownTags: ['仕事で読む', '読書会', 'あとで読む'],
      query: '読',
    })
    expect(tags).toEqual(['読書会', '仕事で読む', 'あとで読む', '再読したい', '積読', '定期購読'])
  })

  it('絞り込みでも入力済みのタグは除き、英字は大文字小文字を区別しない', () => {
    const tags = suggestTags('', '', ['Ruby入門'], { knownTags: ['Ruby入門', 'rails'], query: 'R' })
    expect(tags).toEqual(['rails'])
  })

  it('一致する候補が無ければ空', () => {
    expect(suggestTags('', '', [], { knownTags: ['仕事'], query: 'zzz' })).toEqual([])
  })

  it('limit で件数を変えられる（Infinity で全件）', () => {
    const known = Array.from({ length: 12 }, (_, n) => `タグ${n}`)
    expect(suggestTags('', '', [], { knownTags: known })).toHaveLength(8)
    expect(suggestTags('', '', [], { knownTags: known, limit: Infinity })).toHaveLength(15) // 12＋定番 3
  })
})
