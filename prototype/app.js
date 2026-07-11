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

// ---------- インメモリ状態（サンプルデータ） ----------
let nextId = 7;
let books = [
  { id: 1, title: "リーダブルコード", author: "Dustin Boswell", status: "want_to_read", rating: 0, memo: "" },
  { id: 2, title: "達人プログラマー", author: "Andrew Hunt", status: "want_to_read", rating: 0, memo: "" },
  { id: 3, title: "Webを支える技術", author: "山本 陽平", status: "want_to_read", rating: 0, memo: "" },
  { id: 4, title: "オブジェクト指向設計実践ガイド", author: "Sandi Metz", status: "reading", rating: 0, memo: "後半のリファクタ章が濃い。" },
  { id: 5, title: "テスト駆動開発", author: "Kent Beck", status: "reading", rating: 0, memo: "" },
  { id: 6, title: "SQLアンチパターン", author: "Bill Karwin", status: "read", rating: 5, memo: "実務で刺さる例が多く再読したい。" },
];

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

// ---------- 描画 ----------
function starsHtml(rating) {
  if (!rating) return ""; // 未評価は非表示
  let html = '<span class="card-stars">';
  for (let i = 1; i <= 5; i++) {
    html += `<span class="${i <= rating ? "on" : "off"}">★</span>`;
  }
  return html + "</span>";
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

function render() {
  board.innerHTML = "";
  for (const { key, label } of STATUSES) {
    const inColumn = books.filter((b) => b.status === key);

    const column = document.createElement("section");
    column.className = "column";
    column.dataset.status = key;
    column.innerHTML = `
      <div class="column-header">
        <span class="column-title">${label}</span>
        <span class="column-count">${inColumn.length}</span>
      </div>
      <div class="card-list"></div>`;

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

function createCard(book) {
  const card = document.createElement("article");
  card.className = "card";
  card.draggable = true;
  card.dataset.id = book.id;
  card.innerHTML = `
    <div class="card-title">${escapeHtml(book.title)}</div>
    ${book.author ? `<div class="card-author">${escapeHtml(book.author)}</div>` : ""}
    ${starsHtml(book.rating)}`;

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
  clearTitleError();
  syncStars();
  showModal();
  fTitle.focus();
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
  clearTitleError();
  syncStars();
  showModal();
  fTitle.focus();
}

function showModal() {
  overlay.hidden = false;
}
function closeModal() {
  overlay.hidden = true;
  editingId = null;
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
  };

  if (editingId === null) {
    books.push({ id: nextId++, ...data });
  } else {
    const book = books.find((b) => b.id === editingId);
    if (book) Object.assign(book, data);
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

// ---------- イベント登録 ----------
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

// ---------- 初期描画 ----------
render();
