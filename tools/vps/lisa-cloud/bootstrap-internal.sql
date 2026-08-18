-- The Supabase Postgres image ships auth helper functions owned by postgres.
-- GoTrue migrations replace them, so the migration role must own them first.
alter function auth.uid() owner to supabase_auth_admin;
alter function auth.role() owner to supabase_auth_admin;
alter function auth.email() owner to supabase_auth_admin;
