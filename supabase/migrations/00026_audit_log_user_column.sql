-- Rename "user" column (reserved keyword) to user_name in audit_logs
alter table if exists audit_logs
  rename column "user" to user_name;
