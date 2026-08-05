-- 0012_account_center.sql
-- 会话管理：JWT 版本号（登出其他设备用）
ALTER TABLE "users" ADD COLUMN "token_version" integer NOT NULL DEFAULT 1;

-- 通知偏好（按事件类型细分的开关）
ALTER TABLE "users" ADD COLUMN "preferences" jsonb NOT NULL DEFAULT '{}';

-- 头像支持 Data URL / 长文本（原 varchar 上限 255 不够）
ALTER TABLE "users" ALTER COLUMN "avatar_url" TYPE text;

-- 登录设备会话表
CREATE TABLE IF NOT EXISTS "sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "device_name" varchar(100),
  "user_agent" text,
  "ip" varchar(45),
  "created_at" timestamp DEFAULT now(),
  "last_active_at" timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "sessions_user_id_idx" ON "sessions"("user_id");
