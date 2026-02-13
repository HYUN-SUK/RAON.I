-- Enable RLS on missions table
ALTER TABLE "public"."missions" ENABLE ROW LEVEL SECURITY;

-- Allow SELECT for everyone (or authenticated)
DROP POLICY IF EXISTS "Enable read access for all users" ON "public"."missions";
CREATE POLICY "Enable read access for all users"
ON "public"."missions"
AS PERMISSIVE
FOR SELECT
TO public
USING (true);

-- Allow INSERT for authenticated users (admins)
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON "public"."missions";
CREATE POLICY "Enable insert for authenticated users"
ON "public"."missions"
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow UPDATE for authenticated users
DROP POLICY IF EXISTS "Enable update for authenticated users" ON "public"."missions";
CREATE POLICY "Enable update for authenticated users"
ON "public"."missions"
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Allow DELETE for authenticated users
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON "public"."missions";
CREATE POLICY "Enable delete for authenticated users"
ON "public"."missions"
AS PERMISSIVE
FOR DELETE
TO authenticated
USING (true);
