module Authentication
  extend ActiveSupport::Concern

  included do
    before_action :require_authentication
  end

  class_methods do
    # ログイン等、認証不要なアクションで使う
    def allow_unauthenticated_access(**options)
      skip_before_action :require_authentication, **options
    end
  end

  private

  def current_user
    current_session&.user
  end

  # このリクエストのセッション（パスワード変更時に「自分以外」を失効させるのに使う）
  def current_session
    @current_session ||= resume_session
  end

  # 署名付き httpOnly Cookie のトークンからセッションを復元
  def resume_session
    token = cookies.signed[:session_token]
    token && Session.find_by(token: token)
  end

  def require_authentication
    current_user || render_unauthorized
  end

  # 管理者専用のアクションで before_action に使う（require_authentication の後に実行される）
  def require_admin
    current_user.admin? || render(json: { errors: ["権限がありません"] }, status: :forbidden)
  end

  # ログイン中ユーザーとして返す JSON（session / registration で共通）
  def user_json(user)
    { id: user.id, email: user.email, admin: user.admin }
  end

  def render_unauthorized
    render json: { errors: ["ログインが必要です"] }, status: :unauthorized
  end

  def start_new_session_for(user)
    session = user.sessions.create!(ip_address: request.remote_ip, user_agent: request.user_agent)
    cookies.signed.permanent[:session_token] = {
      value: session.token,
      httponly: true,
      same_site: :lax
    }
    session
  end

  def terminate_session
    resume_session&.destroy
    cookies.delete(:session_token)
  end
end
