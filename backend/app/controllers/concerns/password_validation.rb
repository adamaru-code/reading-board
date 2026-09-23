# パスワード設定時の入力チェック（登録・パスワード変更で共通）。日本語メッセージを返す
module PasswordValidation
  private

  # 不備があればメッセージ、無ければ nil
  def password_error(password, confirmation, label:)
    if password.length < User::PASSWORD_MIN_LENGTH
      "#{label}は #{User::PASSWORD_MIN_LENGTH} 文字以上にしてください"
    elsif password != confirmation
      "#{label}（確認）が一致しません"
    end
  end
end
