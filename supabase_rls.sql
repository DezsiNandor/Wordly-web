-- ==============================================================================
-- WL (Word Learning) - Supabase PostgreSQL Row Level Security (RLS) Séma
-- Garantálja a 100%-os adatizolációt: más felhasználók semmilyen módon nem férhetnek
-- hozzá egymás szólistáihoz és gyakorlási eredményeihez.
-- ==============================================================================

-- 1. Szólisták tábla (word_lists)
CREATE TABLE IF NOT EXISTS public.word_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    word_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index a gyors lekérdezésekhez felhasználó szerint
CREATE INDEX IF NOT EXISTS idx_word_lists_user_id ON public.word_lists(user_id);

-- 2. Szavak tábla (words)
CREATE TABLE IF NOT EXISTS public.words (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    list_id UUID NOT NULL REFERENCES public.word_lists(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    english TEXT NOT NULL,
    hungarian TEXT NOT NULL,
    times_practiced INTEGER DEFAULT 0,
    times_correct INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Index a gyors listázáshoz
CREATE INDEX IF NOT EXISTS idx_words_list_id ON public.words(list_id);
CREATE INDEX IF NOT EXISTS idx_words_user_id ON public.words(user_id);

-- ==============================================================================
-- 3. Szigorú Row Level Security (RLS) Engedélyezése
-- ==============================================================================

ALTER TABLE public.word_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.words ENABLE ROW LEVEL SECURITY;

-- WORD_LISTS Hozzáférési Szabályok:
CREATE POLICY "Felhasznalo csak a sajat listait lathatja"
    ON public.word_lists FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Felhasznalo csak a sajat nevere hozhat letre listat"
    ON public.word_lists FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Felhasznalo csak a sajat listait modolithatja"
    ON public.word_lists FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Felhasznalo csak a sajat listait torolheti"
    ON public.word_lists FOR DELETE
    USING (auth.uid() = user_id);

-- WORDS Hozzáférési Szabályok:
CREATE POLICY "Felhasznalo csak a sajat szavait lathatja"
    ON public.words FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Felhasznalo csak a sajat nevere hozhat letre szavat"
    ON public.words FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Felhasznalo csak a sajat szavait modolithatja"
    ON public.words FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Felhasznalo csak a sajat szavait torolheti"
    ON public.words FOR DELETE
    USING (auth.uid() = user_id);
