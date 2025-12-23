-- Give admin@raon.ai full access to missions table
-- Fix: Use auth.jwt() ->> 'email' to avoid accessing auth.users table directly which causes permission errors

-- INSERT
DROP POLICY IF EXISTS "Admins can insert missions" ON public.missions;
CREATE POLICY "Admins can insert missions" ON public.missions
    FOR INSERT WITH CHECK (
        (auth.jwt() ->> 'email') = 'admin@raon.ai'
    );

-- UPDATE
DROP POLICY IF EXISTS "Admins can update missions" ON public.missions;
CREATE POLICY "Admins can update missions" ON public.missions
    FOR UPDATE USING (
        (auth.jwt() ->> 'email') = 'admin@raon.ai'
    );

-- DELETE
DROP POLICY IF EXISTS "Admins can delete missions" ON public.missions;
CREATE POLICY "Admins can delete missions" ON public.missions
    FOR DELETE USING (
        (auth.jwt() ->> 'email') = 'admin@raon.ai'
    );
