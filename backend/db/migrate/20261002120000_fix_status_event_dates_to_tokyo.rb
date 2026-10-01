class FixStatusEventDatesToTokyo < ActiveRecord::Migration[8.1]
  # config.time_zone が UTC だった間、日本時間 0:00〜8:59（UTC 15:00〜23:59）に記録した状態の日付は
  # UTC の日付＝日本時間の前の日になっていた。記録日時（created_at。UTC で保存）から見分けて 1 日進める（データのみ）。
  # 見分け方：created_at の日付（UTC）が occurred_on と同じで、時刻が 15 時以降
  def up
    # 進めると、同じ本・同じ状態の正しい翌日の履歴と重なる（UNIQUE に当たる）ものは、同じ日の記録なので消す
    execute(<<~SQL)
      DELETE e FROM book_status_events e
      JOIN book_status_events n
        ON n.book_id = e.book_id AND n.status = e.status AND n.occurred_on = e.occurred_on + INTERVAL 1 DAY
      WHERE DATE(e.created_at) = e.occurred_on AND HOUR(e.created_at) >= 15
        AND NOT (DATE(n.created_at) = n.occurred_on AND HOUR(n.created_at) >= 15)
    SQL
    # 残りを 1 日進める。新しい日付から順に進め、連日の対象どうしが途中で重ならないようにする
    execute(<<~SQL)
      UPDATE book_status_events SET occurred_on = occurred_on + INTERVAL 1 DAY
      WHERE DATE(created_at) = occurred_on AND HOUR(created_at) >= 15
      ORDER BY occurred_on DESC
    SQL
  end

  # 進めた後は、元がずれていた履歴を見分けられないため戻せない
  def down
    raise ActiveRecord::IrreversibleMigration
  end
end
