class AddUserToBooks < ActiveRecord::Migration[8.1]
  def change
    # 既存行があるため一旦 null 許可で追加（backfill は seeds / 運用で実施）
    add_reference :books, :user, null: true, foreign_key: true
  end
end
