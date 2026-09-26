require "test_helper"
require "rake"

class AdminTaskTest < ActiveSupport::TestCase
  setup do
    Rails.application.load_tasks unless Rake::Task.task_defined?("admin:ensure")
    @task = Rake::Task["admin:ensure"]
    @task.reenable
    @saved_env = ENV.to_h.slice("SEED_USER_EMAIL", "SEED_USER_PASSWORD")
  end

  teardown do
    %w[SEED_USER_EMAIL SEED_USER_PASSWORD].each { |key| ENV[key] = @saved_env[key] }
  end

  def run_task(email:, password:)
    ENV["SEED_USER_EMAIL"] = email
    ENV["SEED_USER_PASSWORD"] = password
    capture_io { @task.invoke }
  end

  test "既存の管理者のパスワードを指定の値に合わせる（本は作らない）" do
    owner = users(:owner)
    assert_no_difference -> { Book.count } do
      run_task(email: owner.email, password: "restored-admin-1")
    end
    assert owner.reload.authenticate("restored-admin-1")
    assert owner.admin?
  end

  test "管理者が居なければ作る" do
    assert_difference -> { User.count }, 1 do
      run_task(email: "new-admin@example.com", password: "new-admin-pass-1")
    end
    assert User.find_by!(email: "new-admin@example.com").admin?
  end
end
