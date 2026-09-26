class RenameTagKenkouhouToKenkou < ActiveRecord::Migration[8.1]
  OLD_NAME = "健康法".freeze
  NEW_NAME = "健康".freeze

  # 本に付いている「健康法」タグを「健康」に付け替える（データのみ。テーブル構造は変えない）
  def up
    old_id = select_value("SELECT id FROM tags WHERE name = #{quote(OLD_NAME)}")
    return unless old_id

    new_id = select_value("SELECT id FROM tags WHERE name = #{quote(NEW_NAME)}")
    if new_id.nil?
      # 「健康」タグがまだ無ければ、名前を書き換えるだけで済む
      execute("UPDATE tags SET name = #{quote(NEW_NAME)}, updated_at = NOW() WHERE id = #{old_id.to_i}")
      return
    end

    # 「健康」も付いている本は、重複しないよう「健康法」側のつながりを消す
    execute(<<~SQL)
      DELETE bt_old FROM book_tags bt_old
      JOIN book_tags bt_new ON bt_new.book_id = bt_old.book_id AND bt_new.tag_id = #{new_id.to_i}
      WHERE bt_old.tag_id = #{old_id.to_i}
    SQL
    # 残りの本は「健康」に付け替え、使われなくなった「健康法」タグを消す
    execute("UPDATE book_tags SET tag_id = #{new_id.to_i}, updated_at = NOW() WHERE tag_id = #{old_id.to_i}")
    execute("DELETE FROM tags WHERE id = #{old_id.to_i}")
  end

  # 付け替えた後は、元が「健康法」だった本を見分けられないため戻せない
  def down
    raise ActiveRecord::IrreversibleMigration
  end
end
