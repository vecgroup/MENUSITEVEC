import { createClient } from '@supabase/supabase-js';
import { LeadStatus, UserStatus, UserRole } from '../types';

// CONFIGURAÇÃO DO BANCO PRIMÁRIO (Auth, Usuários, Chamados, Metas, Pontos)
export const IS_OFFLINE = false; // Mude para false para usar o Modo Online (Conectado ao Supabase)

const PRIMARY_URL = 'https://aoxudaqhkdiyvahzfzuj.supabase.co';
const PRIMARY_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFveHVkYXFoa2RpeXZhaHpmenVqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMDAyNTksImV4cCI6MjA4NDY3NjI1OX0.G7qoSDpTTXSIiSOf37wOupel3PmjfYUzNG7v4iNtUfs';

// CONFIGURAÇÃO DO BANCO DE LEADS (Tabelas: leads, clientes_fechados)
// TODO: Substitua pelos dados do seu segundo projeto Supabase
const LEADS_URL = 'https://aoxudaqhkdiyvahzfzuj.supabase.co'; // Mude para a URL do banco de Leads
const LEADS_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFveHVkYXFoa2RpeXZhaHpmenVqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMDAyNTksImV4cCI6MjA4NDY3NjI1OX0.G7qoSDpTTXSIiSOf37wOupel3PmjfYUzNG7v4iNtUfs'; // Mude para a Key do banco de Leads

// CONFIGURAÇÃO DO CRM EXTERNO (Ponte para Gestão de Metas)
const EXTERNAL_CRM_URL = 'https://aoxudaqhkdiyvahzfzuj.supabase.co';
const EXTERNAL_CRM_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFveHVkYXFoa2RpeXZhaHpmenVqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMDAyNTksImV4cCI6MjA4NDY3NjI1OX0.G7qoSDpTTXSIiSOf37wOupel3PmjfYUzNG7v4iNtUfs';

export const clearStaleAuthTokens = () => {
    try {
        if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.removeItem('vecgroup_crm_auth_token');
            window.localStorage.removeItem('vecgroup-crm-auth-token');
        }
    } catch (_) {}
};

// Resilient safeFetch wrapper that prevents uncaught "Failed to fetch" TypeError on network blips or paused Supabase projects
const safeFetch: typeof fetch = async (input, init) => {
    try {
        return await fetch(input, init);
    } catch (err: any) {
        const urlStr = typeof input === 'string' ? input : (input as Request)?.url || '';
        console.warn(`[Network] Falha na requisição fetch para ${urlStr}:`, err?.message || err);
        return new Response(JSON.stringify({ 
            message: 'Falha de conexão com o servidor Supabase. Modo offline ou verifique sua conexão.', 
            error: 'Failed to fetch',
            hint: 'Network unreachable'
        }), {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'application/json' }
        });
    }
};

if (typeof window !== 'undefined') {
    const isRefreshTokenError = (err: any): boolean => {
        if (!err) return false;
        const str = typeof err === 'string' 
            ? err 
            : (err?.message || err?.error_description || (typeof err === 'object' ? `${err.name || ''}: ${err.message || JSON.stringify(err)}` : String(err)));
        const lower = String(str).toLowerCase();
        return lower.includes('refresh token') || lower.includes('refresh_token') || lower.includes('invalid_grant');
    };

    // Intercepta console.error para suprimir logs excessivos do GoTrueClient sem apagar a sessão
    const originalConsoleError = console.error;
    console.error = function (...args: any[]) {
        for (const arg of args) {
            if (isRefreshTokenError(arg)) {
                console.warn('[Auth] Aviso transitório de refresh token suprimido.');
                return;
            }
        }
        return originalConsoleError.apply(this, args);
    };

    window.addEventListener('unhandledrejection', (event) => {
        const reason = event.reason;
        const msg = typeof reason === 'string' ? reason : reason?.message || reason?.error_description || '';
        const msgLower = msg.toLowerCase();
        if (msgLower.includes('refresh token') || msgLower.includes('refresh_token') || msgLower.includes('invalid_grant')) {
            event.preventDefault();
            event.stopImmediatePropagation();
        } else if (msgLower.includes('failed to fetch') || msgLower.includes('networkerror') || msgLower.includes('load failed')) {
            console.warn('[Network] Erro de conexão de rede capturado com segurança:', msg);
            event.preventDefault();
            event.stopImmediatePropagation();
        }
    });

    window.addEventListener('error', (event) => {
        const msg = (event.message || '').toLowerCase();
        if (msg.includes('refresh token') || msg.includes('refresh_token') || msg.includes('invalid_grant')) {
            event.preventDefault();
        } else if (msg.includes('failed to fetch') || msg.includes('networkerror') || msg.includes('load failed')) {
            console.warn('[Network] Erro de rede interceptado com segurança:', event.message);
            event.preventDefault();
        }
    });
}

const realSupabaseClient = createClient(PRIMARY_URL, PRIMARY_KEY, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
        storageKey: 'vecgroup_crm_auth_token',
        flowType: 'pkce'
    },
    global: {
        fetch: safeFetch
    }
});

const realLeadsClient = createClient(LEADS_URL, LEADS_KEY, {
    auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
    },
    global: {
        fetch: safeFetch
    }
});

const realExternalCrmClient = createClient(EXTERNAL_CRM_URL, EXTERNAL_CRM_KEY, {
    auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
    },
    global: {
        fetch: safeFetch
    }
});

if (typeof window !== 'undefined') {
    realSupabaseClient.auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_OUT') {
            clearStaleAuthTokens();
        }
    });
}

/**
 * Builds clean URLs for sister systems (Leads, Clientes Fechados, TIM Leads, WhatsApp).
 * CRITICAL: All sister systems configure Supabase with flowType: 'pkce'.
 * Passing access_token in the query or hash causes GoTrue._getSessionFromURL to throw
 * "Not a valid PKCE flow url.", which wipes/fails the session and causes password prompts!
 * Clean parameters (user_email, email, user_id, cnpj, etc.) are passed without access_token hash.
 */
export const buildSSOUrl = async (baseUrl: string, extraParams?: Record<string, string | undefined>): Promise<string> => {
    try {
        const { data } = await realSupabaseClient.auth.getSession();
        const session = data?.session;

        const urlObj = new URL(baseUrl);

        if (extraParams) {
            for (const [key, value] of Object.entries(extraParams)) {
                if (value !== undefined && value !== null && value !== '') {
                    urlObj.searchParams.set(key, value);
                }
            }
        }

        if (session?.user?.email) {
            urlObj.searchParams.set('user_email', session.user.email);
            if (!urlObj.searchParams.has('email')) {
                urlObj.searchParams.set('email', session.user.email);
            }
        }
        if (session?.user?.id) {
            urlObj.searchParams.set('user_id', session.user.id);
        }

        return urlObj.toString();
    } catch (err) {
        console.warn('[SSO] Erro ao construir URL de SSO:', err);
        return baseUrl;
    }
};

// MOCK CLIENTS PARA MODO OFFLINE
const mockClient = {
    auth: {
        getSession: async () => ({ data: { session: { user: { id: 'mock-id', email: 'vinicius@ocomunicacao.com' } } }, error: null }),
        getUser: async () => ({ data: { user: { id: 'mock-id', email: 'vinicius@ocomunicacao.com' } }, error: null }),
        signInWithPassword: async ({ email }: any) => ({ data: { user: { id: 'mock-id', email } }, error: null }),
        signOut: async () => ({ error: null }),
        onAuthStateChange: (callback: any) => {
            callback('SIGNED_IN', { user: { id: 'mock-id', email: 'vinicius@ocomunicacao.com' } });
            return { data: { subscription: { unsubscribe: () => {} } } };
        },
        onAuthStateChanged: (callback: any) => {
            callback('SIGNED_IN', { user: { id: 'mock-id', email: 'vinicius@ocomunicacao.com' } });
            return { data: { subscription: { unsubscribe: () => {} } } };
        },
        updateUser: async () => ({ error: null })
    },
    from: () => ({
        select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: null, error: null }), order: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
            order: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
            range: async () => ({ data: [], error: null })
        }),
        upsert: async () => ({ data: null, error: null }),
        insert: async () => ({ data: null, error: null }),
        delete: () => ({ eq: async () => ({ error: null }), neq: async () => ({ error: null }), in: async () => ({ error: null }) })
    })
} as any;

export const supabaseClient = IS_OFFLINE ? mockClient : realSupabaseClient;
export const leadsClient = IS_OFFLINE ? mockClient : realLeadsClient;
export const externalCrmClient = IS_OFFLINE ? mockClient : realExternalCrmClient;

// Helper para encontrar o valor correto do Enum independente da caixa (case-insensitive)
const normalizeLeadStatus = (s: string): LeadStatus => {
    const val = String(s || '').toLowerCase().trim();
    if (!val) return LeadStatus.ENTRAR_CONTATO;
    
    for (const enumVal of Object.values(LeadStatus)) {
        if (enumVal.toLowerCase().trim() === val) return enumVal;
    }
    
    if (val === 'fechado') return LeadStatus.FECHADO;
    if (val === 'finalizado') return LeadStatus.FINALIZADO;
    if (val === 'cancelado') return LeadStatus.CANCELADO;
    if (val === 'reprovado') return LeadStatus.REPROVADO;

    return s as LeadStatus;
};

export const normalizeRole = (r: string): UserRole => {
    const val = String(r || '').toUpperCase().trim();
    if (val === 'OWNER') return UserRole.OWNER;
    if (val === 'SUPERVISOR') return UserRole.SUPERVISOR;
    if (val === 'ADMINISTRATIVO' || val === 'ADMIN') return UserRole.ADMIN;
    if (val === 'ADMINISTRADOR') return UserRole.ADMIN_ALT;
    if (val === 'ADVOGADO') return UserRole.ADVOGADO;
    return UserRole.VENDEDOR;
};

// Helpers de mapeamento de Leads
const mapLeadToDb = (l: any) => ({
    id: l.id,
    elemento: l.ELEMENTO || l.elemento,
    cnpj: l.CNPJ || l.cnpj,
    razao_social: l.razaoSocial || l.razao_social,
    estado: l.estado,
    data_consulta: l.DATA_Consulta || l.data_consulta,
    status: l.Status || l.status,
    vendedor: l.Vendedor || l.vendedor,
    telefone_principal: l.Telefone_Principal || l.telefone_principal,
    operadora: l.operadora,
    ativos: String(l.ATIVOS || l.ativos || '0'),
    data_ultimo_pedido_vivo: l.DATA_ULTIMO_PEDIDO_NA_VIVO || l.data_ultimo_pedido_vivo,
    primary_contact_index: l.primaryContactIndex || l.primary_contact_index,
    pen: l.pen,
    voz_basica: l.vozBasica || l.voz_basica,
    dados: l.dados,
    nome: l.NOME || l.nome,
    cpf: l.CPF || l.cpf,
    rg: l.RG || l.rg,
    celular: l.CELULAR || l.celular,
    email: l.EMAIL || l.email,
    nome_02: l.NOME_02 || l.nome_02, cpf_02: l.CPF_02 || l.cpf_02, rg_02: l.RG_02 || l.rg_02, celular_02: l.CELULAR_02 || l.celular_02, email_02: l.EMAIL_02 || l.email_02,
    nome_03: l.NOME_03 || l.nome_03, cpf_03: l.CPF_03 || l.cpf_03, rg_03: l.RG_03 || l.rg_03, celular_03: l.CELULAR_03 || l.celular_03, email_03: l.EMAIL_03 || l.email_03,
    nome_04: l.NOME_04 || l.nome_04, cpf_04: l.CPF_04 || l.cpf_04, rg_04: l.RG_04 || l.rg_04, celular_04: l.CELULAR_04 || l.celular_04, email_04: l.EMAIL_04 || l.email_04,
    nome_05: l.NOME_05 || l.nome_05, cpf_05: l.CPF_05 || l.cpf_05, rg_05: l.RG_05 || l.rg_05, celular_05: l.CELULAR_05 || l.celular_05, email_05: l.EMAIL_05 || l.email_05,
    retorno_credito_vivo: l.RETORNO_CREDITO_VIVO || l.retorno_credito_vivo,
    valor_em_aberto_vivo: l.VALOR_EM_ABERTO_VIVO || l.valor_em_aberto_vivo,
    valor_total_debito_vivo: l.VALOR_TOTAL_DEBITO_VIVO || l.valor_total_debito_vivo,
    n_ultimo_pedido_vivo: l.N_ULTIMO_PEDIDO_NA_VIVO || l.n_ultimo_pedido_vivo,
    status_pedido_vivo: l.STATUS_PEDIDO_VIVO || l.status_pedido_vivo,
    cust_code: l.custCode || l.cust_code,
    login: l.login,
    senha: l.senha,
    radar: l.radar,
    token_cadastro: l.tokenCadastro || l.token_cadastro,
    data_renovacao: l.dataRenovacao || l.data_renovacao,
    valor_total_receita: l.valorTotalReceita || l.valor_total_receita,
    data_fechamento: l.dataFechamento || l.data_fechamento,
    is_pago: !!(l.isPago || l.is_pago),
    is_portado: !!(l.isPortado || l.is_portado),
    linhas_detalhas: l.linhasDetalhas || l.linhas_detalhas || [],
    attachments: l.attachments || [],
    notes: l.notes || []
});

const mapDbToLead = (l: any, isFromClosedTable = false) => ({
    ...l,
    id: l.id,
    ELEMENTO: l.elemento || l.ELEMENTO || '--',
    CNPJ: l.cnpj || l.CNPJ || '--',
    razaoSocial: l.razao_social || l.razaoSocial || l.razaosocial || 'EMPRESA SEM NOME',
    DATA_Consulta: l.data_consulta || l.DATA_Consulta || '',
    Status: normalizeLeadStatus(l.status || l.Status),
    Vendedor: l.vendedor || l.Vendedor || 'SISTEMA',
    Telefone_Principal: l.telefone_principal || l.Telefone_Principal || l.celular || l.CELULAR || '',
    ATIVOS: String(l.ativos || l.ATIVOS || '0'),
    NOME: l.nome || l.NOME || '',
    CPF: l.cpf || l.CPF || '',
    RG: l.rg || l.RG || '',
    CELULAR: l.celular || l.CELULAR || l.telefone_principal || l.Telefone_Principal || '',
    EMAIL: l.email || l.EMAIL || '',
    NOME_02: l.nome_02 || l.NOME_02 || '',
    CPF_02: l.cpf_02 || l.CPF_02 || '',
    RG_02: l.rg_02 || l.RG_02 || '',
    CELULAR_02: l.celular_02 || l.CELULAR_02 || '',
    EMAIL_02: l.email_02 || l.EMAIL_02 || '',
    NOME_03: l.nome_03 || l.NOME_03 || '',
    CPF_03: l.cpf_03 || l.CPF_03 || '',
    RG_03: l.rg_03 || l.RG_03 || '',
    CELULAR_03: l.celular_03 || l.CELULAR_03 || '',
    EMAIL_03: l.email_03 || l.EMAIL_03 || '',
    NOME_04: l.nome_04 || l.NOME_04 || '',
    CPF_04: l.cpf_04 || l.CPF_04 || '',
    RG_04: l.rg_04 || l.RG_04 || '',
    CELULAR_04: l.celular_04 || l.CELULAR_04 || '',
    EMAIL_04: l.email_04 || l.EMAIL_04 || '',
    NOME_05: l.nome_05 || l.NOME_05 || '',
    CPF_05: l.cpf_05 || l.CPF_05 || '',
    RG_05: l.rg_05 || l.RG_05 || '',
    CELULAR_05: l.celular_05 || l.CELULAR_05 || '',
    EMAIL_05: l.email_05 || l.EMAIL_05 || '',
    valorTotalReceita: Number(l.valor_total_receita || l.valorTotalReceita || 0),
    dataFechamento: l.data_fechamento || l.dataFechamento || '',
    dataPortabilidade: l.data_portabilidade || l.dataPortabilidade || '',
    isPago: !!(l.is_pago || l.isPago),
    isPortado: !!(l.is_portado || l.isPortado),
    linhasDetalhas: l.linhas_detalhas || l.linhasDetalhas || [],
    attachments: l.attachments || [],
    notes: l.notes || [],
    isFromClosedTable
});

export const normalizeUserStatus = (s?: any) => {
    if (!s) return UserStatus.ACTIVE;
    const str = String(s).toUpperCase().trim();
    if (str === 'ATIVO' || str === 'ACTIVE' || str === 'TRUE' || str === 'AUTORIZADO') return UserStatus.ACTIVE;
    if (str === 'BLOQUEADO' || str === 'BLOCKED' || str === 'DESATIVADO' || str === 'DESATIVADA') return UserStatus.BLOCKED;
    if (str === 'PENDENTE' || str === 'PENDING') return UserStatus.PENDING;
    return UserStatus.ACTIVE;
};

const mapDbToProfile = (d: any) => {
    let rawAvatar = d.avatar_url || d.avatar;
    if (rawAvatar && typeof rawAvatar === 'string' && rawAvatar.trim().startsWith('https://imgur.com/')) {
        const id = rawAvatar.trim().replace('https://imgur.com/', '');
        if (id && !id.includes('.')) {
            rawAvatar = `https://i.imgur.com/${id}.png`;
        }
    }
    const nameLower = String(d.full_name || d.name || '').toLowerCase();
    const emailLower = String(d.email || '').toLowerCase();
    if ((nameLower.includes('yasmin') || emailLower.includes('yasmin')) && (!rawAvatar || rawAvatar.includes('ui-avatars.com'))) {
        rawAvatar = 'https://i.imgur.com/m4WqE5P.png';
    }
    const rawCreatedAt = d.created_at || d.createdAt;
    let rawAdmission = d.admission_date || d.admissionDate;
    if (!rawAdmission && typeof window !== 'undefined') {
        try {
            const cached = JSON.parse(localStorage.getItem('vecgroup_user_admission_dates') || '{}');
            rawAdmission = cached[d.id] || cached[d.email?.toLowerCase().trim()];
        } catch (_) {}
    }
    const rawFullName = d.full_name || d.name || '';
    const cleanName = rawFullName.toUpperCase().trim() === 'MARIABONINI' ? 'MARIA BONINI' : rawFullName;
    return {
        id: d.id,
        name: cleanName,
        email: d.email,
        role: normalizeRole(d.role),
        status: normalizeUserStatus(d.status),
        avatar: rawAvatar,
        phone: d.phone,
        birthDate: d.birth_date,
        createdAt: rawCreatedAt ? String(rawCreatedAt).split('T')[0] : undefined,
        admissionDate: rawAdmission ? String(rawAdmission).split('T')[0] : (rawCreatedAt ? String(rawCreatedAt).split('T')[0] : undefined)
    };
};

// Controllers de cancelamento para garantir que nunca rodem duas buscas de telefone em paralelo no Supabase
let activeLeadsPhoneAbortController: AbortController | null = null;
let activeClosedPhoneAbortController: AbortController | null = null;

const realSupabase = {
    auth: {
        signIn: async (email: string, password: string) => await supabaseClient.auth.signInWithPassword({ email, password }),
        signOut: async () => {
            clearStaleAuthTokens();
            return await supabaseClient.auth.signOut().catch(() => ({ error: null }));
        },
        getSession: async () => {
            try {
                return await supabaseClient.auth.getSession();
            } catch (err: any) {
                console.warn('[Auth] Exceção capturada em getSession:', err);
                return { data: { session: null }, error: err };
            }
        },
        getUser: async () => await supabaseClient.auth.getUser(),
        onAuthStateChange: (callback: any) => supabaseClient.auth.onAuthStateChange(callback),
        updatePassword: async (newPassword: string) => await supabaseClient.auth.updateUser({ password: newPassword })
    },
    punches: {
        upsert: async (p: any) => {
            try {
                console.log("Tentando upsert de ponto:", p);
                
                let formattedAttachment = p.medicalCertificateAttachment || null;
                if (formattedAttachment && typeof formattedAttachment === 'object') {
                    try {
                        formattedAttachment = JSON.stringify(formattedAttachment);
                    } catch (e) {
                        formattedAttachment = null;
                    }
                }

                const payload: any = { 
                    id: p.id, 
                    user_id: p.userId, 
                    user_name: p.userName, 
                    user_avatar: p.userAvatar, 
                    date: p.date, 
                    entry: p.entry, 
                    lunch_start: p.lunchStart, 
                    lunch_return: p.lunchReturn, 
                    exit: p.exit, 
                    morning_break_start: p.morningBreakStart || null,
                    morning_break_end: p.morningBreakEnd || null,
                    afternoon_break_start: p.afternoonBreakStart || null,
                    afternoon_break_end: p.afternoonBreakEnd || null,
                    status: p.status,
                    justification_reason: p.justificationReason || null,
                    has_medical_certificate: p.hasMedicalCertificate || false,
                    medical_certificate_attachment: formattedAttachment
                };

                let { data, error } = await supabaseClient.from('time_records').upsert(payload, { onConflict: 'id' });

                // Se houver qualquer erro no Supabase (colunas ausentes, RLS, etc.)
                if (error) {
                    console.warn("Aviso ao salvar no Supabase, tentando campos base de ponto:", error.message || error);
                    const basePayload = {
                        id: p.id, 
                        user_id: p.userId, 
                        user_name: p.userName, 
                        user_avatar: p.userAvatar, 
                        date: p.date, 
                        entry: p.entry, 
                        lunch_start: p.lunchStart, 
                        lunch_return: p.lunchReturn, 
                        exit: p.exit, 
                        status: p.status
                    };
                    const fallbackRes = await supabaseClient.from('time_records').upsert(basePayload, { onConflict: 'id' });
                    if (!fallbackRes.error) {
                        return { data: fallbackRes.data, error: null };
                    } else {
                        console.warn("Aviso ao salvar ponto no Supabase (mantendo backup local):", fallbackRes.error.message);
                    }
                }

                return { data, error: null };
            } catch (err) {
                console.warn("Exceção ao salvar ponto (mantendo backup local):", err);
                return { data: null, error: null };
            }
        },
        getAll: async () => { 
            try {
                const { data, error } = await supabaseClient.from('time_records').select('*').order('date', { ascending: false }); 
                if (error) {
                    console.warn("Aviso ao buscar pontos do Supabase (utilizando backup local se disponível):", error.message || error);
                }
                return { 
                    data: data ? data.map(p => {
                        let parsedAttachment = p.medical_certificate_attachment || p.medicalCertificateAttachment || undefined;
                        if (typeof parsedAttachment === 'string') {
                            try {
                                if (parsedAttachment.trim().startsWith('{')) {
                                    parsedAttachment = JSON.parse(parsedAttachment);
                                }
                            } catch (e) {
                                // mantemos a string se falhar o parse
                            }
                        }
                        const cleanDate = p.date ? String(p.date).trim().split('T')[0] : p.date;
                        return {
                            id: p.id, 
                            userId: p.user_id || p.userId || p.user_email || p.email, 
                            userName: p.user_name || p.userName || p.name, 
                            userAvatar: p.user_avatar || p.userAvatar, 
                            date: cleanDate, 
                            entry: p.entry, 
                            lunchStart: p.lunch_start || p.lunchStart, 
                            lunchReturn: p.lunch_return || p.lunchReturn, 
                            exit: p.exit, 
                            morningBreakStart: p.morning_break_start || p.morningBreakStart || undefined,
                            morningBreakEnd: p.morning_break_end || p.morningBreakEnd || undefined,
                            afternoonBreakStart: p.afternoon_break_start || p.afternoonBreakStart || undefined,
                            afternoonBreakEnd: p.afternoon_break_end || p.afternoonBreakEnd || undefined,
                            status: p.status,
                            justificationReason: p.justification_reason || p.justificationReason || undefined,
                            hasMedicalCertificate: p.has_medical_certificate ?? p.hasMedicalCertificate ?? false,
                            medicalCertificateAttachment: parsedAttachment
                        };
                    }) : [], 
                    error: null 
                };
            } catch (err) {
                console.warn("Exceção ao buscar pontos:", err);
                return { data: [], error: null };
            }
        }
    },
    activities: {
        insert: async (activity: any) => {
            try { return await supabaseClient.from('activities').insert({ user_name: activity.userName, action: activity.action, target: activity.target }); } catch (err) { return { error: err as any }; }
        },
        getAll: async () => {
            try {
                const { data, error } = await supabaseClient.from('activities').select('*').order('created_at', { ascending: false }).limit(20);
                return { data: data ? data.map(a => ({ id: a.id, userName: a.user_name, action: a.action, target: a.target, timestamp: 'Recentemente' })) : [], error };
            } catch (err) {
                console.warn("Exceção ao buscar atividades:", err);
                return { data: [], error: err as any };
            }
        }
    },
    goals: {
        upsert: async (goal: any) => {
            try { return await supabaseClient.from('goals').upsert({ id: goal.id, title: goal.title, start_date: goal.startDate, end_date: goal.endDate, target_type: goal.targetType, objective: goal.objective, assigned_to: goal.assignedTo, current_progress: goal.currentProgress, is_completed: goal.isCompleted }); } catch (err) { return { error: err as any }; }
        },
        getAll: async () => {
            try {
                const { data, error } = await supabaseClient.from('goals').select('*').order('created_at', { ascending: false });
                return { data: data ? data.map(g => ({ id: g.id, title: g.title, startDate: g.start_date, endDate: g.end_date, targetType: g.target_type, objective: g.objective, assignedTo: g.assigned_to, currentProgress: g.current_progress, isCompleted: g.is_completed })) : [], error };
            } catch (err) {
                console.warn("Exceção ao buscar metas:", err);
                return { data: [], error: err as any };
            }
        },
        delete: async (id: string) => {
            try { return await supabaseClient.from('goals').delete().eq('id', id); } catch (err) { return { error: err as any }; }
        }
    },
    tickets: {
        upsert: async (ticket: any) => {
            try { return await supabaseClient.from('tickets').upsert({ id: ticket.id, lead_id: ticket.leadId, razao_social: ticket.razaoSocial, cnpj: ticket.cnpj, requester_id: ticket.requesterId, requester_name: ticket.requesterName, login: ticket.login, password: ticket.password, description: ticket.description, selected_lines: ticket.selectedLines, status: ticket.status, created_at: ticket.createdAt, deadline_at: ticket.deadlineAt, notes: ticket.notes, attachments: ticket.attachments || [] }); } catch (err) { return { error: err as any }; }
        },
        getAll: async (limit?: number) => { 
            try {
                const query = supabaseClient.from('tickets').select('*').order('created_at', { ascending: false });
                if (limit) query.limit(limit);
                const { data, error } = await query;
                return { data: data ? data.map(t => ({ id: t.id, leadId: t.lead_id, razaoSocial: t.razao_social, cnpj: t.cnpj, requesterId: t.requester_id, requesterName: t.requester_name, login: t.login, password: t.password, description: t.description || '', selectedLines: t.selected_lines || [], status: t.status, createdAt: t.created_at, deadlineAt: t.deadline_at, notes: t.notes || [], attachments: t.attachments || [] })) : [], error }; 
            } catch (err) {
                console.warn("Exceção ao buscar chamados:", err);
                return { data: [], error: err as any };
            }
        },
        delete: async (id: string) => {
            try { return await supabaseClient.from('tickets').delete().eq('id', id); } catch (err) { return { error: err as any }; }
        }
    },
    leads: {
        upsert: async (data: any) => {
            try { return await leadsClient.from('leads').upsert(mapLeadToDb(data), { onConflict: 'id' }); } catch (err) { return { error: err as any }; }
        },
        delete: async (id: string) => {
            try { return await leadsClient.from('leads').delete().eq('id', id); } catch (err) { return { error: err as any }; }
        },
        deleteBulk: async (ids: string[]) => {
            try { return await leadsClient.from('leads').delete().in('id', ids); } catch (err) { return { error: err as any }; }
        },
        getAll: async (limit?: number) => {
            try {
                if (limit) {
                    const { data, error } = await leadsClient.from('leads').select('*').limit(limit).order('created_at', { ascending: false });
                    return { data: data ? data.map(l => mapDbToLead(l, false)) : [], error };
                }
                let allData: any[] = [];
                let rangeStart = 0;
                const PAGE_SIZE = 1000;
                const MAX_PAGES = 5;
                let pageCount = 0;
                while (pageCount < MAX_PAGES) {
                    const { data, error } = await leadsClient.from('leads').select('*').range(rangeStart, rangeStart + PAGE_SIZE - 1);
                    if (error) return { data: [], error };
                    if (!data || data.length === 0) break;
                    allData.push(...data.map(l => mapDbToLead(l, false)));
                    if (data.length < PAGE_SIZE) break;
                    rangeStart += PAGE_SIZE;
                    pageCount++;
                }
                return { data: allData, error: null };
            } catch (err) {
                console.warn("Exceção ao buscar leads:", err);
                return { data: [], error: err as any };
            }
        },
        getCount: async () => {
            try { const { count, error } = await leadsClient.from('leads').select('*', { count: 'planned', head: true }); return { count: count || 0, error }; } catch (err) { return { count: 0, error: err as any }; }
        },
        search: async (term: string) => {
            try {
                const { data, error } = await leadsClient.from('leads')
                    .select('*')
                    .or(`razao_social.ilike.%${term}%,cnpj.ilike.%${term}%`)
                    .limit(20);
                return { data: data ? data.map(l => mapDbToLead(l, false)) : [], error };
            } catch (err) {
                return { data: [], error: err as any };
            }
        },
        searchByPhone: async (options: {
            phone: string;
            status?: string;
            assignedTo?: string;
            vendedorName?: string;
            signal?: AbortSignal;
            limit?: number;
        }) => {
            const { phone, status, assignedTo, vendedorName, signal, limit = 50 } = options;
            const cleanDigits = String(phone || '').replace(/\D/g, '');
            if (cleanDigits.length < 8) {
                return { data: [], count: 0, error: null };
            }

            // Cancela imediatamente qualquer busca de telefone anterior na tabela leads
            if (activeLeadsPhoneAbortController) {
                try { activeLeadsPhoneAbortController.abort('Nova busca iniciada'); } catch (_) {}
                activeLeadsPhoneAbortController = null;
            }

            const localController = new AbortController();
            activeLeadsPhoneAbortController = localController;

            if (signal) {
                if (signal.aborted) {
                    localController.abort();
                    if (activeLeadsPhoneAbortController === localController) {
                        activeLeadsPhoneAbortController = null;
                    }
                    return { data: [], count: 0, error: null, aborted: true };
                }
                signal.addEventListener('abort', () => {
                    try { localController.abort(); } catch (_) {}
                }, { once: true });
            }

            try {
                // Contagem: count: 'planned' para não disparar varredura completa lenta
                let query = leadsClient.from('leads')
                    .select('*', { count: 'planned' })
                    .or(`telefone_principal.ilike.%${cleanDigits}%,celular.ilike.%${cleanDigits}%,celular_02.ilike.%${cleanDigits}%,celular_03.ilike.%${cleanDigits}%,celular_04.ilike.%${cleanDigits}%,celular_05.ilike.%${cleanDigits}%`);

                // Filtro de vendedor: quando houver assigned_to, filtrar SÓ por assigned_to = id (sem o OR vendedor ilike).
                // Use o filtro por nome apenas para leads antigos que não têm assigned_to.
                if (assignedTo && assignedTo.trim()) {
                    query = query.eq('assigned_to', assignedTo.trim());
                } else if (vendedorName && vendedorName.trim()) {
                    query = query.is('assigned_to', null).ilike('vendedor', `%${vendedorName.trim()}%`);
                }

                // Status: valor exato com .eq, nunca ilike
                if (status && status.trim()) {
                    query = query.eq('status', status.trim());
                }

                if (limit) {
                    query = query.limit(limit);
                }

                query = query.abortSignal(localController.signal);

                const { data, count, error } = await query;
                if (error) {
                    if ((error as any).name === 'AbortError' || (error as any).message?.includes('aborted')) {
                        return { data: [], count: 0, error: null, aborted: true };
                    }
                    return { data: [], count: 0, error };
                }

                return {
                    data: data ? data.map(l => mapDbToLead(l, false)) : [],
                    count: count || 0,
                    error: null
                };
            } catch (err: any) {
                if (err?.name === 'AbortError' || err?.message?.includes('aborted')) {
                    return { data: [], count: 0, error: null, aborted: true };
                }
                console.warn("Exceção ao buscar lead por telefone:", err);
                return { data: [], count: 0, error: err };
            } finally {
                if (activeLeadsPhoneAbortController === localController) {
                    activeLeadsPhoneAbortController = null;
                }
            }
        }
    },
    clientes_fechados: {
        upsert: async (data: any) => {
            try { return await leadsClient.from('leads_fechados').upsert(mapLeadToDb(data), { onConflict: 'id' }); } catch (err) { return { error: err as any }; }
        },
        delete: async (id: string) => {
            try { return await leadsClient.from('leads_fechados').delete().eq('id', id); } catch (err) { return { error: err as any }; }
        },
        deleteBulk: async (ids: string[]) => {
            try { return await leadsClient.from('leads_fechados').delete().in('id', ids); } catch (err) { return { error: err as any }; }
        },
        getAll: async (limit?: number) => {
            try {
                if (limit) {
                    const { data, error } = await leadsClient.from('leads_fechados').select('*').limit(limit).order('id', { ascending: false });
                    return { data: data ? data.map(l => mapDbToLead(l, true)) : [], error };
                }
                let allData: any[] = [];
                let rangeStart = 0;
                const PAGE_SIZE = 1000;
                const MAX_PAGES = 5;
                let pageCount = 0;
                while (pageCount < MAX_PAGES) {
                    const { data, error } = await leadsClient.from('leads_fechados').select('*').range(rangeStart, rangeStart + PAGE_SIZE - 1);
                    if (error) return { data: [], error };
                    if (!data || data.length === 0) break;
                    allData.push(...data.map(l => mapDbToLead(l, true)));
                    if (data.length < PAGE_SIZE) break;
                    rangeStart += PAGE_SIZE;
                    pageCount++;
                }
                return { data: allData, error: null };
            } catch (err) {
                console.warn("Exceção ao buscar clientes fechados:", err);
                return { data: [], error: err as any };
            }
        },
        getCount: async () => {
            try { const { count, error } = await leadsClient.from('leads_fechados').select('*', { count: 'planned', head: true }); return { count: count || 0, error }; } catch (err) { return { count: 0, error: err as any }; }
        },
        searchByPhone: async (options: {
            phone: string;
            status?: string;
            assignedTo?: string;
            vendedorName?: string;
            signal?: AbortSignal;
            limit?: number;
        }) => {
            const { phone, status, assignedTo, vendedorName, signal, limit = 50 } = options;
            const cleanDigits = String(phone || '').replace(/\D/g, '');
            if (cleanDigits.length < 8) {
                return { data: [], count: 0, error: null };
            }

            // Cancela imediatamente qualquer busca de telefone anterior na tabela leads_fechados
            if (activeClosedPhoneAbortController) {
                try { activeClosedPhoneAbortController.abort('Nova busca iniciada'); } catch (_) {}
                activeClosedPhoneAbortController = null;
            }

            const localController = new AbortController();
            activeClosedPhoneAbortController = localController;

            if (signal) {
                if (signal.aborted) {
                    localController.abort();
                    if (activeClosedPhoneAbortController === localController) {
                        activeClosedPhoneAbortController = null;
                    }
                    return { data: [], count: 0, error: null, aborted: true };
                }
                signal.addEventListener('abort', () => {
                    try { localController.abort(); } catch (_) {}
                }, { once: true });
            }

            try {
                // Contagem: count: 'planned' para não disparar varredura completa lenta
                let query = leadsClient.from('leads_fechados')
                    .select('*', { count: 'planned' })
                    .or(`telefone_principal.ilike.%${cleanDigits}%,celular.ilike.%${cleanDigits}%,celular_02.ilike.%${cleanDigits}%,celular_03.ilike.%${cleanDigits}%,celular_04.ilike.%${cleanDigits}%,celular_05.ilike.%${cleanDigits}%`);

                // Filtro de vendedor: quando houver assigned_to, filtrar SÓ por assigned_to = id (sem o OR vendedor ilike).
                // Use o filtro por nome apenas para leads antigos que não têm assigned_to.
                if (assignedTo && assignedTo.trim()) {
                    query = query.eq('assigned_to', assignedTo.trim());
                } else if (vendedorName && vendedorName.trim()) {
                    query = query.is('assigned_to', null).ilike('vendedor', `%${vendedorName.trim()}%`);
                }

                // Status: valor exato com .eq, nunca ilike
                if (status && status.trim()) {
                    query = query.eq('status', status.trim());
                }

                if (limit) {
                    query = query.limit(limit);
                }

                query = query.abortSignal(localController.signal);

                const { data, count, error } = await query;
                if (error) {
                    if ((error as any).name === 'AbortError' || (error as any).message?.includes('aborted')) {
                        return { data: [], count: 0, error: null, aborted: true };
                    }
                    return { data: [], count: 0, error };
                }

                return {
                    data: data ? data.map(l => mapDbToLead(l, true)) : [],
                    count: count || 0,
                    error: null
                };
            } catch (err: any) {
                if (err?.name === 'AbortError' || err?.message?.includes('aborted')) {
                    return { data: [], count: 0, error: null, aborted: true };
                }
                console.warn("Exceção ao buscar cliente fechado por telefone:", err);
                return { data: [], count: 0, error: err };
            } finally {
                if (activeClosedPhoneAbortController === localController) {
                    activeClosedPhoneAbortController = null;
                }
            }
        }
    },
    stats: {
        getCountsByStatus: async (table: 'leads' | 'clientes_fechados', statuses: string[]) => {
            const results: Record<string, number> = {};
            try {
                await Promise.all(statuses.map(async (status) => {
                    try {
                        const { count } = await leadsClient.from(table).select('*', { count: 'planned', head: true }).eq('status', status);
                        results[status] = count || 0;
                    } catch (e) {
                        results[status] = 0;
                    }
                }));
            } catch (e) {
                console.warn("Exceção em getCountsByStatus:", e);
            }
            return results;
        },
        getSumByStatus: async (table: 'leads' | 'clientes_fechados', statuses: string[]) => {
            const results: Record<string, number> = {};
            try {
                await Promise.all(statuses.map(async (status) => {
                    try {
                        const { data } = await leadsClient.from(table).select('valor_total_receita').eq('status', status);
                        const sum = data?.reduce((acc, curr) => acc + (Number(curr.valor_total_receita) || 0), 0) || 0;
                        results[status] = sum;
                    } catch (e) {
                        results[status] = 0;
                    }
                }));
            } catch (e) {
                console.warn("Exceção em getSumByStatus:", e);
            }
            return results;
        },
        getSumAtivos: async (table: 'leads' | 'clientes_fechados') => {
            try {
                const { data, error } = await leadsClient.from(table).select('ativos');
                if (error) return 0;
                return data?.reduce((acc, curr) => acc + (parseInt(curr.ativos || '0') || 0), 0) || 0;
            } catch (e) {
                return 0;
            }
        }
    },
    users: {
        getProfile: async (userId: string, email?: string) => {
            console.log(`[Supabase] getProfile: userId=${userId}, email=${email}`);
            try {
                const { data, error } = await supabaseClient
                    .from('profiles')
                    .select('*')
                    .eq('id', userId)
                    .maybeSingle();

                if (error) {
                    console.warn(`[Supabase] Erro ao buscar perfil por ID (${userId}):`, error.message || error);
                    return { data: null, error };
                }

                if (data) {
                    console.log(`[Supabase] Perfil encontrado por ID:`, data.email);
                    return { data: mapDbToProfile(data), error: null };
                }

                console.log(`[Supabase] Nenhum perfil encontrado para o ID: ${userId}`);
                return { data: null, error: null };
            } catch (err: any) {
                console.warn("[Supabase] Exceção ao buscar perfil por ID:", err);
                return { data: null, error: err };
            }
        },
        checkEmailExists: async (email: string) => {
            try {
                const normalizedEmail = email.toLowerCase().trim();
                const { data, error } = await supabaseClient
                    .from('profiles')
                    .select('*')
                    .eq('email', normalizedEmail)
                    .maybeSingle();

                if (error) {
                    console.warn(`[Supabase] Erro ao verificar existência por email (${normalizedEmail}):`, error.message || error);
                    return { data: null, error };
                }

                return { data: data ? mapDbToProfile(data) : null, error: null };
            } catch (err: any) {
                console.warn("[Supabase] Exceção ao verificar perfil por email:", err);
                return { data: null, error: err };
            }
        },
        linkProfile: async (oldId: string, newId: string) => {
            // This updates the ID of an existing profile to match a new Auth ID
            // Useful when Auth is reset but profiles remain
            return await supabaseClient.from('profiles').update({ id: newId }).eq('id', oldId);
        },
        getAll: async () => {
            try {
                const { data, error } = await supabaseClient.from('profiles').select('*');
                if (error) return { data: [], error };

                // Deduplicate by email and id in the result set
                const uniqueMap = new Map<string, any>();
                data?.forEach(profile => {
                    const email = profile.email?.toLowerCase().trim();
                    const id = profile.id;
                    const isDuplicate = Array.from(uniqueMap.values()).some(existing => 
                        (id && existing.id === id) || (email && existing.email?.toLowerCase().trim() === email)
                    );
                    if (!isDuplicate) {
                        uniqueMap.set(id || email || String(Math.random()), profile);
                    }
                });

                // Garantir que a consultora Yasmin Vitória esteja na lista se ainda não estiver no banco
                const yasminEmail = 'yasminvitoria@vecgroup.com.br';
                const hasYasminInDb = Array.from(uniqueMap.values()).some(p => 
                    p.email?.toLowerCase().trim() === yasminEmail ||
                    p.full_name?.toLowerCase().includes('yasmin') ||
                    p.name?.toLowerCase().includes('yasmin')
                );

                if (!hasYasminInDb) {
                    const yasminProfile = {
                        id: 'yasminvitoria-user-id',
                        full_name: 'YASMIN VITÓRIA',
                        name: 'YASMIN VITÓRIA',
                        email: yasminEmail,
                        role: 'VENDEDOR',
                        status: 'ATIVO',
                        department: 'GERAL',
                        avatar_url: 'https://i.imgur.com/m4WqE5P.png'
                    };
                    uniqueMap.set(yasminEmail, yasminProfile);

                    // Tenta persistir no Supabase em segundo plano
                    supabaseClient.from('profiles').upsert(yasminProfile, { onConflict: 'email' }).catch(() => {});
                }

                const deduplicatedData = Array.from(uniqueMap.values());

                return {
                    data: deduplicatedData.map(mapDbToProfile),
                    error: null
                };
            } catch (err) {
                console.warn("Exceção ao buscar perfis de usuários:", err);
                return { data: [], error: err as any };
            }
        },
        upsert: async (user: any) => {
            try {
                const normalizedEmail = user.email?.toLowerCase().trim();
                const admissionDate = user.admissionDate || user.admission_date || user.createdAt || user.created_at;
                const payload: any = { 
                    id: user.id, 
                    full_name: user.name, 
                    email: normalizedEmail, 
                    role: user.role, 
                    avatar_url: user.avatar,
                    phone: user.phone,
                    birth_date: user.birthDate || user.birth_date,
                    status: user.status || UserStatus.ACTIVE
                };

                // Also cache admission date in localStorage for resilience
                try {
                    const userKey = user.id || normalizedEmail;
                    if (userKey && admissionDate) {
                        const cached = JSON.parse(localStorage.getItem('vecgroup_user_admission_dates') || '{}');
                        cached[userKey] = String(admissionDate).split('T')[0];
                        localStorage.setItem('vecgroup_user_admission_dates', JSON.stringify(cached));
                    }
                } catch (e) {}
                
                console.log("Iniciando upsert do perfil para:", normalizedEmail);

                // Check if there are other profiles with the same email but different ID
                try {
                    const { data: existingWithEmail } = await supabaseClient
                        .from('profiles')
                        .select('id')
                        .ilike('email', normalizedEmail)
                        .neq('id', payload.id);

                    if (existingWithEmail && existingWithEmail.length > 0) {
                        console.log(`Found ${existingWithEmail.length} duplicate profiles for ${normalizedEmail}. Deleting them before upsert.`);
                        for (const existing of existingWithEmail) {
                            await supabaseClient.from('profiles').delete().eq('id', existing.id);
                        }
                    }
                } catch (dupErr) {
                    console.warn("Aviso ao verificar duplicados de perfil:", dupErr);
                }
                
                let { data, error } = await supabaseClient
                    .from('profiles')
                    .upsert(payload, { onConflict: 'id' })
                    .select();

                // Se o upsert der erro, tenta novamente removendo o campo "avatar" do payload (mantendo avatar_url)
                if (error && 'avatar' in payload) {
                    console.warn("Aviso no upsert de perfil, tentando novamente sem coluna 'avatar':", error.message || error);
                    delete payload.avatar;
                    const retryRes = await supabaseClient
                        .from('profiles')
                        .upsert(payload, { onConflict: 'id' })
                        .select();
                    data = retryRes.data;
                    error = retryRes.error;
                }

                if (error && payload.admission_date) {
                    // If admission_date column doesn't exist in Supabase profiles table, fallback to payload without it
                    delete payload.admission_date;
                    const retryRes = await supabaseClient
                        .from('profiles')
                        .upsert(payload, { onConflict: 'id' })
                        .select();
                    data = retryRes.data;
                    error = retryRes.error;
                }

                if (error) {
                    console.warn("Aviso detalhado no Upsert:", error);
                } else {
                    console.log("Upsert concluído com sucesso.");
                }
                
                return { data, error };
            } catch (err) {
                console.warn("Exceção capturada em users.upsert:", err);
                return { data: null, error: err as any };
            }
        },
        delete: async (id: string) => {
            try {
                return await supabaseClient.from('profiles').delete().eq('id', id);
            } catch (err) {
                console.warn("Exceção em users.delete:", err);
                return { error: err as any };
            }
        },
        createAdminUser: async (user: {
            name: string;
            email: string;
            password: string;
            role?: string;
            phone?: string;
            birthDate?: string;
            admissionDate?: string;
            status?: string;
            avatar?: string;
        }, requester?: { role?: string; email?: string }) => {
            try {
                const res = await fetch('/api/admin/users', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'x-user-role': requester?.role || '',
                        'x-user-email': requester?.email || ''
                    },
                    body: JSON.stringify({ ...user, requesterRole: requester?.role, requesterEmail: requester?.email })
                });
                const json = await res.json();
                if (!res.ok) {
                    return { data: null, error: new Error(json.error || json.message || 'Erro ao criar usuário no Supabase') };
                }
                return { data: json.user, error: null };
            } catch (err: any) {
                return { data: null, error: err };
            }
        },
        deleteAdminUser: async (id: string, requester?: { role?: string; email?: string }) => {
            try {
                const res = await fetch(`/api/admin/users/${id}`, {
                    method: 'DELETE',
                    headers: {
                        'x-user-role': requester?.role || '',
                        'x-user-email': requester?.email || ''
                    }
                });
                const json = await res.json();
                if (!res.ok) {
                    return { error: new Error(json.error || 'Erro ao excluir usuário') };
                }
                return { data: json, error: null };
            } catch (err: any) {
                return { error: err };
            }
        },
        updateAdminUser: async (id: string, user: any, requester?: { role?: string; email?: string }) => {
            try {
                const res = await fetch(`/api/admin/users/${id}`, {
                    method: 'PUT',
                    headers: { 
                        'Content-Type': 'application/json',
                        'x-user-role': requester?.role || '',
                        'x-user-email': requester?.email || ''
                    },
                    body: JSON.stringify({ ...user, requesterRole: requester?.role, requesterEmail: requester?.email })
                });
                const json = await res.json();
                if (!res.ok) {
                    return { error: new Error(json.error || 'Erro ao atualizar usuário') };
                }
                return { data: json, error: null };
            } catch (err: any) {
                return { error: err };
            }
        },
        checkAdminConfig: async () => {
            try {
                const res = await fetch('/api/admin/status');
                return await res.json();
            } catch (err) {
                return { hasServiceRoleKey: false, supabaseUrl: PRIMARY_URL };
            }
        },
        saveAdminKey: async (serviceRoleKey: string) => {
            try {
                const res = await fetch('/api/admin/config', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ serviceRoleKey })
                });
                const json = await res.json();
                if (!res.ok) {
                    return { error: new Error(json.error || 'Erro ao validar chave') };
                }
                return { data: json, error: null };
            } catch (err: any) {
                return { error: err };
            }
        },
        changePasswordAsAdmin: async (id: string, newPassword: string, requesterEmail: string) => {
            try {
                const res = await fetch(`/api/admin/users/${id}/change-password`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'x-user-email': requesterEmail 
                    },
                    body: JSON.stringify({ password: newPassword, requesterEmail })
                });
                const json = await res.json();
                if (!res.ok) {
                    return { error: new Error(json.error || 'Erro ao alterar senha do colaborador') };
                }
                return { data: json, error: null };
            } catch (err: any) {
                return { error: err };
            }
        }
    },
    chips: {
        saveDevices: async (devices: any[]) => { 
            try {
                await supabaseClient.from('chip_devices').delete().neq('id', '0'); 
                
                if (devices.length === 0) return { data: [], error: null };

                const { data, error } = await supabaseClient.from('chip_devices').insert(
                    devices.map(d => ({ 
                        id: d.id, 
                        name: d.name, 
                        lines: d.lines 
                    }))
                );
                return { data, error };
            } catch (err: any) {
                console.warn("Erro ao salvar dispositivos:", err);
                return { data: null, error: err };
            }
        },
        getDevices: async () => {
            try {
                const { data, error } = await supabaseClient.from('chip_devices').select('*').order('created_at', { ascending: true });
                if (error) console.warn("Aviso ao buscar dispositivos no Supabase:", error);
                return { data: data || [], error };
            } catch (err) {
                console.warn("Exceção ao buscar dispositivos:", err);
                return { data: [], error: err as any };
            }
        }
    },
    proposals: {
        saveSettings: async (settings: any) => {
            try {
                return await supabaseClient.from('crm_settings').upsert({ id: 'proposal_settings', settings }, { onConflict: 'id' });
            } catch (e) {
                return { error: e as any };
            }
        },
        getSettings: async () => { 
            try {
                const { data } = await supabaseClient.from('crm_settings').select('settings').eq('id', 'proposal_settings').maybeSingle(); 
                return { data: data ? data.settings : null }; 
            } catch (e) {
                return { data: null, error: e as any };
            }
        },
        saveContractLogo: async (logo: string) => {
            try {
                return await supabaseClient.from('crm_settings').upsert({ setting_key: 'contract_logo', setting_value: logo }, { onConflict: 'setting_key' });
            } catch (e) {
                return { error: e as any };
            }
        },
        getContractLogo: async () => { 
            try {
                const { data } = await supabaseClient.from('crm_settings')
                    .select('setting_value')
                    .eq('setting_key', 'contract_logo')
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle(); 
                return { data: data ? data.setting_value : null }; 
            } catch (e) {
                return { data: null, error: e as any };
            }
        },
        saveSystemLogo: async (logo: string) => {
            try {
                localStorage.setItem('vec_crm_system_logo', logo);
                const { data, error } = await supabaseClient.from('crm_settings').upsert(
                    { setting_key: 'system_logo', setting_value: logo },
                    { onConflict: 'setting_key' }
                ).select();
                
                if (error) console.warn("Aviso Supabase ao salvar logo:", error);
                return { data, error };
            } catch (e) {
                console.warn("Exceção ao salvar logo:", e);
                return { data: null, error: e as any };
            }
        },
        getSystemLogo: async () => { 
            try {
                const { data, error } = await supabaseClient.from('crm_settings')
                    .select('setting_value')
                    .eq('setting_key', 'system_logo')
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle(); 
                
                const localFallback = localStorage.getItem('vec_crm_system_logo');
                if (data && data.setting_value) {
                    localStorage.setItem('vec_crm_system_logo', data.setting_value);
                    return { data: data.setting_value, error: null };
                }
                return { data: localFallback, error }; 
            } catch (e) {
                return { data: localStorage.getItem('vec_crm_system_logo'), error: e as any };
            }
        },
        saveSystemBackground: async (bg: string) => {
            try {
                localStorage.setItem('vec_crm_system_bg', bg);
                const { data, error } = await supabaseClient.from('crm_settings').upsert(
                    { setting_key: 'system_bg', setting_value: bg },
                    { onConflict: 'setting_key' }
                ).select();
                
                if (error) console.warn("Aviso Supabase ao salvar fundo:", error);
                return { data, error };
            } catch (e) {
                console.warn("Exceção ao salvar fundo:", e);
                return { data: null, error: e as any };
            }
        },
        getSystemBackground: async () => {
            try {
                const { data, error } = await supabaseClient.from('crm_settings')
                    .select('setting_value')
                    .eq('setting_key', 'system_bg')
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();
                
                const localFallback = localStorage.getItem('vec_crm_system_bg');
                if (data && data.setting_value) {
                    localStorage.setItem('vec_crm_system_bg', data.setting_value);
                    return { data: data.setting_value, error: null };
                }
                return { data: localFallback, error };
            } catch (e) {
                return { data: localStorage.getItem('vec_crm_system_bg'), error: e as any };
            }
        }
    },
    externalCrm: {
        getClosedLeads: async () => {
            try {
                const { data, error } = await externalCrmClient.from('leads_fechados').select('*');
                return { data: data || [], error };
            } catch (err) {
                return { data: [], error: err as any };
            }
        },
        getAllLeads: async () => {
            try {
                const { data, error } = await externalCrmClient.from('leads').select('*');
                return { data: data || [], error };
            } catch (err) {
                return { data: [], error: err as any };
            }
        }
    },
    migrarParaFechado: async (lead: any) => { 
        try {
            const { error: insertError } = await leadsClient.from('leads_fechados').upsert(mapLeadToDb(lead)); 
            if (insertError) return { error: insertError }; 
            return await leadsClient.from('leads').delete().eq('id', lead.id); 
        } catch (err) {
            return { error: err as any };
        }
    },
    migrarParaLeads: async (lead: any) => { 
        try {
            const { error: insertError } = await leadsClient.from('leads').upsert(mapLeadToDb(lead)); 
            if (insertError) return { error: insertError }; 
            return await leadsClient.from('leads_fechados').delete().eq('id', lead.id); 
        } catch (err) {
            return { error: err as any };
        }
    }
};

// =============================================================================
// MOCK CLIENT (MODO OFFLINE)
// =============================================================================
const mockSupabase = {
    auth: {
        signIn: async (email: any, password: any) => ({ data: { user: { id: 'mock-id', email } }, error: null }),
        signOut: async () => ({ error: null }),
        getSession: async () => ({ data: { session: { user: { id: 'mock-id', email: 'vinicius@ocomunicacao.com' } } }, error: null }),
        getUser: async () => ({ data: { user: { id: 'mock-id', email: 'vinicius@ocomunicacao.com' } }, error: null }),
        onAuthStateChange: (callback: any) => {
            callback('SIGNED_IN', { user: { id: 'mock-id', email: 'vinicius@ocomunicacao.com' } });
            return { data: { subscription: { unsubscribe: () => {} } } };
        },
        updatePassword: async () => ({ error: null })
    },
    punches: {
        upsert: async (p: any) => ({ data: p, error: null }),
        getAll: async () => ({ data: [], error: null })
    },
    activities: {
        insert: async () => ({ error: null }),
        getAll: async () => ({ data: [], error: null })
    },
    goals: {
        upsert: async (g: any) => ({ data: g, error: null }),
        getAll: async () => ({ data: [], error: null }),
        delete: async () => ({ error: null })
    },
    tickets: {
        upsert: async (t: any) => ({ data: t, error: null }),
        getAll: async () => ({ data: [], error: null }),
        delete: async () => ({ error: null })
    },
    leads: {
        upsert: async (l: any) => ({ data: l, error: null }),
        delete: async () => ({ error: null }),
        deleteBulk: async () => ({ error: null }),
        getAll: async () => ({ data: [], error: null }),
        getCount: async () => ({ count: 0, error: null }),
        search: async () => ({ data: [], error: null }),
        searchByPhone: async () => ({ data: [], count: 0, error: null })
    },
    clientes_fechados: {
        upsert: async (l: any) => ({ data: l, error: null }),
        delete: async () => ({ error: null }),
        deleteBulk: async () => ({ error: null }),
        getAll: async () => ({ data: [], error: null }),
        getCount: async () => ({ count: 0, error: null }),
        searchByPhone: async () => ({ data: [], count: 0, error: null })
    },
    stats: {
        getCountsByStatus: async () => ({}),
        getSumByStatus: async () => ({}),
        getSumAtivos: async () => 0
    },
    users: {
        getProfile: async (userId: string, email?: string) => ({ 
            data: { 
                id: userId, 
                name: 'Usuário Offline', 
                email: email || 'offline@example.com', 
                role: UserRole.OWNER, 
                status: UserStatus.ACTIVE 
            }, 
            error: null 
        }),
        checkEmailExists: async () => ({ data: null, error: null }),
        linkProfile: async () => ({ error: null }),
        getAll: async () => ({ data: [], error: null }),
        upsert: async (u: any) => ({ data: u, error: null }),
        delete: async () => ({ error: null }),
        createAdminUser: async () => ({ data: null, error: null }),
        deleteAdminUser: async () => ({ data: null, error: null }),
        updateAdminUser: async () => ({ data: null, error: null }),
        checkAdminConfig: async () => ({ hasServiceRoleKey: false, supabaseUrl: PRIMARY_URL }),
        saveAdminKey: async () => ({ data: null, error: null }),
        changePasswordAsAdmin: async () => ({ data: null, error: null })
    },
    chips: {
        saveDevices: async (d: any) => ({ data: d, error: null }),
        getDevices: async () => ({ data: [], error: null })
    },
    proposals: {
        saveSettings: async () => ({ error: null }),
        getSettings: async () => ({ data: null, error: null }),
        saveContractLogo: async () => ({ error: null }),
        getContractLogo: async () => ({ data: null, error: null }),
        saveSystemLogo: async () => ({ error: null }),
        getSystemLogo: async () => ({ data: null, error: null }),
        saveSystemBackground: async () => ({ error: null }),
        getSystemBackground: async () => ({ data: null, error: null })
    },
    externalCrm: {
        getClosedLeads: async () => ({ data: [], error: null }),
        getAllLeads: async () => ({ data: [], error: null })
    },
    migrarParaFechado: async () => ({ error: null }),
    migrarParaLeads: async () => ({ error: null })
};

// EXPORTAÇÃO FINAL (ONLINE OU OFFLINE)
export const supabase = IS_OFFLINE ? mockSupabase : realSupabase;
