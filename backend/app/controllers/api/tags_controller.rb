module Api
  # 自分の本のタグ（アカウント画面の「タグ」）。tags は全ユーザーで共有なので、自分の本のつながりだけを変える（MyTags）
  class TagsController < ApplicationController
    # GET /api/tags （自分の本のタグと冊数。冊数の多い順）
    def index
      render json: MyTags.new(current_user).list
    end

    # PATCH /api/tags/rename { from, to } （名前を変える。既にある名前なら 1 つにまとめる）
    def rename
      # to は空でも受け取り、MyTags が「新しい名前を入力してください」で断る（require だと 400 になる）
      render_result MyTags.new(current_user).rename(params.require(:from), params[:to])
    end

    # DELETE /api/tags/remove?name= （自分のすべての本から外す）
    def remove
      render_result MyTags.new(current_user).remove(params.require(:name))
    end

    private

    def render_result(result)
      return render json: { errors: result.errors }, status: :unprocessable_content unless result.ok

      render json: { count: result.count, merged: result.merged }
    end
  end
end
