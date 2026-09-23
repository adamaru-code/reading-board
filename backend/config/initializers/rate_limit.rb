# ログイン等の回数制限（AttemptLimiting / rate_limit）の記録先。
# 単一インスタンス前提でプロセス内メモリに置く（test 環境の cache_store は null_store で制限が効かないため明示する）。
# 複数台構成にする場合は solid_cache / Redis などの共有ストアに移す。
RATE_LIMIT_STORE = ActiveSupport::Cache::MemoryStore.new
