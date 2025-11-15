-- Setup Storage Policies for product_images bucket
-- Run this in Supabase SQL Editor to fix 403 errors on image uploads

-- First, drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "authenticated_insert" ON storage.objects;
DROP POLICY IF EXISTS "public_select" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_update" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_delete" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads to product_images" ON storage.objects;
DROP POLICY IF EXISTS "Allow public access to product_images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated updates to product_images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated deletes to product_images" ON storage.objects;

-- Create new policies for product_images bucket

-- Allow authenticated users to upload (INSERT)
CREATE POLICY "Enable insert for authenticated users"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'product_images');

-- Allow public to read files (SELECT)
CREATE POLICY "Enable read for all users"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'product_images');

-- Allow authenticated users to update files
CREATE POLICY "Enable update for authenticated users"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'product_images');

-- Allow authenticated users to delete files
CREATE POLICY "Enable delete for authenticated users"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'product_images');

-- Verify policies were created
SELECT schemaname, tablename, policyname, roles, cmd
FROM pg_policies
WHERE tablename = 'objects' AND schemaname = 'storage'
ORDER BY policyname;
