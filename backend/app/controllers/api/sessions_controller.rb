module Api
  class SessionsController < ApplicationController
    # ログインは未認証で叩けるようにする
    allow_unauthenticated_access only: :create
    limit_attempts to: 10, within: 3.minutes, only: :create

    # GET /api/session （ログイン中のユーザーを返す。未認証は 401）
    def show
      render json: user_json(current_user)
    end

    # POST /api/session
    def create
      user = User.find_by(email: params[:email].to_s.strip.downcase)
      if user&.authenticate(params[:password])
        start_new_session_for(user)
        render json: user_json(user)
      else
        render json: { errors: ["メールアドレスまたはパスワードが違います"] }, status: :unauthorized
      end
    end

    # DELETE /api/session
    def destroy
      terminate_session
      head :no_content
    end
  end
end
