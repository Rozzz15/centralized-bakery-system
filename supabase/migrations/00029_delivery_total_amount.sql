-- Add total_amount column to deliveries table
alter table deliveries add column if not exists total_amount numeric default 0;

-- Update check constraint for payment_status to allow 'half'
alter table deliveries drop constraint if exists deliveries_payment_status_check;
alter table deliveries add constraint deliveries_payment_status_check 
  check (payment_status in ('unpaid', 'paid', 'half'));
