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
})
