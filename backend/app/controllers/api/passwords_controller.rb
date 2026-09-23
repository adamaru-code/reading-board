module Api
  class PasswordsController < ApplicationController
    # PATCH /api/password
    # 成功すると他端末のセッションを失効させ、操作中のセッションは維持する
    def update
      password = params[:password].to_s

      error =
        if !current_user.authenticate(params[:current_password].to_s)
          "現在のパスワードが違います"
        elsif password.length < User::PASSWORD_MIN_LENGTH
          "新しいパスワードは #{User::PASSWORD_MIN_LENGTH} 文字以上にしてください"
        elsif password != params[:password_confirmation].to_s
          "新しいパスワード（確認）が一致しません"
        end
      return render_errors([error]) if error

      if current_user.update(password: password)
        current_user.sessions.where.not(id: current_session.id).destroy_all
        head :no_content
      else
        render_errors(current_user.errors.full_messages)
      end
    end

    private

    def render_errors(messages)
      render json: { errors: messages }, status: :unprocessable_content
    end
  end
end
