module Api
  # 再設定リンクからのパスワード再設定
  class PasswordResetsController < ApplicationController
    include PasswordValidation

    allow_unauthenticated_access only: :update
    limit_attempts to: 10, within: 3.minutes, only: :update

    # PATCH /api/password_reset
    # 成功するとそのユーザーの全セッションを失効させ、この端末でログイン状態にする
    def update
      # 無効・期限切れ・使用済み（パスワード変更済み）は区別しない
      user = User.find_by_password_reset_token(params[:token].to_s)
      return render_errors(["再設定リンクが無効か、期限切れです"]) unless user

      password = params[:password].to_s
      error = password_error(password, params[:password_confirmation].to_s, label: "新しいパスワード")
      return render_errors([error]) if error

      if user.update(password: password)
        user.sessions.destroy_all
        start_new_session_for(user)
        render json: user_json(user)
      else
        render_errors(user.errors.full_messages)
      end
    end

    private

    def render_errors(messages)
      render json: { errors: messages }, status: :unprocessable_content
    end
  end
end
