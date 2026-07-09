-- Create the character-card-uploads storage bucket (private)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'character-card-uploads',
  'character-card-uploads',
  true,  -- public so portrait URLs work in <img> tags without auth headers
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET public = true;

-- RLS policies on storage.objects for this bucket.
-- Path structure: {user_id}/{character_id}/portrait.{ext}
-- (storage.foldername(name))[1] extracts the first path segment = user_id

CREATE POLICY "Users can upload their own card portraits"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'character-card-uploads'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can read their own card portraits"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'character-card-uploads'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can update their own card portraits"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'character-card-uploads'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete their own card portraits"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'character-card-uploads'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
