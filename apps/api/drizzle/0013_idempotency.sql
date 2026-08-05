-- 0013_idempotency.sql
-- 表单幂等提交：客户端生成 Idempotency-Key，服务端去重（防重复创建报名/支付）
CREATE TABLE IF NOT EXISTS "idempotency_keys" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "key" varchar(64) NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "path" varchar(200) NOT NULL,
  "response_status" integer NOT NULL,
  "response_body" text NOT NULL,
  "created_at" timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idempotency_keys_user_key_idx" ON "idempotency_keys"("user_id", "key");
CREATE INDEX IF NOT EXISTS "idempotency_keys_created_at_idx" ON "idempotency_keys"("created_at");
