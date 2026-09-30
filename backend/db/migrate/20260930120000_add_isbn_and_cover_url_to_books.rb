class AddIsbnAndCoverUrlToBooks < ActiveRecord::Migration[8.1]
  # 書影（表紙画像）：ISBN と、Google Books の表紙画像の URL を保存する（どちらも無くてよい）
  def change
    add_column :books, :isbn, :string
    add_column :books, :cover_url, :string, limit: 500
  end
end
