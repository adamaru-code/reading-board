# デモ / 動作確認用の初期データ。`bin/rails db:seed` で投入する。
# タイトルをキーに find_or_create するので、複数回実行しても重複しない（冪等）。

# 初期ユーザー＝管理者（他のユーザーは招待コードで登録。認証情報は環境変数で上書き可）
# 既定パスワードは流出リストに載らない開発用の値。毎回設定するので再 seed で既存ユーザーにも反映される。
user = User.find_or_initialize_by(email: ENV.fetch("SEED_USER_EMAIL", "owner@example.com"))
user.password = ENV.fetch("SEED_USER_PASSWORD", "ReadingBoard-dev-2026!")
user.admin = true # 招待コードを発行できる管理者
user.save!

books = [
  {
    title: "リーダブルコード",
    author: "Dustin Boswell",
    status: :reading,
    genre: :practical,
    media_type: :book,
    rating: 4,
    memo: "命名と関数分割の章が特に良い。",
    tags: %w[実践したい 名著],
    events: { reading: 5.days.ago.to_date }
  },
  {
    title: "達人プログラマー",
    author: "Andrew Hunt",
    status: :want_to_read,
    genre: :practical,
    media_type: :book,
    tags: %w[積読]
  },
  {
    title: "論語",
    author: "孔子",
    status: :read,
    genre: :classic_novel,
    media_type: :book,
    rating: 5,
    memo: "折に触れて読み返したい。",
    tags: %w[東洋思想 古典 再読したい],
    events: { reading: 30.days.ago.to_date, read: 10.days.ago.to_date }
  },
  {
    title: "こころ",
    author: "夏目漱石",
    status: :read,
    genre: :classic_novel,
    media_type: :book,
    rating: 4,
    tags: %w[日本文学 名著],
    events: { reading: 20.days.ago.to_date, read: 14.days.ago.to_date }
  },
  {
    title: "整体入門",
    author: "野口晴哉",
    status: :reading,
    genre: :health_body,
    media_type: :book,
    rating: 3,
    tags: %w[野口整体 健康法],
    events: { reading: 3.days.ago.to_date }
  },
  {
    title: "表現者クライテリオン 2026年9月号",
    author: "",
    status: :want_to_read,
    genre: :liberal_arts,
    media_type: :magazine,
    tags: %w[評論 定期購読]
  }
]

books.each do |attrs|
  events = attrs.delete(:events) || {}
  tags = attrs.delete(:tags)

  book = user.books.find_or_initialize_by(title: attrs[:title])
  book.assign_attributes(attrs)
  book.tag_names = tags if tags
  book.save!

  # 過去日の状態イベント（所要日数を見せるため）。冪等に追加する。
  events.each do |status, occurred_on|
    book.status_events.find_or_create_by!(status: status, occurred_on: occurred_on)
  end
end

puts "Seeded: users=#{User.count}, books=#{Book.count}, tags=#{Tag.count}, status_events=#{BookStatusEvent.count}"
