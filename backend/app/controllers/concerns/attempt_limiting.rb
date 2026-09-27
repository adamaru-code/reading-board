# 総当たり対策として、IP ごとの試行回数を制限する（Rails 8 の rate_limit）
module AttemptLimiting
  extend ActiveSupport::Concern

  class_methods do
    def limit_attempts(to:, within:, only:)
      # name でアクションごとにカウンタを分ける（同じコントローラに複数付けても混ざらない）
      rate_limit to: to, within: within, only: only, name: Array(only).join("-"), store: RATE_LIMIT_STORE,
        with: -> { render json: { errors: [ I18n.t("api.errors.too_many_attempts") ] }, status: :too_many_requests }
    end
  end
end
