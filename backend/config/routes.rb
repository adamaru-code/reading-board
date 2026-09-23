Rails.application.routes.draw do
  # Define your application routes per the DSL in https://guides.rubyonrails.org/routing.html

  # Reveal health status on /up that returns 200 if the app boots with no exceptions, otherwise 500.
  # Can be used by load balancers and uptime monitors to verify that the app is live.
  get "up" => "rails/health#show", as: :rails_health_check

  # アプリ API（フロントは Vite プロキシ経由で /api/* を叩く）
  namespace :api do
    resource :session, only: %i[show create destroy] # ログイン状態 / ログイン / ログアウト
    resource :password, only: :update # PATCH /api/password（パスワード変更）

    resources :books, only: %i[index show create update destroy] do
      collection do
        get :lookup # GET /api/books/lookup?isbn=（openBD 照会）
        patch :reorder # PATCH /api/books/reorder（カラム内の並び順を保存）
      end
    end
  end

  # Defines the root path route ("/")
  # root "posts#index"
end
