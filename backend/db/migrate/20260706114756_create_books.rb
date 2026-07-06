class CreateBooks < ActiveRecord::Migration[8.1]
  def change
    create_table :books do |t|
      t.string :title, null: false
      t.string :author
      t.integer :status, null: false, default: 0
      t.integer :rating
      t.text :memo
      t.integer :position

      t.timestamps
    end
  end
end
