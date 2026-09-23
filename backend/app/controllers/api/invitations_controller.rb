module Api
  # 招待コードの発行・一覧・削除（管理者のみ）
  class InvitationsController < ApplicationController
    before_action :require_admin

    # GET /api/invitations （自分が発行した招待。新しい順）
    def index
      invitations = current_user.issued_invitations.includes(:used_by).order(created_at: :desc, id: :desc)
      render json: invitations.map { |invitation| invitation_json(invitation) }
    end

    # POST /api/invitations
    def create
      render json: invitation_json(current_user.issued_invitations.create!), status: :created
    end

    # DELETE /api/invitations/:id （未使用のものだけ）
    def destroy
      invitation = current_user.issued_invitations.find_by(id: params[:id])
      return render json: { errors: ["招待が見つかりません"] }, status: :not_found unless invitation
      if invitation.used_at
        return render json: { errors: ["使用済みの招待は削除できません"] }, status: :unprocessable_content
      end

      invitation.destroy
      head :no_content
    end

    private

    def invitation_json(invitation)
      {
        id: invitation.id,
        code: invitation.code,
        status: invitation.status,
        expires_at: invitation.expires_at,
        used_at: invitation.used_at,
        used_by_email: invitation.used_by&.email,
        created_at: invitation.created_at
      }
    end
  end
end
