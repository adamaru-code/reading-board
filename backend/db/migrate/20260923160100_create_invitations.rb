class CreateInvitations < ActiveRecord::Migration[8.1]
  def change
    create_table :invitations do |t|
      t.string :code, null: false
      t.references :inviter, null: false, foreign_key: { to_table: :users }
      t.references :used_by, foreign_key: { to_table: :users }
      t.datetime :used_at
      t.datetime :expires_at, null: false
      t.timestamps
    end
    add_index :invitations, :code, unique: true
  end
end
