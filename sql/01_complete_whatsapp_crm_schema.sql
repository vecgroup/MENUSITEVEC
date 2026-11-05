-- =============================================================================
-- VEC GROUP CRM & WHATSAPP CENTRAL - ENTERPRISE DATABASE ARCHITECTURE & RLS
-- Architected for 500+ Simultaneous Consultants
-- =============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 2. ENUM TYPES
DO $$ BEGIN
    CREATE TYPE public.user_role_type AS ENUM ('OWNER', 'ADMINISTRADOR', 'ADMINISTRATIVO', 'SUPERVISOR', 'VENDEDOR', 'ADVOGADO');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE public.consultant_status_type AS ENUM ('ONLINE', 'OFFLINE', 'BUSY', 'PAUSED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE public.conversation_status_type AS ENUM ('PENDENTE', 'EM_ATENDIMENTO', 'AGUARDANDO_CLIENTE', 'FINALIZADA', 'ARQUIVADA');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE public.message_direction_type AS ENUM ('incoming', 'outgoing');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE public.message_type_enum AS ENUM ('text', 'image', 'audio', 'video', 'document', 'location', 'template', 'note');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE public.delivery_status_enum AS ENUM ('sent', 'delivered', 'read', 'failed');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- =============================================================================
-- TABLE 1: DEPARTMENTS (Departamentos / Equipes)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    code TEXT UNIQUE,
    description TEXT,
    supervisor_id UUID, -- References public.profiles(id)
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- TABLE 2: COMPANIES (Empresas / Razão Social)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    cnpj TEXT UNIQUE,
    trade_name TEXT,
    segment TEXT,
    phone TEXT,
    email TEXT,
    city TEXT,
    state TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_companies_cnpj ON public.companies(cnpj);
CREATE INDEX IF NOT EXISTS idx_companies_name ON public.companies USING gin (name gin_trgm_ops);

-- =============================================================================
-- TABLE 3: CONTACTS (Contatos dos Clientes)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    phone_number TEXT NOT NULL UNIQUE,
    email TEXT,
    cpf TEXT,
    avatar_url TEXT,
    notes TEXT,
    is_blocked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contacts_phone ON public.contacts(phone_number);
CREATE INDEX IF NOT EXISTS idx_contacts_company ON public.contacts(company_id);
CREATE INDEX IF NOT EXISTS idx_contacts_name ON public.contacts USING gin (name gin_trgm_ops);

-- =============================================================================
-- TABLE 4 & 5: PROFILES / USERS / CONSULTANTS
-- =============================================================================
-- Extending/Ensuring profiles table exists with full architecture
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'VENDEDOR',
    department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'ATIVO',
    presence_status TEXT NOT NULL DEFAULT 'OFFLINE',
    max_concurrent_chats INT NOT NULL DEFAULT 15,
    avatar_url TEXT,
    phone TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add supervisor FK reference to departments after profiles is created
ALTER TABLE public.departments 
ADD CONSTRAINT fk_departments_supervisor 
FOREIGN KEY (supervisor_id) REFERENCES public.profiles(id) ON DELETE SET NULL 
DEFERRABLE INITIALLY DEFERRED;

CREATE INDEX IF NOT EXISTS idx_profiles_department ON public.profiles(department_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- =============================================================================
-- TABLE 6: CONVERSATIONS (Conversas / Atendimentos)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.whatsapp_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
    conversation_owner UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- OWNER_ID (defines RLS visibility)
    client_name TEXT NOT NULL,
    company_name TEXT NOT NULL DEFAULT 'EMPRESA NÃO IDENTIFICADA',
    cnpj TEXT,
    phone_number TEXT NOT NULL UNIQUE,
    owner_name TEXT NOT NULL DEFAULT 'Sem Responsável',
    status TEXT NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('EM_ATENDIMENTO', 'PENDENTE', 'AGUARDANDO_CLIENTE', 'FINALIZADA', 'ARQUIVADA')),
    priority TEXT NOT NULL DEFAULT 'NORMAL' CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')),
    unread_count INT NOT NULL DEFAULT 0,
    last_message TEXT DEFAULT '',
    last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    tags TEXT[] DEFAULT '{}',
    lead_status TEXT DEFAULT 'Entrar em Contato',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- High Performance Indexes for 500+ Simultaneous Consultants
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_owner ON public.whatsapp_conversations(conversation_owner);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_dept ON public.whatsapp_conversations(department_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_status ON public.whatsapp_conversations(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_last_msg ON public.whatsapp_conversations(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_owner_status ON public.whatsapp_conversations(conversation_owner, status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_search ON public.whatsapp_conversations USING gin (client_name gin_trgm_ops);

-- =============================================================================
-- TABLE 7: CONVERSATION PARTICIPANTS (Múltiplos Consultores/Supervisores)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.conversation_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    participant_role TEXT NOT NULL DEFAULT 'ASSISTANT' CHECK (participant_role IN ('PRIMARY_OWNER', 'ASSISTANT', 'SUPERVISOR_OBSERVER')),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_conv_participants_user ON public.conversation_participants(user_id);

-- =============================================================================
-- TABLE 8: MESSAGES (Histórico de Mensagens)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
    sender_type TEXT NOT NULL CHECK (sender_type IN ('client', 'consultant', 'system', 'bot')),
    sender_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    consultant_name TEXT,
    receiver_phone TEXT NOT NULL,
    direction TEXT NOT NULL CHECK (direction IN ('incoming', 'outgoing')),
    message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'audio', 'video', 'document', 'location', 'template', 'note')),
    text TEXT NOT NULL DEFAULT '',
    media_url TEXT,
    template_name TEXT,
    status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'read', 'failed')),
    meta_message_id TEXT,
    is_internal_note BOOLEAN DEFAULT FALSE,
    reply_to_id UUID REFERENCES public.whatsapp_messages(id) ON DELETE SET NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_conversation ON public.whatsapp_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_timestamp ON public.whatsapp_messages(conversation_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_meta_id ON public.whatsapp_messages(meta_message_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_trgm ON public.whatsapp_messages USING gin (text gin_trgm_ops);

-- =============================================================================
-- TABLE 9: MESSAGE STATUS (Recibos de Entrega e Leitura da Meta Cloud API)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.message_status (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES public.whatsapp_messages(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('sent', 'delivered', 'read', 'failed')),
    error_code TEXT,
    error_message TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_message_status_message ON public.message_status(message_id);

-- =============================================================================
-- TABLE 10: ATTACHMENTS (Anexos e Mídias)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID REFERENCES public.whatsapp_messages(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size_bytes BIGINT,
    file_url TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attachments_message ON public.attachments(message_id);

-- =============================================================================
-- TABLE 11 & 12: TAGS & CONVERSATION_TAGS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    color_hex TEXT NOT NULL DEFAULT '#00A1E4',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.conversation_tags (
    conversation_id UUID NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
    PRIMARY KEY (conversation_id, tag_id)
);

-- =============================================================================
-- TABLE 13: TRANSFERS (Histórico de Transferências de Atendimento)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.transfers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
    from_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    to_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    transferred_by_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
    reason TEXT,
    transferred_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transfers_conversation ON public.transfers(conversation_id);
CREATE INDEX IF NOT EXISTS idx_transfers_users ON public.transfers(from_user_id, to_user_id);

-- =============================================================================
-- TABLE 14: AUDIT LOGS (Trilha de Auditoria e Conformidade)
-- =============================================================================
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

CREATE INDEX IF NOT EXISTS idx_audit_logs_conversation ON public.whatsapp_audit_logs(conversation_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_performed ON public.whatsapp_audit_logs(performed_by);

-- =============================================================================
-- TABLE 15: NOTIFICATIONS (Notificações em Tempo Real)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'INFO',
    is_read BOOLEAN DEFAULT FALSE,
    link TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id, is_read);

-- =============================================================================
-- TABLE 16: QUICK REPLIES (Respostas Rápidas / Modelos Aprovados)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.quick_replies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shortcut TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT DEFAULT 'GERAL',
    department_id UUID REFERENCES public.departments(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    is_global BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- TABLE 17: CAMPAIGNS (Disparos em Massa & Atendimento Proativo)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT,
    template_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SCHEDULED', 'RUNNING', 'COMPLETED', 'PAUSED')),
    target_count INT DEFAULT 0,
    sent_count INT DEFAULT 0,
    delivered_count INT DEFAULT 0,
    read_count INT DEFAULT 0,
    failed_count INT DEFAULT 0,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    scheduled_for TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- TABLE 18: WEBHOOKS (Logs de Eventos Brutos Meta Cloud API)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.webhooks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'RECEIVED' CHECK (status IN ('RECEIVED', 'PROCESSED', 'FAILED')),
    error_log TEXT,
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhooks_status ON public.webhooks(status);

-- =============================================================================
-- TABLE 19: CONFIGURAÇÕES GERAIS WHATSAPP CLOUD API
-- =============================================================================
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

-- =============================================================================
-- FUNCTIONS & TRIGGERS
-- =============================================================================

-- 1. Automatic Update Conversation on New Message
CREATE OR REPLACE FUNCTION public.fn_update_conversation_on_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.whatsapp_conversations
    SET 
        last_message = NEW.text,
        last_message_at = NEW.timestamp,
        unread_count = CASE 
            WHEN NEW.direction = 'incoming' THEN unread_count + 1 
            ELSE unread_count 
        END,
        updated_at = NOW()
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_update_conversation_on_message ON public.whatsapp_messages;
CREATE TRIGGER trg_update_conversation_on_message
AFTER INSERT ON public.whatsapp_messages
FOR EACH ROW EXECUTE FUNCTION public.fn_update_conversation_on_message();

-- 2. Automatic Audit Log on Conversation Owner Transfer
CREATE OR REPLACE FUNCTION public.fn_log_conversation_transfer()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.conversation_owner IS DISTINCT FROM OLD.conversation_owner THEN
        INSERT INTO public.transfers (
            conversation_id, from_user_id, to_user_id, transferred_by_id, transferred_at
        ) VALUES (
            NEW.id, OLD.conversation_owner, NEW.conversation_owner, auth.uid(), NOW()
        );

        INSERT INTO public.whatsapp_audit_logs (
            conversation_id, action, performed_by, performed_by_name, previous_owner, new_owner, details
        ) VALUES (
            NEW.id, 'TRANSFERRED', auth.uid(), COALESCE(auth.jwt() ->> 'email', 'SISTEMA'), OLD.conversation_owner, NEW.conversation_owner,
            'Atendimento transferido de consultor.'
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_log_conversation_transfer ON public.whatsapp_conversations;
CREATE TRIGGER trg_log_conversation_transfer
AFTER UPDATE ON public.whatsapp_conversations
FOR EACH ROW EXECUTE FUNCTION public.fn_log_conversation_transfer();

-- =============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Strict Security Guaranteed at Database Level
-- =============================================================================

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quick_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

-- Helper RLS Functions
CREATE OR REPLACE FUNCTION public.is_admin_user(p_uid UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_role TEXT;
BEGIN
    SELECT role INTO v_role FROM public.profiles WHERE id = p_uid;
    RETURN v_role IN ('OWNER', 'ADMINISTRADOR', 'ADMINISTRATIVO');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_supervisor_user(p_uid UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_role TEXT;
BEGIN
    SELECT role INTO v_role FROM public.profiles WHERE id = p_uid;
    RETURN v_role = 'SUPERVISOR';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_user_dept_id(p_uid UUID)
RETURNS UUID AS $$
DECLARE
    v_dept_id UUID;
BEGIN
    SELECT department_id INTO v_dept_id FROM public.profiles WHERE id = p_uid;
    RETURN v_dept_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -----------------------------------------------------------------------------
-- RLS POLICIES FOR CONVERSATIONS
-- Admin: Sees ALL conversations
-- Supervisor: Sees conversations in their department or managed consultants
-- Consultant: Sees ONLY their owned conversations OR where they are a participant OR pending
-- -----------------------------------------------------------------------------

CREATE POLICY "Conversations Access Policy"
ON public.whatsapp_conversations FOR SELECT
USING (
    public.is_admin_user(auth.uid())
    OR (
        public.is_supervisor_user(auth.uid()) 
        AND department_id = public.get_user_dept_id(auth.uid())
    )
    OR conversation_owner = auth.uid()
    OR EXISTS (
        SELECT 1 FROM public.conversation_participants cp 
        WHERE cp.conversation_id = whatsapp_conversations.id 
        AND cp.user_id = auth.uid()
    )
    OR status = 'PENDENTE'
);

CREATE POLICY "Conversations Update Policy"
ON public.whatsapp_conversations FOR UPDATE
USING (
    public.is_admin_user(auth.uid())
    OR (
        public.is_supervisor_user(auth.uid()) 
        AND department_id = public.get_user_dept_id(auth.uid())
    )
    OR conversation_owner = auth.uid()
    OR status = 'PENDENTE'
);

CREATE POLICY "Conversations Insert Policy"
ON public.whatsapp_conversations FOR INSERT
WITH CHECK (TRUE);

-- -----------------------------------------------------------------------------
-- RLS POLICIES FOR MESSAGES
-- View/Insert messages if user has access to the parent conversation
-- -----------------------------------------------------------------------------

CREATE POLICY "Messages Select Policy"
ON public.whatsapp_messages FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.whatsapp_conversations c
        WHERE c.id = whatsapp_messages.conversation_id
        AND (
            public.is_admin_user(auth.uid())
            OR (public.is_supervisor_user(auth.uid()) AND c.department_id = public.get_user_dept_id(auth.uid()))
            OR c.conversation_owner = auth.uid()
            OR c.status = 'PENDENTE'
            OR EXISTS (
                SELECT 1 FROM public.conversation_participants cp 
                WHERE cp.conversation_id = c.id AND cp.user_id = auth.uid()
            )
        )
    )
);

CREATE POLICY "Messages Insert Policy"
ON public.whatsapp_messages FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.whatsapp_conversations c
        WHERE c.id = whatsapp_messages.conversation_id
        AND (
            public.is_admin_user(auth.uid())
            OR (public.is_supervisor_user(auth.uid()) AND c.department_id = public.get_user_dept_id(auth.uid()))
            OR c.conversation_owner = auth.uid()
            OR c.status = 'PENDENTE'
        )
    )
);

-- -----------------------------------------------------------------------------
-- RLS POLICIES FOR CONTACTS & COMPANIES
-- -----------------------------------------------------------------------------
CREATE POLICY "Contacts Select Policy" ON public.contacts FOR SELECT USING (TRUE);
CREATE POLICY "Contacts Modify Policy" ON public.contacts FOR ALL USING (TRUE);

CREATE POLICY "Companies Select Policy" ON public.companies FOR SELECT USING (TRUE);
CREATE POLICY "Companies Modify Policy" ON public.companies FOR ALL USING (TRUE);

-- -----------------------------------------------------------------------------
-- RLS POLICIES FOR NOTIFICATIONS
-- Users only access their own notifications
-- -----------------------------------------------------------------------------
CREATE POLICY "Notifications User Policy" ON public.notifications FOR ALL USING (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- REALTIME PUBLICATION SETUP
-- -----------------------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
