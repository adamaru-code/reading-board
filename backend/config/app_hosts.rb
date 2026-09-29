# 本番で許可する宛先名（Host ヘッダ）を環境変数から読む。config/environments/production.rb が使う。
# （Rails が自動で読み込む lib/ ではなく config/ に置く：環境設定の中から require するため）
module AppHosts
  # "a.example.com, b.example.com" → ["a.example.com", "b.example.com"]
  # 空なら例外にする：config.hosts が空だと Rails は確認をしない（すべて許可）ので、設定漏れを起動時に気づけるように
  def self.parse(value)
    hosts = value.to_s.split(",").map(&:strip).reject(&:empty?)
    raise ArgumentError, "APP_HOSTS（許可する宛先名）が設定されていません" if hosts.empty?

    hosts
  end
end
