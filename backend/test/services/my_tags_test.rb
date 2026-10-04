require "test_helper"

class MyTagsTest < ActiveSupport::TestCase
  setup do
    @me = users(:owner)
    @other = users(:other)
  end

  def tags_of(book)
    book.reload.tags.map(&:name).sort
  end

  test "list は自分の本のタグと冊数を、冊数の多い順→名前順で返す（他人の本は数えない）" do
    @me.books.create!(title: "1", tag_names: %w[名著 歴史])
    @me.books.create!(title: "2", tag_names: %w[名著])
    @other.books.create!(title: "他人", tag_names: %w[名著 宗教])
    assert_equal [ { name: "名著", count: 2 }, { name: "歴史", count: 1 } ], MyTags.new(@me).list
  end

  test "rename は自分の本だけ付け替え、他人の本の同じタグは変わらない" do
    mine = @me.books.create!(title: "自分", tag_names: %w[名著])
    theirs = @other.books.create!(title: "他人", tag_names: %w[名著])

    result = MyTags.new(@me).rename("名著", "おすすめ")
    assert result.ok
    assert_equal 1, result.count
    assert_not result.merged
    assert_equal %w[おすすめ], tags_of(mine)
    assert_equal %w[名著], tags_of(theirs) # 他人の本はそのまま
    assert Tag.exists?(name: "名著") # 他人が使っているので消さない
  end

  test "rename で既にある名前にすると 1 つにまとめ、両方付いた本は重ならない" do
    a = @me.books.create!(title: "A", tag_names: %w[健康法])
    b = @me.books.create!(title: "B", tag_names: %w[健康法 健康])
    @me.books.create!(title: "C", tag_names: %w[健康])

    result = MyTags.new(@me).rename("健康法", "健康")
    assert result.ok
    assert result.merged
    assert_equal 2, result.count
    assert_equal %w[健康], tags_of(a)
    assert_equal %w[健康], tags_of(b)
    assert_equal [ { name: "健康", count: 3 } ], MyTags.new(@me).list
    assert_not Tag.exists?(name: "健康法") # 誰も使わなくなったので消す
  end

  test "rename は自分の本に無い名前・空・同じ名前（大文字小文字の違いも）・長すぎる名前を断る" do
    @me.books.create!(title: "A", tag_names: %w[Ruby])
    @other.books.create!(title: "他人", tag_names: %w[他人のタグ])
    tags = MyTags.new(@me)
    assert_equal [ "「他人のタグ」のタグが付いた本がありません" ], tags.rename("他人のタグ", "x").errors
    assert_equal [ "新しい名前を入力してください" ], tags.rename("Ruby", "  ").errors
    assert_match(/今と同じ名前です/, tags.rename("Ruby", "Ruby").errors.first)
    assert_match(/今と同じ名前です/, tags.rename("Ruby", "ruby").errors.first)
    @me.books.create!(title: "B", tag_names: %w[はな])
    assert_match(/今と同じ名前です/, tags.rename("はな", "ハナ").errors.first) # かなの違いも同じ名前
    assert_match(/255 文字以内/, tags.rename("Ruby", "あ" * 256).errors.first)
    assert_equal %w[Ruby はな], MyTags.new(@me).list.map { |t| t[:name] } # どれも変わっていない
  end

  test "remove は自分の本からだけ外し、他人の本の同じタグは残す" do
    mine = @me.books.create!(title: "自分", tag_names: %w[名著 歴史])
    theirs = @other.books.create!(title: "他人", tag_names: %w[名著])

    result = MyTags.new(@me).remove("名著")
    assert result.ok
    assert_equal 1, result.count
    assert_equal %w[歴史], tags_of(mine)
    assert_equal %w[名著], tags_of(theirs)
  end

  test "付け替え・外したあと、自分の本で使われなくなった「隠した候補」は消し、ほかの人の隠した候補は残す" do
    @me.books.create!(title: "A", tag_names: %w[積読])
    @me.hidden_tags.create!(name: "積読")
    @other.hidden_tags.create!(name: "積読")

    MyTags.new(@me).rename("積読", "未読")
    assert_not @me.hidden_tags.exists?(name: "積読")
    assert @other.hidden_tags.exists?(name: "積読")
  end
end
