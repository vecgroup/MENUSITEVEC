-- ==============================================================================
-- VEC GROUP CRM - CONFIGURAÇÃO E POLÍTICAS DE GESTÃO DE USUÁRIOS (SUPABASE)
-- ==============================================================================

-- 1. DESABILITAR CONFIRMAÇÃO OBRIGATÓRIA DE EMAIL NO AUTHENTICATION:
-- (No painel do Supabase: Authentication -> Providers -> Email -> Desmarque "Confirm email")
-- Isso permite que novos usuários criados façam login imediatamente com a senha definida.

-- 2. GARANTIR QUE A TABELA profiles TEM AS COLUNAS ADEQUADAS:
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS birth_date DATE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS admission_date DATE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'VENDEDOR';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ATIVO';

-- 3. GARANTIR UNICIDADE DO EMAIL PARA EVITAR DUPLICADOS:
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'unique_profiles_email'
    ) THEN
        ALTER TABLE public.profiles ADD CONSTRAINT unique_profiles_email UNIQUE (email);
    END IF;
EXCEPTION
    WHEN others THEN NULL;
END $$;

-- 4. POLÍTICAS DE ROW LEVEL SECURITY (RLS) PARA A TABELA profiles:
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Permitir leitura para todos autenticados:
DROP POLICY IF EXISTS "Permitir leitura de perfis para autenticados" ON public.profiles;
CREATE POLICY "Permitir leitura de perfis para autenticados" 
ON public.profiles FOR SELECT 
TO authenticated 
USING (true);

-- Permitir que o proprietário (service_role ou OWNER) gerencie todos os perfis:
DROP POLICY IF EXISTS "Permitir inserção e atualização de perfis" ON public.profiles;
CREATE POLICY "Permitir inserção e atualização de perfis" 
ON public.profiles FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- 5. TRIGGER AUTOMÁTICO: Quando um usuário for criado no auth.users, sincronizar perfil automaticamente:
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, email, role, status, avatar_url, created_at, updated_at)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'role', 'VENDEDOR'),
        'ATIVO',
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', NULL),
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE
    SET 
        full_name = EXCLUDED.full_name,
        email = EXCLUDED.email,
        updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON public.profiles;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
