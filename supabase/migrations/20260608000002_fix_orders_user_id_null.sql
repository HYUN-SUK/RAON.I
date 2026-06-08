-- Drop NOT NULL constraint on orders.user_id to allow ON DELETE SET NULL to execute successfully when a user deletes their account.
ALTER TABLE public.orders ALTER COLUMN user_id DROP NOT NULL;
