Rails.application.routes.draw do
  # Define your application routes per the DSL in https://guides.rubyonrails.org/routing.html

  # Reveal health status on /up that returns 200 if the app boots with no exceptions, otherwise 500.
  # Can be used by load balancers and uptime monitors to verify that the app is live.
  get "up" => "rails/health#show", as: :rails_health_check

  # アプリ API（フロントは Vite プロキシ経由で /api/* を叩く）
  namespace :api do
    resource :session, only: %i[show create destroy] # ログイン状態 / ログイン / ログアウト
    resource :password, only: :update # PATCH /api/password（パスワード変更）
    resource :registration, only: %i[create destroy] # 招待コードで登録 / アカウント削除
    resources :invitations, only: %i[index create destroy] # 招待コード（管理者のみ）
    # ユーザー一覧と再設定リンクの発行（管理者のみ）
    resources :users, only: :index do
      resource :password_reset_link, only: :create
    end
    resource :password_reset, only: %i[show update] # 再設定リンクの確認 / 新パスワードの設定
    resources :hidden_tags, only: %i[index create destroy] # タグ候補から隠したタグ
    # 自分の本のタグ（一覧・名前を変える／まとめる・外す。自分の本のつながりだけを変える）
    resources :tags, only: :index do
      collection do
        patch :rename # PATCH /api/tags/rename { from, to }
        delete :remove # DELETE /api/tags/remove?name=
      end
    end

    resources :books, only: %i[index show create update destroy] do
      collection do
        get :lookup # GET /api/books/lookup?isbn=（openBD 照会）
        patch :reorder # PATCH /api/books/reorder（カラム内の並び順を保存）
        get :stats # GET /api/books/stats（今年・今月の読了冊数）
        get :export # GET /api/books/export（自分の本をすべて CSV で書き出す）
        post :import # POST /api/books/import（CSV の本をまとめて登録。dry_run で確認だけ）
      end
    end
  end

  # Defines the root path route ("/")
  # root "posts#index"
end
