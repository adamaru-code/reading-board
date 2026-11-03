class CreateIsbnLookups < ActiveRecord::Migration[8.1]
  # ISBN で調べた結果を取っておく（同じ ISBN では openBD・Google Books に問い合わせない。#374）。
  # 書誌（openBD）と表紙（Google Books）は、問い合わせる相手も失敗の仕方も違うので、別々に結果と調べた時刻を持つ。
  # どのユーザーが調べたかは持たない（書誌・表紙は誰が調べても同じ）
  def change
    create_table :isbn_lookups do |t|
      t.string :isbn, limit: 13, null: false
      # "found" / "not_found"（まだ調べていなければ NULL）
      t.string :biblio_status
      t.text :title
      t.text :author
      t.datetime :biblio_checked_at
      t.string :cover_status
      t.string :cover_url, limit: 500
      t.datetime :cover_checked_at
      t.timestamps
    end
    add_index :isbn_lookups, :isbn, unique: true
  end
end
