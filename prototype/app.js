// 読書管理ボード — 画面プロトタイプ用スクリプト
// ※モック：状態はメモリ上のみ。リロードすると初期データに戻ります（永続化・API通信なし）。
// データモデル / status enum は docs/database-design.md に準拠。

"use strict";

// ---------- 定数（status enum は設計書と一致させる） ----------
const STATUSES = [
  { key: "want_to_read", label: "読みたい" },
  { key: "reading", label: "読書中" },
  { key: "read", label: "読了" },
];
const STATUS_LABEL = Object.fromEntries(STATUSES.map((s) => [s.key, s.label]));
// カード上の日付ラベル（各カラムに入った日）: 読みたい=登録日 / 読書中=開始日 / 読了=読了日
const STATUS_DATE_LABEL = { want_to_read: "登録", reading: "開始", read: "読了" };

// ---------- 種別（ジャンル・形態） ----------
// 主ジャンル（単一）。既定は other。
const GENRES = [
  { key: "classic_novel", label: "古典・名作小説" },
  { key: "liberal_arts", label: "教養・人文・思想" },
  { key: "health_body", label: "健康・身体" },
  { key: "practical", label: "実用・暮らし" },
  { key: "other", label: "その他・未分類" },
];
const GENRE_LABEL = Object.fromEntries(GENRES.map((g) => [g.key, g.label]));
// 形態（単一）。書籍 / 雑誌
const FORMAT_LABEL = { book: "書籍", magazine: "雑誌" };

// ---------- インメモリ状態（サンプルデータ） ----------
// dates: 各ステータスに入った日の履歴（YYYY-MM-DD の配列）。カードは現在ステータスの日付を全件表示する。
// genre: 主ジャンル(key) / format: "book"|"magazine" / tags: 文字列配列
let nextId = 9;
let books = [
  { id: 1, title: "罪と罰", author: "ドストエフスキー", status: "want_to_read", rating: 0, memo: "", genre: "classic_novel", format: "book", tags: ["古典"], dates: { want_to_read: ["2026-07-10"] } },
  { id: 2, title: "表現者クライテリオン 2026年7月号", author: "", status: "want_to_read", rating: 0, memo: "", genre: "liberal_arts", format: "magazine", tags: ["評論"], dates: { want_to_read: ["2026-07-11"] } },
  { id: 3, title: "整体入門", author: "野口 晴哉", status: "want_to_read", rating: 0, memo: "", genre: "health_body", format: "book", tags: ["整体", "入門"], dates: { want_to_read: ["2026-07-12"] } },
  { id: 4, title: "NHK100分de名著 論語", author: "", status: "reading", rating: 0, memo: "名著解説がわかりやすい。", genre: "liberal_arts", format: "magazine", tags: ["名著"], dates: { want_to_read: ["2026-06-28"], reading: ["2026-07-05"] } },
  { id: 5, title: "論語", author: "孔子", status: "reading", rating: 0, memo: "", genre: "liberal_arts", format: "book", tags: ["古典"], dates: { want_to_read: ["2026-06-30"], reading: ["2026-07-08"] } },
  // 再読の例：読了に2回入った履歴を持つ
  { id: 6, title: "こころ", author: "夏目 漱石", status: "read", rating: 5, memo: "何度読んでも発見がある。再読したい。", genre: "classic_novel", format: "book", tags: ["名著", "再読したい"], dates: { want_to_read: ["2026-05-15"], reading: ["2026-05-20"], read: ["2026-06-10", "2026-07-01"] } },
  { id: 7, title: "武士道", author: "新渡戸 稲造", status: "read", rating: 4, memo: "", genre: "liberal_arts", format: "book", tags: ["古典", "教養"], dates: { want_to_read: ["2026-04-01"], reading: ["2026-04-10"], read: ["2026-04-20"] } },
  { id: 8, title: "養生訓", author: "貝原 益軒", status: "read", rating: 3, memo: "", genre: "health_body", format: "book", tags: ["養生"], dates: { want_to_read: ["2026-06-01"], reading: ["2026-06-15"], read: ["2026-06-18"] } },
];

// 種別のデフォルトを補完（後方互換）
function normalizeBook(book) {
  if (!book.genre) book.genre = "other";
  if (!book.format) book.format = "book";
  if (!Array.isArray(book.tags)) book.tags = [];
  return book;
}
books.forEach(normalizeBook);

// 現在のジャンル絞り込み（"all" or genre key）
let genreFilter = "all";

// ---------- 日付ユーティリティ ----------
// ローカルの今日を YYYY-MM-DD で返す
function todayISO() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
// YYYY-MM-DD → YYYY/MM/DD 表示
function formatDate(iso) {
  return iso ? iso.replace(/-/g, "/") : "";
}
// 指定ステータスに入った日を履歴に追加する（同一日付の重複は追加しない）
function stampStatus(book, status) {
  if (!book.dates) book.dates = {};
  if (!Array.isArray(book.dates[status])) book.dates[status] = [];
  const today = todayISO();
  if (!book.dates[status].includes(today)) book.dates[status].push(today);
}

// 編集中の書籍 id（追加モードは null）
let editingId = null;
// ★入力の一時値
let ratingDraft = 0;

// ---------- DOM 参照 ----------
const board = document.getElementById("board");
const overlay = document.getElementById("modal-overlay");
const modal = overlay.querySelector(".modal");
const modalTitle = document.getElementById("modal-title");
const form = document.getElementById("book-form");
const fTitle = document.getElementById("f-title");
const fAuthor = document.getElementById("f-author");
const fStatus = document.getElementById("f-status");
const fMemo = document.getElementById("f-memo");
const titleError = document.getElementById("title-error");
const starInput = document.getElementById("star-input");
const stars = Array.from(starInput.querySelectorAll(".star"));
const deleteBtn = document.getElementById("delete-btn");

// コードから登録 用
const fIsbn = document.getElementById("f-isbn");
const lookupBtn = document.getElementById("lookup-btn");
const scanBtn = document.getElementById("scan-btn");
const scanHint = document.getElementById("scan-hint");
const scanner = document.getElementById("scanner");
const scanVideo = document.getElementById("scan-video");
const scanStop = document.getElementById("scan-stop");
const lookupResult = document.getElementById("lookup-result");
const lookupMessage = document.getElementById("lookup-message");
const lookupStatus = lookupResult.querySelector(".lookup-status");
const coverImg = document.getElementById("cover-img");
const typeBadge = document.getElementById("type-badge");

// 種別入力
const fGenre = document.getElementById("f-genre");
const fFormat = document.getElementById("f-format");
const fTags = document.getElementById("f-tags");
const genreFilterSelect = document.getElementById("genre-filter");

// ---------- 描画 ----------
function starsHtml(rating) {
  if (!rating) return ""; // 未評価は非表示
  let html = '<span class="card-stars">';
  for (let i = 1; i <= 5; i++) {
    html += `<span class="${i <= rating ? "on" : "off"}">★</span>`;
  }
  return html + "</span>";
}

// 現在のステータス（＝カードがいる列）に入った日を全件表示（履歴）
function cardDateHtml(book) {
  const list = book.dates && book.dates[book.status];
  if (!list || !list.length) return "";
  const label = STATUS_DATE_LABEL[book.status] || "";
  const dates = list.map(formatDate).join("、");
  return `<div class="card-date">${label} ${dates}</div>`;
}

// 開始（最初の reading 日）から読了（最初の read 日）までの所要日数
function readingDurationDays(book) {
  const starts = book.dates && book.dates.reading;
  const ends = book.dates && book.dates.read;
  if (!starts || !starts.length || !ends || !ends.length) return null;
  const ms = new Date(ends[0]) - new Date(starts[0]);
  if (isNaN(ms) || ms < 0) return null;
  return Math.round(ms / 86400000);
}

// 読了カードに「開始→読了 ◯日」を表示（計算できない場合は非表示）
function cardDurationHtml(book) {
  if (book.status !== "read") return "";
  const days = readingDurationDays(book);
  if (days === null) return "";
  return `<div class="card-duration">開始→読了 ${days}日</div>`;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

// ---------- 読了カラムの並び替え ----------
// read=読了日 / rating=評価 / want_to_read=登録日 / duration=所要日数
const READ_SORT_OPTIONS = [
  { key: "read", label: "読了日" },
  { key: "rating", label: "評価" },
  { key: "want_to_read", label: "登録日" },
  { key: "duration", label: "所要日数" },
];
let readSortKey = "read";
let readSortDir = "desc"; // desc=降順（新しい/高い/長い順）/ asc=昇順

// 並び替えキーに対応する比較値（算出不可は null）
function readSortValue(book, key) {
  if (key === "rating") return book.rating || 0;
  if (key === "duration") return readingDurationDays(book);
  const list = book.dates && book.dates[key];
  if (!list || !list.length) return null;
  // 読了日は最新（末尾）、登録日は最初（先頭）を使う
  const iso = key === "read" ? list[list.length - 1] : list[0];
  const t = Date.parse(iso);
  return isNaN(t) ? null : t;
}

// read 列の配列をその場でソート（null は方向に関わらず末尾）
function sortReadBooks(arr) {
  const dir = readSortDir === "asc" ? 1 : -1;
  arr.sort((x, y) => {
    const vx = readSortValue(x, readSortKey);
    const vy = readSortValue(y, readSortKey);
    if (vx === null && vy === null) return 0;
    if (vx === null) return 1;
    if (vy === null) return -1;
    if (vx === vy) return 0;
    return (vx < vy ? -1 : 1) * dir;
  });
}

// read 列ヘッダに差し込む並び替えUIを生成
function buildSortControl(column) {
  const control = document.createElement("div");
  control.className = "sort-control";

  const select = document.createElement("select");
  select.className = "sort-key";
  select.setAttribute("aria-label", "並び替え");
  for (const opt of READ_SORT_OPTIONS) {
    const o = document.createElement("option");
    o.value = opt.key;
    o.textContent = opt.label;
    if (opt.key === readSortKey) o.selected = true;
    select.appendChild(o);
  }
  select.addEventListener("change", () => {
    readSortKey = select.value;
    render();
  });

  const dirBtn = document.createElement("button");
  dirBtn.type = "button";
  dirBtn.className = "sort-dir";
  dirBtn.textContent = readSortDir === "asc" ? "↑" : "↓";
  dirBtn.title = readSortDir === "asc" ? "昇順" : "降順";
  dirBtn.setAttribute("aria-label", dirBtn.title);
  dirBtn.addEventListener("click", () => {
    readSortDir = readSortDir === "asc" ? "desc" : "asc";
    render();
  });

  control.appendChild(select);
  control.appendChild(dirBtn);
  column.querySelector(".column-header").appendChild(control);
}

function render() {
  board.innerHTML = "";
  for (const { key, label } of STATUSES) {
    const inColumn = books.filter(
      (b) => b.status === key && (genreFilter === "all" || b.genre === genreFilter)
    );
    if (key === "read") sortReadBooks(inColumn); // 読了列のみ並び替え

    const column = document.createElement("section");
    column.className = "column";
    column.dataset.status = key;
    column.innerHTML = `
      <div class="column-header">
        <span class="column-title">${label}</span>
        <span class="column-count">${inColumn.length}</span>
      </div>
      <div class="card-list"></div>`;

    if (key === "read") buildSortControl(column); // 読了列ヘッダに並び替えUI

    const list = column.querySelector(".card-list");
    for (const book of inColumn) {
      list.appendChild(createCard(book));
    }

    // ドロップ受け入れ
    column.addEventListener("dragover", (e) => {
      e.preventDefault();
      column.classList.add("drag-over");
    });
    column.addEventListener("dragleave", (e) => {
      if (!column.contains(e.relatedTarget)) column.classList.remove("drag-over");
    });
    column.addEventListener("drop", (e) => {
      e.preventDefault();
      column.classList.remove("drag-over");
      const id = Number(e.dataTransfer.getData("text/plain"));
      moveBook(id, key);
    });

    board.appendChild(column);
  }
}

// 種別バッジ（主ジャンル ＋ 雑誌なら形態バッジ）
function cardBadgesHtml(book) {
  const genre = book.genre || "other";
  let html = `<span class="genre-badge genre-${genre}">${GENRE_LABEL[genre]}</span>`;
  if (book.format === "magazine") {
    html += `<span class="format-badge">雑誌</span>`;
  }
  return `<div class="card-badges">${html}</div>`;
}

// タグ chip
function cardTagsHtml(book) {
  if (!book.tags || !book.tags.length) return "";
  const chips = book.tags
    .map((t) => `<span class="tag-chip">${escapeHtml(t)}</span>`)
    .join("");
  return `<div class="card-tags">${chips}</div>`;
}

function createCard(book) {
  const card = document.createElement("article");
  card.className = "card";
  card.draggable = true;
  card.dataset.id = book.id;
  card.innerHTML = `
    ${cardBadgesHtml(book)}
    <div class="card-title">${escapeHtml(book.title)}</div>
    ${book.author ? `<div class="card-author">${escapeHtml(book.author)}</div>` : ""}
    ${starsHtml(book.rating)}
    ${cardTagsHtml(book)}
    ${cardDateHtml(book)}
    ${cardDurationHtml(book)}`;

  card.addEventListener("click", () => openEditModal(book.id));
  card.addEventListener("dragstart", (e) => {
    card.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(book.id));
  });
  card.addEventListener("dragend", () => card.classList.remove("dragging"));
  return card;
}

// ---------- 操作 ----------
function moveBook(id, newStatus) {
  const book = books.find((b) => b.id === id);
  if (book && book.status !== newStatus) {
    book.status = newStatus; // = status を PATCH で更新するイメージ
    stampStatus(book, newStatus); // 移動先カラムに入った日を記録
    render();
  }
}

// ---------- モーダル ----------
function openAddModal() {
  editingId = null;
  ratingDraft = 0;
  modal.dataset.mode = "add";
  modalTitle.textContent = "書籍を追加";
  form.reset();
  fStatus.value = "want_to_read";
  fGenre.value = "other";
  fFormat.value = "book";
  fTags.value = "";
  clearTitleError();
  resetCodeSection();
  syncStars();
  showModal();
  fIsbn.focus();
}

function openEditModal(id) {
  const book = books.find((b) => b.id === id);
  if (!book) return;
  editingId = id;
  ratingDraft = book.rating || 0;
  modal.dataset.mode = "edit";
  modalTitle.textContent = "書籍を編集";
  fTitle.value = book.title;
  fAuthor.value = book.author || "";
  fStatus.value = book.status;
  fMemo.value = book.memo || "";
  fGenre.value = book.genre || "other";
  fFormat.value = book.format || "book";
  fTags.value = (book.tags || []).join(", ");
  clearTitleError();
  syncStars();
  showModal();
  fTitle.focus();
}

// タグ入力（カンマ/読点区切り）→ 配列（空・重複を除去）
function parseTags(raw) {
  return [...new Set(
    String(raw)
      .split(/[,、]/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0)
  )];
}

function showModal() {
  overlay.hidden = false;
}
function closeModal() {
  overlay.hidden = true;
  editingId = null;
  stopScanner(); // カメラを確実に停止
}

function clearTitleError() {
  titleError.hidden = true;
  fTitle.classList.remove("invalid");
}

// ★入力の見た目を ratingDraft に同期
function syncStars() {
  stars.forEach((star) => {
    const v = Number(star.dataset.value);
    star.classList.toggle("on", v <= ratingDraft);
  });
}

function submitForm(e) {
  e.preventDefault();
  const title = fTitle.value.trim();
  if (!title) {
    titleError.hidden = false;
    fTitle.classList.add("invalid");
    fTitle.focus();
    return;
  }

  const data = {
    title,
    author: fAuthor.value.trim(),
    status: fStatus.value,
    rating: ratingDraft,
    memo: fMemo.value.trim(),
    genre: fGenre.value,
    format: fFormat.value,
    tags: parseTags(fTags.value),
  };

  if (editingId === null) {
    // 追加時のみ、コードから登録した ISBN/JAN を保持（プロトタイプ限定の表示用）
    const ean13 = toEan13(fIsbn.value);
    const newBook = { id: nextId++, ...data, isbn: ean13 || "", dates: {} };
    stampStatus(newBook, newBook.status); // 初期ステータスに入った日を記録
    books.push(newBook);
  } else {
    const book = books.find((b) => b.id === editingId);
    if (book) {
      const statusChanged = book.status !== data.status;
      Object.assign(book, data);
      if (statusChanged) stampStatus(book, data.status); // 編集で変更した先の日付を更新
    }
  }

  closeModal();
  render();
}

function deleteCurrent() {
  if (editingId === null) return;
  const book = books.find((b) => b.id === editingId);
  if (!book) return;
  if (!confirm(`「${book.title}」を削除しますか？`)) return;
  books = books.filter((b) => b.id !== editingId);
  closeModal();
  render();
}

// ---------- コードから登録（openBD） ----------
// openBD は書籍(ISBN 978/979)のみ対応。雑誌(491)/該当なしは [null] を返すため手入力に誘導する。

// 数字のみ抽出
function normalizeCode(raw) {
  return String(raw).replace(/[^0-9Xx]/g, "").toUpperCase();
}

// ISBN-10 → ISBN-13 変換（978 + 先頭9桁 + 再計算チェックディジット）
function isbn10to13(isbn10) {
  const core = "978" + isbn10.slice(0, 9);
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += Number(core[i]) * (i % 2 === 0 ? 1 : 3);
  }
  const check = (10 - (sum % 10)) % 10;
  return core + check;
}

// コードを 13 桁 JAN/ISBN-13 に正規化（不正なら null）
function toEan13(raw) {
  const code = normalizeCode(raw);
  if (/^\d{13}$/.test(code)) return code;
  if (/^\d{9}[\dX]$/.test(code)) return isbn10to13(code); // ISBN-10
  return null;
}

// 種別判定（表示用）
function codeType(ean13) {
  if (/^97[89]/.test(ean13)) return "book";
  if (/^491/.test(ean13)) return "magazine";
  return "other";
}

function resetCodeSection() {
  stopScanner();
  fIsbn.value = "";
  lookupResult.hidden = true;
  coverImg.hidden = true;
  coverImg.removeAttribute("src");
  typeBadge.hidden = true;
  lookupMessage.textContent = "";
  lookupStatus.className = "lookup-status";
}

function showLookupMessage(kind, html) {
  lookupResult.hidden = false;
  lookupStatus.className = "lookup-status " + kind; // ok | warn | error
  lookupMessage.innerHTML = html;
}

function setTypeBadge(type) {
  if (type === "book") {
    typeBadge.hidden = false;
    typeBadge.className = "type-badge book";
    typeBadge.textContent = "書籍";
  } else if (type === "magazine") {
    typeBadge.hidden = false;
    typeBadge.className = "type-badge magazine";
    typeBadge.textContent = "雑誌";
  } else {
    typeBadge.hidden = true;
  }
}

// openBD で書誌を取得してフォームへ反映
async function lookupCode() {
  const ean13 = toEan13(fIsbn.value);
  coverImg.hidden = true;
  coverImg.removeAttribute("src");

  if (!ean13) {
    setTypeBadge("other");
    showLookupMessage("error", "13桁のISBN/JAN（またはISBN-10）を入力してください。");
    return;
  }

  const type = codeType(ean13);
  setTypeBadge(type);
  // 形態を自動セット：491=雑誌 / 978・979=書籍
  if (type === "magazine") fFormat.value = "magazine";
  else if (type === "book") fFormat.value = "book";
  showLookupMessage("warn", "検索中…");

  try {
    const res = await fetch("https://api.openbd.jp/v1/get?isbn=" + ean13);
    const data = await res.json();
    const summary = data && data[0] && data[0].summary;

    if (summary && summary.title) {
      fTitle.value = summary.title;
      fAuthor.value = summary.author || "";
      clearTitleError();
      if (summary.cover) {
        coverImg.src = summary.cover;
        coverImg.hidden = false;
      }
      showLookupMessage("ok", "書誌情報を取得しました。内容を確認して保存してください。");
    } else if (type === "magazine") {
      // 雑誌は openBD 非対応。コードは保持しつつタイトル手入力へ誘導。
      showLookupMessage(
        "warn",
        "雑誌は自動取得に対応していません。タイトルを手入力してください。"
      );
      fTitle.focus();
    } else {
      showLookupMessage(
        "warn",
        "該当する書籍が見つかりませんでした。手入力で登録できます。"
      );
      fTitle.focus();
    }
  } catch (err) {
    showLookupMessage(
      "error",
      "取得に失敗しました（オフライン等）。手入力で登録できます。"
    );
  }
}

// ---------- バーコードスキャン（BarcodeDetector） ----------
let mediaStream = null;
let scanRAF = null;
let barcodeDetector = null;

const scanSupported =
  "BarcodeDetector" in window &&
  !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) &&
  window.isSecureContext;

async function startScanner() {
  if (!scanSupported) return;
  try {
    if (!barcodeDetector) {
      barcodeDetector = new BarcodeDetector({ formats: ["ean_13"] });
    }
    mediaStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
    });
    scanVideo.srcObject = mediaStream;
    await scanVideo.play();
    scanner.hidden = false;
    scanLoop();
  } catch (err) {
    showLookupMessage("error", "カメラを起動できませんでした。ISBN手入力をご利用ください。");
    stopScanner();
  }
}

async function scanLoop() {
  if (!mediaStream || !barcodeDetector) return;
  try {
    const codes = await barcodeDetector.detect(scanVideo);
    if (codes.length > 0) {
      const value = codes[0].rawValue;
      fIsbn.value = value;
      stopScanner();
      lookupCode(); // 読み取ったら即補完
      return;
    }
  } catch (_) {
    // 一時的な検出失敗は無視して次フレームへ
  }
  scanRAF = requestAnimationFrame(scanLoop);
}

function stopScanner() {
  if (scanRAF) {
    cancelAnimationFrame(scanRAF);
    scanRAF = null;
  }
  if (mediaStream) {
    mediaStream.getTracks().forEach((t) => t.stop());
    mediaStream = null;
  }
  scanVideo.srcObject = null;
  scanner.hidden = true;
}

// 対応状況に応じてスキャンボタン/注記を出し分け
if (scanSupported) {
  scanBtn.hidden = false;
} else {
  scanHint.hidden = false;
}

// ---------- イベント登録 ----------
lookupBtn.addEventListener("click", lookupCode);
fIsbn.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    lookupCode();
  }
});
scanBtn.addEventListener("click", startScanner);
scanStop.addEventListener("click", stopScanner);

document.getElementById("add-book-btn").addEventListener("click", openAddModal);
document.getElementById("cancel-btn").addEventListener("click", closeModal);
deleteBtn.addEventListener("click", deleteCurrent);
form.addEventListener("submit", submitForm);
fTitle.addEventListener("input", () => {
  if (fTitle.value.trim()) clearTitleError();
});

// ★入力
stars.forEach((star) => {
  star.addEventListener("click", () => {
    ratingDraft = Number(star.dataset.value);
    syncStars();
  });
});
document.getElementById("star-clear").addEventListener("click", () => {
  ratingDraft = 0;
  syncStars();
});

// オーバーレイの外側クリック / Esc で閉じる
overlay.addEventListener("click", (e) => {
  if (e.target === overlay) closeModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !overlay.hidden) closeModal();
});

// ---------- ジャンル select / フィルタの初期化 ----------
// 追加/編集モーダルのジャンル select（GENRES を単一ソースに）
for (const g of GENRES) {
  const o = document.createElement("option");
  o.value = g.key;
  o.textContent = g.label;
  fGenre.appendChild(o);
}
// ヘッダのジャンル絞り込み（すべて + 各ジャンル）
const allOpt = document.createElement("option");
allOpt.value = "all";
allOpt.textContent = "すべて";
genreFilterSelect.appendChild(allOpt);
for (const g of GENRES) {
  const o = document.createElement("option");
  o.value = g.key;
  o.textContent = g.label;
  genreFilterSelect.appendChild(o);
}
genreFilterSelect.addEventListener("change", () => {
  genreFilter = genreFilterSelect.value;
  render();
});

// ---------- 初期描画 ----------
render();
