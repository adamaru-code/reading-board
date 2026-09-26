namespace :admin do
  # AWS の起動時に実行する。DB をスナップショットから復元すると前回の管理者パスワードが残るため、
  # 毎回 SSM の値（SEED_USER_PASSWORD）に合わせ、取得コマンドで出したパスワードでログインできるようにする。
  # 管理者が居なければ作る（デモ用の本は作らない。新規 DB の seed は db:prepare が行う）
  desc "初期管理者（SEED_USER_EMAIL）を用意し、パスワードを SEED_USER_PASSWORD に合わせる"
  task ensure: :environment do
    email = ENV["SEED_USER_EMAIL"].presence
    password = ENV["SEED_USER_PASSWORD"].presence
    abort "SEED_USER_EMAIL と SEED_USER_PASSWORD を指定してください" unless email && password

    user = User.find_or_initialize_by(email: email)
    user.password = password
    user.admin = true
    user.save!
    puts "admin ensured: #{user.email}"
  end
end
