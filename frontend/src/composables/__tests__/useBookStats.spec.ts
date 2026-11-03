import { describe, it, expect, vi } from 'vitest'
import * as booksApi from '../../api/books'
import { ApiError } from '../../api/http'
import { useBookStats } from '../useBookStats'
import type { BookStats } from '../../types/book'

const stats = { year: 2026 } as unknown as BookStats

describe('useBookStats', () => {
  it('取らなくてよい画面（ボード）では問い合わせない', async () => {
    const spy = vi.spyOn(booksApi, 'getBookStats').mockResolvedValue(stats)
    const { loadStats } = useBookStats(
      () => false,
      () => false,
    )
    await loadStats()
    expect(spy).not.toHaveBeenCalled()
  })

  it('年を切り替えると、その年で取り直す', async () => {
    const spy = vi.spyOn(booksApi, 'getBookStats').mockResolvedValue(stats)
    const { stats: result, changeStatsYear } = useBookStats(
      () => true,
      () => false,
    )
    changeStatsYear(2025)
    await vi.waitFor(() => expect(result.value).toEqual(stats))
    expect(spy).toHaveBeenCalledWith(2025)
  })

  it('取れなければ statsFailed。401 ならログイン画面へ戻す処理に任せる', async () => {
    vi.spyOn(booksApi, 'getBookStats').mockRejectedValueOnce(new Error('network'))
    const failed = useBookStats(
      () => true,
      () => false,
    )
    await failed.loadStats()
    expect(failed.statsFailed.value).toBe(true)

    vi.spyOn(booksApi, 'getBookStats').mockRejectedValueOnce(new ApiError(401, []))
    const onAuthError = vi.fn(() => true)
    const unauthorized = useBookStats(() => true, onAuthError)
    await unauthorized.loadStats()
    expect(onAuthError).toHaveBeenCalled()
    expect(unauthorized.statsFailed.value).toBe(false)
  })
})
