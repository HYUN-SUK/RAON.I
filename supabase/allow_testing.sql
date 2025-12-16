-- [Development Only] Allow public inserts to test Community features without Auth
drop policy if exists "Users can insert their own posts" on public.posts;

create policy "Enable insert for all users (Dev)" on public.posts for insert with check (true);

-- Also ensure update is allowed if needed, or keep it strict
-- create policy "Enable update for all users (Dev)" on public.posts for update using (true);
