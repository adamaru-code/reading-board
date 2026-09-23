module Api
  class PasswordsController < ApplicationController
    include PasswordValidation

    # PATCH /api/password
    # 成功すると他端末のセッションを失効させ、操作中のセッションは維持する
    def update
      password = params[:password].to_s

      error =
        if current_user.authenticate(params[:current_password].to_s)
          password_error(password, params[:password_confirmation].to_s, label: "新しいパスワード")
        else
          "現在のパスワードが違います"
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
