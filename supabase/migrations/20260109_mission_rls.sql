-- Enable RLS on missions table
ALTER TABLE "public"."missions" ENABLE ROW LEVEL SECURITY;

-- Allow SELECT for everyone (or authenticated)
CREATE POLICY "Enable read access for all users"
ON "public"."missions"
AS PERMISSIVE
FOR SELECT
TO public
USING (true);

-- Allow INSERT for authenticated users (admins)
CREATE POLICY "Enable insert for authenticated users"
ON "public"."missions"
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow UPDATE for authenticated users
CREATE POLICY "Enable update for authenticated users"
ON "public"."missions"
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Allow DELETE for authenticated users
CREATE POLICY "Enable delete for authenticated users"
ON "public"."missions"
AS PERMISSIVE
FOR DELETE
TO authenticated
USING (true);
