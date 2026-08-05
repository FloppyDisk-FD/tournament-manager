-- 0014_audit_logs.sql
-- 审计日志：关键操作（支付/报名）审计 + 前端错误上报
CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "action" varchar(50) NOT NULL,
  "category" varchar(30) NOT NULL,
  "detail" jsonb NOT NULL DEFAULT '{}',
  "ip" varchar(45),
  "created_at" timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "audit_logs_created_at_idx" ON "audit_logs"("created_at");
CREATE INDEX IF NOT EXISTS "audit_logs_category_idx" ON "audit_logs"("category");
