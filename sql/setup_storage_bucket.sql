-- Setup Storage Bucket for Product Images
-- Run this in Supabase SQL Editor to create the bucket and configure it properly

-- First, check if the bucket exists
-- If it doesn't exist, create it
INSERT INTO storage.buckets (id, name, public)
VALUES ('product_images', 'product_images', true)
ON CONFLICT (id) DO NOTHING;

-- Make sure the bucket is public (so images can be accessed via public URLs)
UPDATE storage.buckets
SET public = true
WHERE id = 'product_images';

-- Verify the bucket was created
SELECT id, name, public, created_at
FROM storage.buckets
WHERE id = 'product_images';
