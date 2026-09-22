class ApplicationController < ActionController::API
  # API モードには Cookie が含まれないため明示的に有効化（セッション Cookie 用）
  include ActionController::Cookies
  include Authentication
end
