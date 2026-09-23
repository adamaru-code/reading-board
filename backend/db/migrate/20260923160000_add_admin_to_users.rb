class AddAdminToUsers < ActiveRecord::Migration[8.1]
  def change
    # 招待コードを発行できる管理者
    add_column :users, :admin, :boolean, default: false, null: false
  end
end
