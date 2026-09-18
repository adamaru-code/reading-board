// タイトル・著者名から候補タグを辞書ベースで提案する（prototype の suggestTags を移植）。
// 将来 AI/API 呼び出しに差し替え可能。クライアント側で完結。

interface TagRule {
  kw: string[]
  tags: string[]
}

const TAG_RULES: TagRule[] = [
  // --- タイトル・内容から ---
  { kw: ['入門', 'はじめて', 'やさしい'], tags: ['入門'] },
  { kw: ['論語', '老子', '荘子', '孟子'], tags: ['東洋思想', '古典'] },
  { kw: ['整体', '養生', '呼吸', '身体', '健康'], tags: ['健康法', '実践したい'] },
  { kw: ['100分de名著', '名著'], tags: ['名著解説', 'シリーズ'] },
  { kw: ['クライテリオン', '表現者'], tags: ['評論', '定期購読'] },
  { kw: ['文庫'], tags: ['文庫'] },
  { kw: ['新書'], tags: ['新書'] },
  { kw: ['罪と罰', 'カラマーゾフ', '戦争と平和'], tags: ['海外文学', '名著'] },
  { kw: ['こころ', '坊っちゃん'], tags: ['日本文学', '名著'] },
  // --- 著者名から ---
  { kw: ['漱石', '鴎外', '太宰', '芥川'], tags: ['日本文学', '名著'] },
  { kw: ['ドストエフスキー', 'トルストイ'], tags: ['海外文学', 'ロシア文学'] },
  { kw: ['孔子', '老子'], tags: ['東洋思想', '古典'] },
  { kw: ['野口', '晴哉'], tags: ['野口整体', '健康法'] },
  { kw: ['新渡戸', '稲造'], tags: ['教養', '古典'] },
  { kw: ['貝原', '益軒'], tags: ['養生', '古典'] },
]

const GENERIC_TAGS = ['名著', '再読したい', '積読'] // 常に候補に加える定番タグ
const MAX_SUGGEST = 8

// タイトル・著者から提案タグを返す（入力済みタグは除外・重複除去・上限あり）
export function suggestTags(
  title: string,
  author: string,
  currentTags: readonly string[],
): string[] {
  const hay = `${title} ${author}`
  const has = new Set(currentTags)
  const out: string[] = []
  const push = (tag: string) => {
    if (!has.has(tag) && !out.includes(tag)) out.push(tag)
  }
  for (const rule of TAG_RULES) {
    if (rule.kw.some((k) => hay.includes(k))) rule.tags.forEach(push)
  }
  GENERIC_TAGS.forEach(push)
  return out.slice(0, MAX_SUGGEST)
}
