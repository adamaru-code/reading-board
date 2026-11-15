ENV["RAILS_ENV"] ||= "test"

# テストのカバレッジ（どの行・分かれ道が動いたか）。COVERAGE=1 bin/rails test のときだけ測り、coverage/index.html に出す。
# アプリのコードを読み込む前に始める必要がある。テストは並列（fork した worker）で動くので、worker の結果もまとめる
if ENV["COVERAGE"]
  require "simplecov"
  SimpleCov.start "rails" do
    enable_coverage :branch
    enable_for_subprocesses true
  end
end

require_relative "../config/environment"
require "rails/test_help"

module ActiveSupport
  class TestCase
    # Run tests in parallel with specified workers
    parallelize(workers: :number_of_processors)

    # Setup all fixtures in test/fixtures/*.yml for all tests in alphabetical order.
    fixtures :all

    # Add more helper methods to be used by all tests here...
  end
end

module ActionDispatch
  class IntegrationTest
    # 回数制限の記録をテストごとにリセットする（同一プロセス内でテスト間に持ち越さない）
    setup { RATE_LIMIT_STORE.clear }
  end
end
