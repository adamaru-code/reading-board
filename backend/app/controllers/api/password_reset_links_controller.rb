module Api
  # パスワード再設定リンクの発行（管理者のみ）。トークンは返すだけで保存しない
  class PasswordResetLinksController < ApplicationController
    before_action :require_admin

    # POST /api/users/:user_id/password_reset_link
    def create
      user = User.find_by(id: params[:user_id])
      return render json: { errors: ["ユーザーが見つかりません"] }, status: :not_found unless user

      render json: {
        token: user.password_reset_token,
        expires_at: User::PASSWORD_RESET_VALID_FOR.from_now
      }, status: :created
    end
  end
end
