class CreateBookTags < ActiveRecord::Migration[8.1]
  def change
    create_table :book_tags do |t|
      t.references :book, null: false, foreign_key: true
      t.references :tag, null: false, foreign_key: true

      t.timestamps
    end
    # 同じ本に同じタグを二重付与しない
    add_index :book_tags, %i[book_id tag_id], unique: true
  end
end
