// 読了冊数の統計（読了一覧の見出しと統計画面に出す）。KanbanBoard.vue から分けた（#370）
import { ref } from 'vue'
import { getBookStats } from '../api/books'
import type { BookStats } from '../types/book'

// shouldLoad：取るかどうか（ボードでは使わないので取らない）。onAuthError：401 なら true を返してログイン画面へ
export function useBookStats(shouldLoad: () => boolean, onAuthError: (e: unknown) => boolean) {
  const stats = ref<BookStats | null>(null)
  const statsFailed = ref(false)
  // 統計画面で選んだ年（未選択なら今年。保存・削除のあとも選んだ年のまま取り直す）
  const statsYear = ref<number | undefined>(undefined)

  async function loadStats() {
    if (!shouldLoad()) return
    try {
      stats.value = await getBookStats(statsYear.value)
      statsFailed.value = false
    } catch (e) {
      if (onAuthError(e)) return
      // 読了一覧では冊数が出ないだけ（一覧の表示は妨げない）。統計画面ではお知らせを出す
      statsFailed.value = true
    }
  }

  function changeStatsYear(year: number) {
    statsYear.value = year
    loadStats()
  }

  return { stats, statsFailed, loadStats, changeStatsYear }
}
