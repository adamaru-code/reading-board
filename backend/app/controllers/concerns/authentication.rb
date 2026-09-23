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
