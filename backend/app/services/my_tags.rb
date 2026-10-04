# 自分の本のタグの一覧・名前の変更・まとめる・外す（アカウント画面の「タグ」。/api/tags）。
# tags は名前だけを持ち全ユーザーで共有しているので、タグの名前は書き換えず、
# **自分の本のつながり（book_tags）だけを付け替える・消す**（他人の本の同じタグは変わらない）。
class MyTags
  NAME_MAX_LENGTH = 255

  # ok: 成功したか / errors: 失敗の理由 / count: 付け替えた（外した）冊数 / merged: 既にある名前にまとめたか
  Result = Struct.new(:ok, :errors, :count, :merged, keyword_init: true)

  def initialize(user)
    @user = user
  end

  # [{ name:, count: }]（自分の本に付いているタグと冊数。冊数の多い順→名前順）
  def list
    my_links.joins(:tag).group("tags.name").count
      .map { |name, count| { name: name, count: count } }
      .sort_by { |tag| [ -tag[:count], tag[:name] ] }
  end

  # 自分の本の from を to に付け替える。to が既にある名前なら 1 つにまとめる（両方付いた本は from を外すだけ）
  def rename(from, to)
    from_tag = find_my_tag(from)
    return failure("not_found", name: Tag.normalize_name(from)) unless from_tag

    to = Tag.normalize_name(to)
    return failure("new_name_blank") if to.empty?
    return failure("new_name_too_long", count: NAME_MAX_LENGTH) if to.length > NAME_MAX_LENGTH

    to_tag = Tag.find_by(name: to)
    # DB の照合順序（utf8mb4_0900_ai_ci）は大文字・小文字、ひらがな・カタカナ、濁点の違いを同じ名前とみなすので、
    # 書き方だけの変更（it → IT）は同じタグになる。そのときはタグの名前そのものを書き換える（管理者だけ）
    return change_spelling(from_tag, to) if to_tag&.id == from_tag.id

    merged = to_tag.present? && my_links.exists?(tag_id: to_tag.id)
    book_ids = []
    Tag.transaction do
      to_tag ||= Tag.create!(name: to)
      book_ids = my_links.where(tag_id: from_tag.id).pluck(:book_id)
      already = BookTag.where(book_id: book_ids, tag_id: to_tag.id).pluck(:book_id)
      BookTag.where(book_id: already, tag_id: from_tag.id).delete_all
      BookTag.where(book_id: book_ids - already, tag_id: from_tag.id).update_all(tag_id: to_tag.id, updated_at: Time.current)
      clean_up(from_tag)
    end
    Result.new(ok: true, errors: [], count: book_ids.size, merged: merged)
  end

  # 自分の本から name のタグを外す
  def remove(name)
    tag = find_my_tag(name)
    return failure("not_found", name: Tag.normalize_name(name)) unless tag

    count = 0
    Tag.transaction do
      count = my_links.where(tag_id: tag.id).delete_all
      clean_up(tag)
    end
    Result.new(ok: true, errors: [], count: count, merged: false)
  end

  private

  # 書き方だけの変更（it → IT など）。タグは全ユーザーで共有なので、名前を書き換えると同じタグを付けているすべての本の表示が変わる。
  # そのため管理者だけに許す（2026-10-04、ユーザーと相談して決定）
  def change_spelling(tag, to)
    return failure("same_name") if tag.name == to
    return failure("spelling_admin_only") unless @user.admin?

    tag.update!(name: to)
    Result.new(ok: true, errors: [], count: my_links.where(tag_id: tag.id).count, merged: false)
  end

  def my_links
    BookTag.joins(:book).where(books: { user_id: @user.id })
  end

  def find_my_tag(name)
    tag = Tag.find_by(name: name) # Tag の normalizes で書き方をそろえて探す
    tag if tag && my_links.exists?(tag_id: tag.id)
  end

  # 誰の本にも付いていないタグは消す（他人が使っていれば残す）。自分の本で使われなくなった「隠した候補」も消す
  def clean_up(tag)
    tag.destroy! unless BookTag.exists?(tag_id: tag.id)
    @user.forget_hidden_tags_no_longer_used([ tag.name ])
  end

  def failure(key, **options)
    Result.new(ok: false, errors: [ I18n.t("api.errors.tags.#{key}", **options) ], count: 0, merged: false)
  end
end
