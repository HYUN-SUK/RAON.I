-- Add Read Count RPC
create or replace function increment_read_count(row_id uuid)
returns void as $$
begin
  update public.posts
  set read_count = coalesce(read_count, 0) + 1
  where id = row_id;
end;
$$ language plpgsql;
