# パスワード設定時の入力チェック（登録・パスワード変更で共通）。メッセージは config/locales/ja.yml
module PasswordValidation
  private

  # 不備があればメッセージ、無ければ nil
  def password_error(password, confirmation, label:)
    if password.length < User::PASSWORD_MIN_LENGTH
      I18n.t("api.errors.password_too_short", label: label, count: User::PASSWORD_MIN_LENGTH)
    elsif password != confirmation
      I18n.t("api.errors.password_mismatch", label: label)
    end
  end
end
