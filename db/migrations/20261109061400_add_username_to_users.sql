ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS username VARCHAR(32);

CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_idx
    ON public.users (lower(username))
    WHERE username IS NOT NULL;

NOTIFY pgrst, 'reload schema';
