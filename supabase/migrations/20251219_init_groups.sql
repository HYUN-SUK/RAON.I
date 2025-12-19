-- 20251219_init_groups.sql

-- 1. Create GROUPS Table
CREATE TABLE IF NOT EXISTS public.groups (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    image_url TEXT,
    owner_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    max_members INTEGER DEFAULT 10,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create GROUP_MEMBERS Table
CREATE TABLE IF NOT EXISTS public.group_members (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'member', -- 'owner', 'admin', 'member'
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(group_id, user_id)
);

-- 3. Add group_id to POSTS (Relationship)
-- Check if column exists first to avoid error if re-run
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'posts' AND column_name = 'group_id') THEN
        ALTER TABLE public.posts ADD COLUMN group_id UUID REFERENCES public.groups(id) ON DELETE SET NULL;
    END IF;
END $$;


-- 4. Enable RLS
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies

-- GROUPS: Public Read, Auth Insert, Owner Update/Delete
CREATE POLICY "Public Read Groups" ON public.groups FOR SELECT USING (true);

CREATE POLICY "Auth Create Groups" ON public.groups FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Owner Manage Groups" ON public.groups FOR ALL USING (auth.uid() = owner_id);

-- GROUP_MEMBERS: Public Read, Auth Insert (Join), Self/Owner Delete (Leave/Kick)
CREATE POLICY "Public Read Members" ON public.group_members FOR SELECT USING (true);

CREATE POLICY "Auth Join Groups" ON public.group_members FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Self Leave Groups" ON public.group_members FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Owner Kick Members" ON public.group_members FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.groups 
    WHERE id = group_members.group_id AND owner_id = auth.uid()
  )
);

-- POSTS: Restrict Posting to Members if group_id is present
CREATE POLICY "Group Member Post" ON public.posts FOR INSERT WITH CHECK (
  group_id IS NULL OR 
  EXISTS (
    SELECT 1 FROM public.group_members 
    WHERE group_id = posts.group_id AND user_id = auth.uid()
  )
);

-- Notify Schema Reload
NOTIFY pgrst, 'reload schema';
