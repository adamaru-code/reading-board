class ChangeBooksUserIdNotNull < ActiveRecord::Migration[8.1]
  def up
    # 所有者の無い本が残っていれば最初のユーザーに寄せる（ユーザーが居なければ制約付与で失敗させる）
    first_user_id = select_value("SELECT MIN(id) FROM users")
    execute("UPDATE books SET user_id = #{first_user_id.to_i} WHERE user_id IS NULL") if first_user_id
    change_column_null :books, :user_id, false
  end

  def down
    change_column_null :books, :user_id, true
  end
end
