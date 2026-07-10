# 読書管理アプリ — 技術スタック

> この文書は [要件定義書（概要）](requirements.md) から分割した詳細ドキュメントです。
> 採用技術とその選定理由、開発環境をまとめます。
> ポート・Docker/mise などローカル運用ルールは [CLAUDE.md](../CLAUDE.md) §8 が正とします。

関連：[機能要件](functional-requirements.md) / [画面設計](screen-design.md) / [データベース設計](database-design.md)

---

## 1. 技術選定

| 層 | 採用技術 | 選定理由 |
|---|---|---|
| バックエンド | Ruby on Rails 8（API モード） | 学習対象（RaiseTech）。CRUD・enum・バリデーションなどを規約に沿って高い生産性で実装でき、API 専用構成で軽量 |
| フロントエンド | Vue 3 + Vite + TypeScript（SPA） | カンバンのような動的 UI に適する。TS で型安全、Vite で高速な開発体験。学習対象 |
| データベース | MySQL 8 | 広く使われる RDB で情報が豊富。Docker でローカル環境を容易に再現できる |
| API 通信 | REST / JSON | シンプルで学習向き。今回の規模では GraphQL 等はオーバースペック |
| 開発環境 | Docker（MySQL）/ mise（Ruby 3.3）/ 固定ポート | ローカル再現性を確保。ポートは Backend 3000 / Frontend 5173 / MySQL 3306 に固定（[CLAUDE.md](../CLAUDE.md) §8） |

---

## 2. システム構成

構成図（フロント → Vite プロキシ → Rails API → MySQL）と各層の役割は [基本設計（図）](basic-design.md) §1 を参照。
