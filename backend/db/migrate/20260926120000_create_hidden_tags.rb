class CreateHiddenTags < ActiveRecord::Migration[8.1]
  def change
    # タグ候補から隠したタグ名（ユーザーごと）。辞書の候補も隠せるよう tags ではなく名前で持つ
    create_table :hidden_tags do |t|
      t.references :user, null: false, foreign_key: true
      t.string :name, null: false
      t.timestamps
    end
    add_index :hidden_tags, [ :user_id, :name ], unique: true
  end
end
