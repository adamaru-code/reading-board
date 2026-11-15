require "test_helper"
# Net::HTTP を差し替えるテストがあるため、OpenbdClient より先に読み込んでおく（並列実行でプロセスによっては未読み込みになる）
require "net/http"

class OpenbdClientTest < ActiveSupport::TestCase
  test "normalize はハイフン・空白を除去し大文字化する" do
    assert_equal "9784873115658", OpenbdClient.normalize("978-4-87311-565-8")
    assert_equal "080442957X", OpenbdClient.normalize("0-8044-2957-x")
  end

  test "normalize は全角の数字・ハイフン・X を半角にそろえる（消さない）" do
    assert_equal "9784873115658", OpenbdClient.normalize("９７８－４－８７３１１－５６５－８")
    assert_equal "080442957X", OpenbdClient.normalize("０８０４４２９５７ｘ")
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

  # 200 の応答（本文つき）を作る。差し替えた処理の中では補助メソッドを呼べないので、先に作ってローカル変数で渡す
  def ok_response(body)
    response = Net::HTTPOK.new("1.1", "200", "OK")
    json = body.is_a?(String) ? body : body.to_json
    response.define_singleton_method(:body) { json }
    response
  end

  test "lookup は見つかったら :found と題名・著者を返し、ISBN で問い合わせる" do
    requested = nil
    # openBD の本物の返事の形（2026-11-15 に確認）：[{ "onix": …, "hanmoto": …, "summary": { … } }]
    response = ok_response([ { summary: { isbn: "9784873115658", title: "リーダブルコード", author: "Boswell,Dustin" } } ])
    replacement = lambda do |*_args, **_options, &block|
      http = Object.new
      http.define_singleton_method(:get) { |path| requested = path; nil }
      block.call(http)
      response
    end
    with_http_start(replacement) do
      result = OpenbdClient.lookup("9784873115658")
      assert_equal :found, result.status
      assert_equal({ title: "リーダブルコード", author: "Boswell,Dustin" }, result.info)
    end
    assert_equal "/v1/get?isbn=9784873115658", requested
  end

  test "lookup は著者が空なら著者を nil にする" do
    response = ok_response([ { summary: { title: "表現者クライテリオン", author: "" } } ])
    with_http_start(->(*_args, **_options, &_block) { response }) do
      assert_equal({ title: "表現者クライテリオン", author: nil }, OpenbdClient.lookup("4910000000000").info)
    end
  end

  test "lookup は openBD に無い（[null]）・題名が空なら :not_found" do
    # 無い ISBN のときの openBD の本物の返事は [null]（2026-11-15 に確認）
    missing = ok_response("[null]")
    no_title = ok_response([ { summary: { title: "", author: "x" } } ])
    with_http_start(->(*_args, **_options, &_block) { missing }) do
      assert_equal OpenbdClient::Result.new(:not_found, nil), OpenbdClient.lookup("9784000000000")
    end
    with_http_start(->(*_args, **_options, &_block) { no_title }) do
      assert_equal :not_found, OpenbdClient.lookup("9784000000000").status
    end
  end

  test "lookup はエラーの応答・壊れた JSON なら :error（例外にしない）" do
    server_error = Net::HTTPInternalServerError.new("1.1", "500", "Internal Server Error")
    broken = ok_response("<html>メンテナンス中</html>")
    with_http_start(->(*_args, **_options, &_block) { server_error }) do
      assert_equal OpenbdClient::Result.new(:error, nil), OpenbdClient.lookup("9784873115658")
    end
    with_http_start(->(*_args, **_options, &_block) { broken }) do
      assert_equal :error, OpenbdClient.lookup("9784873115658").status
    end
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
