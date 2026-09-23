module Api
  # ユーザー一覧（管理者のみ）
  class UsersController < ApplicationController
    before_action :require_admin

    # GET /api/users （登録順）
    def index
      users = User.order(:created_at, :id)
      render json: users.map { |user| user_json(user).merge(created_at: user.created_at) }
    end
  end
end
