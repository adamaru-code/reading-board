import { describe, it, expect } from 'vitest'
import { keyboardMoveTarget, moveDirection } from '../keyboardMove'

const key = (key: string, mods: Partial<KeyboardEventInit> = {}) =>
  new KeyboardEvent('keydown', { key, altKey: true, ...mods })

describe('moveDirection（Option ＋ 矢印キーの向き）', () => {
  it('Option ＋ 矢印キーだけを向きにする', () => {
    expect(moveDirection(key('ArrowUp'))).toBe('up')
    expect(moveDirection(key('ArrowDown'))).toBe('down')
    expect(moveDirection(key('ArrowLeft'))).toBe('left')
    expect(moveDirection(key('ArrowRight'))).toBe('right')
  })

  it('Option なし・ほかの修飾キーつき・矢印以外は null', () => {
    expect(moveDirection(key('ArrowUp', { altKey: false }))).toBeNull()
    expect(moveDirection(key('ArrowUp', { shiftKey: true }))).toBeNull()
    expect(moveDirection(key('ArrowUp', { metaKey: true }))).toBeNull()
    expect(moveDirection(key('ArrowUp', { ctrlKey: true }))).toBeNull()
    expect(moveDirection(key('Enter'))).toBeNull()
  })
})

describe('keyboardMoveTarget（行き先）', () => {
  it('▲▼ は段の中を 1 つ上・下へ。端では動かさない', () => {
    expect(keyboardMoveTarget('want_to_read', 1, 3, 'up')).toEqual({
      status: 'want_to_read',
      index: 0,
    })
    expect(keyboardMoveTarget('reading', 1, 3, 'down')).toEqual({ status: 'reading', index: 2 })
    expect(keyboardMoveTarget('want_to_read', 0, 3, 'up')).toEqual({ blocked: 'いちばん上です' })
    expect(keyboardMoveTarget('want_to_read', 2, 3, 'down')).toEqual({ blocked: 'いちばん下です' })
  })

  it('読了の段は読了日などの順で並ぶので、▲▼ では動かさない', () => {
    expect(keyboardMoveTarget('read', 1, 3, 'up')).toEqual({
      blocked: '読了の段は読了日などの順で並ぶため、並び替えできません',
    })
  })

  it('◀▶ は左・右の段の一番上へ。端の段では動かさない', () => {
    expect(keyboardMoveTarget('want_to_read', 2, 3, 'right')).toEqual({
      status: 'reading',
      index: 0,
    })
    expect(keyboardMoveTarget('reading', 0, 1, 'right')).toEqual({ status: 'read', index: 0 })
    expect(keyboardMoveTarget('read', 0, 1, 'left')).toEqual({ status: 'reading', index: 0 })
    expect(keyboardMoveTarget('want_to_read', 0, 1, 'left')).toEqual({
      blocked: 'これより左に段はありません',
    })
    expect(keyboardMoveTarget('read', 0, 1, 'right')).toEqual({
      blocked: 'これより右に段はありません',
    })
  })
})
