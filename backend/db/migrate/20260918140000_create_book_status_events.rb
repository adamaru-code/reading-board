class CreateBookStatusEvents < ActiveRecord::Migration[8.1]
  def change
    create_table :book_status_events do |t|
      t.references :book, null: false, foreign_key: true
      t.integer :status, null: false
      t.date :occurred_on, null: false

      t.datetime :created_at, null: false
    end
    # 同一の本・状態・日は重複記録しない（プロトタイプ挙動）
    add_index :book_status_events, %i[book_id status occurred_on], unique: true
  end
end
