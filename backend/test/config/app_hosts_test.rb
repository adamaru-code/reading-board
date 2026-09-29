require "test_helper"
require Rails.root.join("config/app_hosts")

# 本番の config.hosts（config/environments/production.rb）で使う、許可する宛先名の読み取りと、
# その設定での確認の動き（Rails 標準の ActionDispatch::HostAuthorization）
class AppHostsTest < ActiveSupport::TestCase
  test "カンマ区切りを配列にし、前後の空白と空の項目を除く" do
    assert_equal %w[ec2-1-2-3-4.ap-northeast-1.compute.amazonaws.com example.com],
      AppHosts.parse(" ec2-1-2-3-4.ap-northeast-1.compute.amazonaws.com , ,example.com ")
  end

  test "空・未設定なら例外（空のままだと全部許可になるため）" do
    assert_raises(ArgumentError) { AppHosts.parse(nil) }
    assert_raises(ArgumentError) { AppHosts.parse("") }
    assert_raises(ArgumentError) { AppHosts.parse(" , ") }
  end

  test "許可した宛先名は通し、違う宛先名は 403、/up は宛先名を問わず通す" do
    app = ->(_env) { [ 200, {}, [ "ok" ] ] }
    host = "ec2-1-2-3-4.ap-northeast-1.compute.amazonaws.com"
    # production.rb と同じ設定
    guard = ActionDispatch::HostAuthorization.new(
      app, AppHosts.parse(host), exclude: ->(request) { request.path == "/up" }
    )
    # 本物のリクエストと同じく Host ヘッダを付ける（MockRequest は付けないため）
    status = lambda do |url|
      guard.call(Rack::MockRequest.env_for(url, "HTTP_HOST" => URI(url).host)).first
    end

    assert_equal 200, status.call("http://#{host}/api/session")
    assert_equal 403, status.call("http://evil.example.com/api/session")
    assert_equal 200, status.call("http://evil.example.com/up")
  end
end
