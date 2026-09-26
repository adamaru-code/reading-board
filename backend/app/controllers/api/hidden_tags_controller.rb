module Api
  # タグ候補から隠したタグ（ログイン中のユーザーのもののみ）
  class HiddenTagsController < ApplicationController
    # GET /api/hidden_tags （名前順）
    def index
      render json: current_user.hidden_tags.order(:name).map { |tag| hidden_tag_json(tag) }
    end

    # POST /api/hidden_tags { name }
    # 既に隠していればそのまま返す（何度押しても同じ結果）
    def create
      tag = current_user.hidden_tags.find_or_initialize_by(name: params[:name].to_s.strip)
      status = tag.new_record? ? :created : :ok
      if tag.save
        render json: hidden_tag_json(tag), status: status
      else
        render json: { errors: [ "タグ名を入力してください" ] }, status: :unprocessable_content
      end
    end

    # DELETE /api/hidden_tags/:id （候補に戻す）
    def destroy
      tag = current_user.hidden_tags.find_by(id: params[:id])
      return render json: { errors: [ "隠したタグが見つかりません" ] }, status: :not_found unless tag

      tag.destroy
      head :no_content
    end

    private

    def hidden_tag_json(tag)
      { id: tag.id, name: tag.name }
    end
  end
end
