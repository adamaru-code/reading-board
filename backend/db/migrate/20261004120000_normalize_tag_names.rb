class NormalizeTagNames < ActiveRecord::Migration[8.1]
  # 今あるタグ名・隠した候補の名前を、Tag.normalize_name と同じ書き方（NFKC＋前後の空白を除く）にそろえる（データのみ）。
  # そろえた名前が DB では別のタグと同じ名前になる場合は、そのタグにまとめる（本のつながりを付け替え、両方付いた本は重複を消す）
  def up
    select_rows("SELECT id, name FROM tags").each do |id, name|
      normalized = normalize(name)
      next if normalized == name

      other_id = select_value("SELECT id FROM tags WHERE name = #{quote(normalized)} AND id <> #{id.to_i}")
      if other_id
        merge_tag(from_id: id.to_i, to_id: other_id.to_i)
      else
        execute("UPDATE tags SET name = #{quote(normalized)}, updated_at = NOW() WHERE id = #{id.to_i}")
      end
    end

    select_rows("SELECT id, user_id, name FROM hidden_tags").each do |id, user_id, name|
      normalized = normalize(name)
      next if normalized == name

      duplicate = select_value("SELECT id FROM hidden_tags WHERE user_id = #{user_id.to_i} AND name = #{quote(normalized)} AND id <> #{id.to_i}")
      if duplicate
        execute("DELETE FROM hidden_tags WHERE id = #{id.to_i}")
      else
        execute("UPDATE hidden_tags SET name = #{quote(normalized)}, updated_at = NOW() WHERE id = #{id.to_i}")
      end
    end
  end

  # そろえた後は元の書き方を見分けられないため戻せない
  def down
    raise ActiveRecord::IrreversibleMigration
  end

  private

  # Tag.normalize_name と同じ（マイグレーションはモデルの変更に影響されないよう、ここに書く）
  def normalize(name)
    name.to_s.unicode_normalize(:nfkc).strip
  end

  def merge_tag(from_id:, to_id:)
    execute(<<~SQL)
      DELETE bt_from FROM book_tags bt_from
      JOIN book_tags bt_to ON bt_to.book_id = bt_from.book_id AND bt_to.tag_id = #{to_id}
      WHERE bt_from.tag_id = #{from_id}
    SQL
    execute("UPDATE book_tags SET tag_id = #{to_id}, updated_at = NOW() WHERE tag_id = #{from_id}")
    execute("DELETE FROM tags WHERE id = #{from_id}")
  end
end
