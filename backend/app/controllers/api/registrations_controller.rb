module Api
  # 招待コードによるアカウント登録
  class RegistrationsController < ApplicationController
    include PasswordValidation

    allow_unauthenticated_access only: :create

    # POST /api/registration
    # 招待コードが使えればユーザーを作り、招待を使用済みにしてログイン状態にする
    def create
      password = params[:password].to_s
      error = password_error(password, params[:password_confirmation].to_s, label: "パスワード")
      return render_errors([error]) if error

      user = User.new(email: params[:email].to_s, password: password)
      result = Invitation.transaction do
        # 同じコードの同時使用を防ぐため行ロックを取る
        invitation = Invitation.usable.lock.find_by(code: params[:invitation_code].to_s.strip)
        next :invalid_invitation unless invitation
        next :invalid_user unless user.save

        invitation.redeem!(user)
        :ok
      end

      case result
      when :ok
        start_new_session_for(user)
        render json: user_json(user), status: :created
      when :invalid_invitation
        # 存在しない・使用済み・期限切れは区別しない
        render_errors(["招待コードが無効です"])
      else
        render_errors(user_error_messages(user))
      end
    end

    private

    def user_error_messages(user)
      if user.errors.of_kind?(:email, :taken)
        ["このメールアドレスは登録済みです"]
      elsif user.errors.include?(:email)
        ["メールアドレスの形式が正しくありません"]
      else
        user.errors.full_messages
      end
    end

    def render_errors(messages)
      render json: { errors: messages }, status: :unprocessable_content
    end
  end
end
