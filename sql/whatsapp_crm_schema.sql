-- =============================================================================
-- VEC GROUP CRM & WHATSAPP CENTRAL - DATABASE SCHEMA & ROW LEVEL SECURITY (RLS)
-- =============================================================================
-- Execute este script no SQL Editor do seu projeto Supabase.

-- 1. EXTENSÕES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABELA DE CONFIGURAÇÕES DO WHATSAPP CLOUD API (META)
CREATE TABLE IF NOT EXISTS public.whatsapp_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone_number_id TEXT NOT NULL,
    business_account_id TEXT NOT NULL,
    access_token TEXT NOT NULL,
    verify_token TEXT NOT NULL DEFAULT 'vecgroup_whatsapp_secure_token_2026',
    official_number TEXT NOT NULL DEFAULT '+55 19 98317-0689',
    distribution_mode TEXT NOT NULL DEFAULT 'ROUND_ROBIN' CHECK (distribution_mode IN ('ROUND_ROBIN', 'LEAST_CLIENTS', 'LEAST_OPEN_CHATS', 'MANUAL')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. TABELA DE CONVERSAS (WHATSAPP CONVERSATIONS)
CREATE TABLE IF NOT EXISTS public.whatsapp_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID,
    client_name TEXT NOT NULL,
    company_name TEXT NOT NULL DEFAULT 'EMPRESA NÃO IDENTIFICADA',
    cnpj TEXT,
    phone_number TEXT NOT NULL UNIQUE,
    conversation_owner UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    owner_name TEXT NOT NULL DEFAULT 'Sem Responsável',
    status TEXT NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('EM_ATENDIMENTO', 'PENDENTE', 'AGUARDANDO_CLIENTE', 'FINALIZADA', 'ARQUIVADA')),
    unread_count INT NOT NULL DEFAULT 0,
    last_message TEXT DEFAULT '',
    last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    tags TEXT[] DEFAULT '{}',
    lead_status TEXT DEFAULT 'Entrar em Contato',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para alta performance de consulta
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_owner ON public.whatsapp_conversations(conversation_owner);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_phone ON public.whatsapp_conversations(phone_number);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_status ON public.whatsapp_conversations(status);

-- 4. TABELA DE MENSAGENS (WHATSAPP MESSAGES)
CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
    sender_type TEXT NOT NULL CHECK (sender_type IN ('client', 'consultant', 'system', 'bot')),
    sender_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    consultant_name TEXT, -- Exemplo: "CONSULTOR JOÃO" (Identificação interna)
    receiver_phone TEXT NOT NULL,
    direction TEXT NOT NULL CHECK (direction IN ('incoming', 'outgoing')),
    message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'audio', 'video', 'document', 'template', 'note')),
    text TEXT NOT NULL DEFAULT '',
    media_url TEXT,
    template_name TEXT,
    status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'read', 'failed')),
    meta_message_id TEXT,
    is_internal_note BOOLEAN DEFAULT FALSE,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_conversation ON public.whatsapp_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_timestamp ON public.whatsapp_messages(timestamp);

-- 5. TABELA DE AUDITORIA E LOGS (WHATSAPP AUDIT LOGS)
CREATE TABLE IF NOT EXISTS public.whatsapp_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    performed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    performed_by_name TEXT NOT NULL,
    previous_owner UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    new_owner UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    details TEXT NOT NULL,
    ip_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. TABELA DE FILA E RODÍZIO (DISTRIBUTION POINTER)
CREATE TABLE IF NOT EXISTS public.whatsapp_distribution_queue (
    id INT PRIMARY KEY DEFAULT 1,
    last_consultant_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO public.whatsapp_distribution_queue (id, last_consultant_id) 
VALUES (1, NULL) ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================

ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper function: Verifica se o usuário atual é ADMIN ou OWNER
CREATE OR REPLACE FUNCTION public.is_admin_or_owner()
RETURNS BOOLEAN AS $$
DECLARE
    user_role TEXT;
BEGIN
    SELECT role INTO user_role FROM public.profiles WHERE id = auth.uid();
    RETURN user_role IN ('OWNER', 'SUPERVISOR', 'ADMINISTRATIVO', 'ADMINISTRADOR');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- POLÍTICAS DE RLS PARA CONVERSAS
-- Admins e Supervisores podem ver TUDO
CREATE POLICY "Admins and Supervisors view all conversations"
ON public.whatsapp_conversations FOR SELECT
USING (public.is_admin_or_owner() OR conversation_owner = auth.uid());

-- Consultores podem atualizar APENAS suas próprias conversas ou conversas pendentes
CREATE POLICY "Consultants manage own conversations"
ON public.whatsapp_conversations FOR UPDATE
USING (public.is_admin_or_owner() OR conversation_owner = auth.uid());

-- POLÍTICAS DE RLS PARA MENSAGENS
-- Usuários enxergam mensagens das conversas que eles têm permissão
CREATE POLICY "Users view messages of accessible conversations"
ON public.whatsapp_messages FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.whatsapp_conversations c
        WHERE c.id = whatsapp_messages.conversation_id
        AND (public.is_admin_or_owner() OR c.conversation_owner = auth.uid())
    )
);

CREATE POLICY "Users insert messages to accessible conversations"
ON public.whatsapp_messages FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.whatsapp_conversations c
        WHERE c.id = whatsapp_messages.conversation_id
        AND (public.is_admin_or_owner() OR c.conversation_owner = auth.uid())
    )
);

-- HABILITAR REALTIME NO SUPABASE
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages;
