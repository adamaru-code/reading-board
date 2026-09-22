class Session < ApplicationRecord
  belongs_to :user

  # 作成時にランダムなセッショントークンを採番（Cookie に署名付きで保存する値）
  has_secure_token :token
end
