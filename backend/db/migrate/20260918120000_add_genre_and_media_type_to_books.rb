class AddGenreAndMediaTypeToBooks < ActiveRecord::Migration[8.1]
  def change
    # 主ジャンル（単一）: default other(4) / 形態: default book(0)。詳細は docs/database-design.md §3・§4
    add_column :books, :genre, :integer, null: false, default: 4
    add_column :books, :media_type, :integer, null: false, default: 0
  end
end
