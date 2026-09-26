require "test_helper"

class OpenbdClientTest < ActiveSupport::TestCase
  test "normalize はハイフン・空白を除去し大文字化する" do
    assert_equal "9784873115658", OpenbdClient.normalize("978-4-87311-565-8")
    assert_equal "080442957X", OpenbdClient.normalize("0-8044-2957-x")
  end

  test "valid? は 13 桁 / 10 桁(末尾X可) を許容し、それ以外を弾く" do
    assert OpenbdClient.valid?("9784873115658") # ISBN-13
    assert OpenbdClient.valid?("4873115655")    # ISBN-10
    assert OpenbdClient.valid?("080442957X")    # ISBN-10（末尾 X）
    assert_not OpenbdClient.valid?("123")
    assert_not OpenbdClient.valid?("97848731156580") # 14 桁
  end

  test "media_type_for は 491 始まりを magazine、それ以外を book" do
    assert_equal "magazine", OpenbdClient.media_type_for("4910000000000")
    assert_equal "book", OpenbdClient.media_type_for("9784873115658")
    assert_equal "book", OpenbdClient.media_type_for("4873115655")
  end

  # Net::HTTP.start を一時的に差し替える（minitest 6 には stub が無いため）
  def with_http_start(replacement)
    original = Net::HTTP.method(:start)
    Net::HTTP.define_singleton_method(:start, replacement)
    yield
  ensure
    Net::HTTP.define_singleton_method(:start, original)
  end

  test "fetch は接続・読み取りのタイムアウトを指定し、タイムアウトしたら nil を返す" do
    received = nil
    with_http_start(->(*_args, **options, &_block) { received = options; raise Net::ReadTimeout }) do
      assert_nil OpenbdClient.fetch("9784873115658")
    end
    assert_equal OpenbdClient::OPEN_TIMEOUT, received[:open_timeout]
    assert_equal OpenbdClient::READ_TIMEOUT, received[:read_timeout]
  end
end
