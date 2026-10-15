require "test_helper"
# Net::HTTP を差し替えるテストがあるため先に読み込む（openbd_client_test と同じ理由）
require "net/http"

class GoogleBooksClientTest < ActiveSupport::TestCase
  # Net::HTTP.start を一時的に差し替える（minitest 6 には stub が無いため）。
  # 差し替えた処理は Net::HTTP の中で動く（self が変わる）ので、この中からテストの補助メソッドは呼べない。
  # 応答は先に作ってローカル変数で渡す
  def with_http_start(replacement)
    original = Net::HTTP.method(:start)
    Net::HTTP.define_singleton_method(:start, replacement)
    yield
  ensure
    Net::HTTP.define_singleton_method(:start, original)
  end

  # 200 の応答（本文つき）を作る
  def ok_response(body)
    response = Net::HTTPOK.new("1.1", "200", "OK")
    json = body.to_json
    response.define_singleton_method(:body) { json }
    response
  end

  def volume_with_thumbnail(url)
    { items: [ { volumeInfo: { title: "リーダブルコード", imageLinks: { thumbnail: url } } } ] }
  end

  test "鍵が無ければ通信せずに nil" do
    called = false
    with_http_start(->(*_args, **_options, &_block) { called = true }) do
      assert_nil GoogleBooksClient.cover_url("9784873115658", api_key: nil)
      assert_nil GoogleBooksClient.cover_url("9784873115658", api_key: "")
    end
    assert_not called
  end

  test "表紙があれば https の URL を返す（http で返っても https にそろえる）" do
    requested = nil
    thumbnail = "http://books.google.com/books/content?id=abc&printsec=frontcover&img=1&zoom=1"
    response = ok_response(volume_with_thumbnail(thumbnail))
    replacement = lambda do |*_args, **_options, &block|
      http = Object.new
      http.define_singleton_method(:get) { |path| requested = path; nil }
      block.call(http)
      response
    end
    with_http_start(replacement) do
      assert_equal "https://books.google.com/books/content?id=abc&printsec=frontcover&img=1&zoom=1",
        GoogleBooksClient.cover_url("9784873115658", api_key: "test-key")
    end
    assert_includes requested, "q=isbn%3A9784873115658"
    assert_includes requested, "key=test-key"
  end

  test "該当なし・画像なしなら nil" do
    not_found = ok_response({ totalItems: 0 })
    no_image = ok_response({ items: [ { volumeInfo: { title: "x" } } ] })
    with_http_start(->(*_args, **_options, &_block) { not_found }) do
      assert_nil GoogleBooksClient.cover_url("9784101010014", api_key: "test-key")
    end
    with_http_start(->(*_args, **_options, &_block) { no_image }) do
      assert_nil GoogleBooksClient.cover_url("9784101010014", api_key: "test-key")
    end
  end

  test "タイムアウトを指定し、失敗したら nil（例外にしない）" do
    received = nil
    with_http_start(->(*_args, **options, &_block) { received = options; raise Net::ReadTimeout }) do
      assert_nil GoogleBooksClient.cover_url("9784873115658", api_key: "test-key")
    end
    assert_equal GoogleBooksClient::OPEN_TIMEOUT, received[:open_timeout]
    assert_equal GoogleBooksClient::READ_TIMEOUT, received[:read_timeout]
  end

  test "エラー応答（鍵が違う・回数の上限など）なら nil" do
    forbidden = Net::HTTPForbidden.new("1.1", "403", "Forbidden")
    with_http_start(->(*_args, **_options, &_block) { forbidden }) do
      assert_nil GoogleBooksClient.cover_url("9784873115658", api_key: "wrong-key")
    end
  end

  # 本文つきのエラー応答を作る（上限の理由・文を読むため）
  def error_response(klass, code, reason = nil, message = nil)
    response = klass.new("1.1", code, "Error")
    json = reason ? { error: { message: message, errors: [ { reason: reason } ] } }.to_json : ""
    response.define_singleton_method(:body) { json }
    response
  end

  test "lookup は見つからなかった理由を返す（見つかった・該当なし・鍵なし）" do
    found = ok_response(volume_with_thumbnail("https://books.google.com/books/content?id=abc"))
    with_http_start(->(*_args, **_options, &_block) { found }) do
      result = GoogleBooksClient.lookup("9784873115658", api_key: "test-key")
      assert_equal :found, result.status
      assert_equal "https://books.google.com/books/content?id=abc", result.url
    end
    not_found = ok_response({ totalItems: 0 })
    with_http_start(->(*_args, **_options, &_block) { not_found }) do
      assert_equal :not_found, GoogleBooksClient.lookup("9784101010014", api_key: "test-key").status
    end
    assert_equal :no_key, GoogleBooksClient.lookup("9784873115658", api_key: nil).status
  end

  test "lookup は 1 日の上限を :limited、1 分の上限を :rate_limited にする（どちらも 429 で返ることがある）" do
    per_day = "Quota exceeded for quota metric 'Queries' and limit 'Queries per day' of service 'books.googleapis.com'"
    per_minute = "Quota exceeded for quota metric 'Queries' and limit 'Queries per minute per user' of service 'books.googleapis.com'"
    {
      error_response(Net::HTTPTooManyRequests, "429", "rateLimitExceeded", per_day) => :limited,
      error_response(Net::HTTPForbidden, "403", "dailyLimitExceeded") => :limited,
      error_response(Net::HTTPTooManyRequests, "429", "rateLimitExceeded", per_minute) => :rate_limited,
      error_response(Net::HTTPForbidden, "403", "userRateLimitExceeded") => :rate_limited,
      error_response(Net::HTTPTooManyRequests, "429") => :rate_limited # 本文が無ければ、待てば続けられる方として扱う
    }.each do |response, expected|
      with_http_start(->(*_args, **_options, &_block) { response }) do
        assert_equal expected, GoogleBooksClient.lookup("9784873115658", api_key: "test-key").status, response.body
      end
    end
  end

  test "lookup は鍵の間違いの 403・本文の無い 403・タイムアウトを :error にする" do
    [
      error_response(Net::HTTPForbidden, "403", "keyInvalid"),
      error_response(Net::HTTPForbidden, "403")
    ].each do |response|
      with_http_start(->(*_args, **_options, &_block) { response }) do
        assert_equal :error, GoogleBooksClient.lookup("9784873115658", api_key: "test-key").status
      end
    end
    with_http_start(->(*_args, **_options, &_block) { raise Net::ReadTimeout }) do
      assert_equal :error, GoogleBooksClient.lookup("9784873115658", api_key: "test-key").status
    end
  end

  # 問い合わせごとに順に応答を返し、問い合わせた URL を記録する
  def sequence(responses, requested)
    queue = responses.dup
    lambda do |*_args, **_options, &block|
      http = Object.new
      http.define_singleton_method(:get) { |path| requested << path; nil }
      block.call(http)
      queue.shift
    end
  end

  def volume(isbn13, thumbnail)
    { volumeInfo: { industryIdentifiers: [ { type: "ISBN_13", identifier: isbn13 } ], imageLinks: { thumbnail: thumbnail } } }
  end

  test "isbn: で 0 冊なら、題名＋著者で探し、ISBN が一致する本の表紙だけを使う" do
    requested = []
    other = volume("9784000000001", "http://books.google.com/other")
    same = volume("9784873115658", "http://books.google.com/readable")
    responses = [ ok_response({ totalItems: 0 }), ok_response({ items: [ other, same ] }) ]
    result = nil
    with_http_start(sequence(responses, requested)) do
      result = GoogleBooksClient.lookup("9784873115658", title: "リーダブルコード", author: "Dustin Boswell",
                                                          api_key: "test-key", pause: 0)
    end
    assert_equal :found, result.status
    assert_equal "https://books.google.com/readable", result.url
    assert_includes requested[1], "q=%E3%83%AA" # 2 回目は題名で探す（isbn: ではない）
    assert_includes requested[1], "Dustin+Boswell"
    assert_not_includes requested[1], "isbn%3A"
  end

  test "題名で探しても ISBN が一致する本が無ければ :not_found（別の本の表紙は使わない）" do
    other = volume("9784000000001", "http://books.google.com/other")
    responses = [ ok_response({ totalItems: 0 }), ok_response({ items: [ other ] }) ]
    with_http_start(sequence(responses, [])) do
      result = GoogleBooksClient.lookup("9784873115658", title: "リーダブルコード", api_key: "test-key", pause: 0)
      assert_equal :not_found, result.status
      assert_nil result.url
    end
  end

  test "isbn: で見つかれば題名では探さない。題名が無ければ予備の検索はしない" do
    requested = []
    found = ok_response(volume_with_thumbnail("https://books.google.com/books/content?id=abc"))
    with_http_start(sequence([ found ], requested)) do
      GoogleBooksClient.lookup("9784873115658", title: "リーダブルコード", api_key: "test-key", pause: 0)
    end
    assert_equal 1, requested.size

    requested = []
    with_http_start(sequence([ ok_response({ totalItems: 0 }) ], requested)) do
      assert_equal :not_found, GoogleBooksClient.lookup("9784873115658", api_key: "test-key", pause: 0).status
    end
    assert_equal 1, requested.size
  end

  test "予備の検索で上限に当たったら、その理由を返す" do
    per_minute = Net::HTTPTooManyRequests.new("1.1", "429", "Too Many Requests")
    per_minute.define_singleton_method(:body) { "" }
    responses = [ ok_response({ totalItems: 0 }), per_minute ]
    with_http_start(sequence(responses, [])) do
      assert_equal :rate_limited,
        GoogleBooksClient.lookup("9784873115658", title: "リーダブルコード", api_key: "test-key", pause: 0).status
    end
  end
end
