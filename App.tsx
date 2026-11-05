
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  getNavItems
} from './constants';
import { User, UserRole, UserStatus, Lead, LeadStatus, Goal, Activity, Ticket, TicketStatus, AccessRequest } from './types';
import Dashboard from './components/Dashboard';
import UsersManagement from './components/UsersManagement';
import Tools from './components/Tools';
import Settings from './components/Settings';
import GoalFloatingWidget from './components/GoalFloatingWidget';
import BirthdayCelebrationModal from './components/BirthdayCelebrationModal';
import TicketNotificationModal from './components/TicketNotificationModal';
import TicketsManagement from './components/TicketsManagement';
import GoalCelebrationModal from './components/GoalCelebrationModal';
import ClosedLeadsManagement from './components/ClosedLeadsManagement';
import LeadsManagement from './components/LeadsManagement';
import WhatsAppCRM from './components/WhatsAppCRM';
import EmbeddedPortal from './components/EmbeddedPortal';
import { LogOut, Clock, Mail, ArrowRight, Loader2, Key, RefreshCw, CheckCircle2, ExternalLink, Menu, X, ChevronRight, ChevronLeft, LifeBuoy, Shield, LayoutDashboard, Lock, Handshake, Users as UsersIcon } from 'lucide-react';
import { supabase, supabaseClient, clearStaleAuthTokens, buildSSOUrl } from './lib/supabase';

// Altere estas URLs para os links das suas imagens (ex: https://site.com/imagem.png)
const HARDCODED_LOGO_URL = "https://i.imgur.com/QZWx8RN.png"; 
const HARDCODED_BACKGROUND_URL = "https://i.imgur.com/2C61LGh.png"; 

const VecLogo: React.FC<{ className?: string, logoUrl?: string | null, collapsed?: boolean }> = ({ className, logoUrl, collapsed }) => {
  const finalLogoUrl = HARDCODED_LOGO_URL || logoUrl;
  
  if (finalLogoUrl) return (
    <div className={`flex items-center justify-center ${className}`}>
      <img 
        src={finalLogoUrl} 
        alt="Logo" 
        className={`w-auto object-contain transition-all ${collapsed ? 'h-8 max-w-[40px]' : 'h-full max-w-[280px]'}`} 
      />
    </div>
  );
  return (
    <div className={`flex items-center space-x-3 ${className}`}>
      <div className={`${collapsed ? 'w-8 h-8 rounded-xl' : 'w-12 h-12 rounded-2xl'} bg-[#00A1E4] flex items-center justify-center shadow-lg shadow-[#00A1E4]/30 transition-all`}>
        <span className={`text-white font-black ${collapsed ? 'text-lg' : 'text-2xl'} tracking-tighter`}>V</span>
      </div>
      {!collapsed && (
        <div className="flex flex-col">
          <span className="text-white font-black text-xl tracking-tighter leading-none">VEC GROUP</span>
          <span className="text-[#00A1E4] font-bold text-[8px] tracking-[0.3em] uppercase leading-none mt-1">Corporate CRM</span>
        </div>
      )}
    </div>
  );
};

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState(() => {
    const isClosed = typeof window !== 'undefined' && (
      window.location.hostname.includes('clientesfechados') ||
      window.location.search.includes('cnpj=') ||
      window.location.search.includes('CNPJ=') ||
      window.location.hash.includes('cnpj=') ||
      window.location.hash.includes('CNPJ=')
    );
    return isClosed ? 'closed-leads' : 'dashboard';
  });

  const [user, setUser] = useState<User | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<{title: string, msg: string} | null>(null);
  const [isDbUnstable, setIsDbUnstable] = useState(false);
  const [systemLogo, setSystemLogo] = useState<string | null>(null);
  const [systemBackground, setSystemBackground] = useState<string | null>(HARDCODED_BACKGROUND_URL || null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [isPortalFullScreen, setIsPortalFullScreen] = useState(false);
  const [closedLeadsViewMode, setClosedLeadsViewMode] = useState<'portal' | 'native'>('portal');
  const [leadsViewMode, setLeadsViewMode] = useState<'portal' | 'native'>('portal');
  
  const [allLeads, setAllLeads] = useState<Lead[]>([]);
  const activeLeads = useMemo(() => allLeads.filter(l => !l.isFromClosedTable), [allLeads]);
  const closedLeads = useMemo(() => allLeads.filter(l => l.isFromClosedTable || (l as any).dataFechamento || (l as any).status === LeadStatus.FECHADO), [allLeads]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([]);
  const [birthdayUsers, setBirthdayUsers] = useState<User[]>([]);
  const [showBirthdayModal, setShowBirthdayModal] = useState(false);
  const [goalToCelebrate, setGoalToCelebrate] = useState<Goal | null>(null);
  const [ticketToNotify, setTicketToNotify] = useState<{ticket: Ticket, isUrgent: boolean} | null>(null);
  const [lastSync, setLastSync] = useState<string>(new Date().toLocaleTimeString());
  const [whatsappTarget, setWhatsappTarget] = useState<{
    phone?: string;
    cnpj?: string;
    leadName?: string;
    company?: string;
    leadId?: string;
    fromTab?: string;
  } | null>(null);

  const handleOpenWhatsApp = useCallback((options: { phone?: string; cnpj?: string; leadName?: string; company?: string; leadId?: string }) => {
    setWhatsappTarget(prev => ({
      ...options,
      fromTab: activeTab !== 'whatsapp' ? activeTab : (prev?.fromTab || 'dashboard')
    }));
    setActiveTab('whatsapp');
  }, [activeTab]);

  // Global postMessage Listener: catches requests from embedded iframes (e.g. leads, clientesfechados)
  useEffect(() => {
    const handleGlobalMessage = (event: MessageEvent) => {
      // Validate origin against allowed domain patterns
      const isAllowedOrigin = 
        typeof event.origin === 'string' && (
          event.origin.includes('vecgroup.com.br') ||
          event.origin.includes('localhost') ||
          event.origin.includes('run.app')
        );

      if (!isAllowedOrigin || !event.data) return;

      const data = event.data;

      // Handle requests to open WhatsApp CRM internally
      if (
        data.type === 'OPEN_WHATSAPP' ||
        data.type === 'VEC_OPEN_WHATSAPP' ||
        data.type === 'OPEN_CHAT' ||
        data.type === 'NAVIGATE_WHATSAPP' ||
        data.action === 'open_whatsapp'
      ) {
        const phone = data.phone || data.payload?.phone || data.telefone || data.numero || data.celular;
        const cnpj = data.cnpj || data.payload?.cnpj;
        const leadName = data.leadName || data.name || data.payload?.name || data.razaoSocial || data.client_name;
        const company = data.company || data.payload?.company || data.razaoSocial || data.company_name;
        const leadId = data.leadId || data.payload?.leadId || data.id;

        handleOpenWhatsApp({ phone, cnpj, leadName, company, leadId });
      }

      // Handle generic tab navigation
      if (data.type === 'NAVIGATE_TAB' || data.type === 'VEC_NAVIGATE') {
        const targetTab = data.tab || data.destination;
        if (targetTab === 'whatsapp') {
          handleOpenWhatsApp({
            phone: data.phone || data.params?.phone,
            cnpj: data.cnpj || data.params?.cnpj,
            leadName: data.name || data.params?.name || data.params?.leadName,
            company: data.company || data.params?.company || data.params?.razaoSocial,
            leadId: data.leadId || data.params?.leadId
          });
        } else if (targetTab && typeof targetTab === 'string') {
          setActiveTab(targetTab);
        }
      }
    };

    window.addEventListener('message', handleGlobalMessage);
    return () => window.removeEventListener('message', handleGlobalMessage);
  }, [handleOpenWhatsApp]);
  
  const [dbStats, setDbStats] = useState<{
    leads: Record<string, number>,
    closed: Record<string, number>,
    totalLeads: number,
    totalClosed: number,
    totalTickets: number,
    realRevenue: Record<string, number>
  }>({ leads: {}, closed: {}, totalLeads: 0, totalClosed: 0, totalTickets: 0, realRevenue: {} });

  const PIPELINE_STATUSES = [ LeadStatus.ENTRAR_CONTATO, LeadStatus.ENVIADO_TIM, LeadStatus.ENVIADO_ALIVE, LeadStatus.NEGOCIANDO, LeadStatus.RENOVADO, LeadStatus.FECHADO, LeadStatus.SEM_INTERESSE ];

  const CLOSED_FLOW_STATUSES = [
    LeadStatus.FECHADO, LeadStatus.COLETA_ASSINATURA, LeadStatus.CONFIRMACAO_TELEFONICA, LeadStatus.EM_ANALISE, LeadStatus.VALIDANDO, LeadStatus.VALIDANDO_PORTABILIDADE, 
    LeadStatus.REPROVADO, LeadStatus.CANCELADO, LeadStatus.ESTORNADO, LeadStatus.CORRECAO_CONSULTOR, LeadStatus.FINALIZADO, LeadStatus.RENOVAR,
    LeadStatus.R_ASSINATURA, LeadStatus.R_CONFIRMACAO, LeadStatus.R_ANALISE, LeadStatus.R_VALIDANDO, LeadStatus.R_FECHADO
  ];

  const navItems = useMemo(() => {
    if (!user) return [];
    return getNavItems(user.role);
  }, [user]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);

    // 1. Leitura imediata de supabase.auth.getSession() para restaurar a sessão persistida no localStorage antes de decidir se exibe a tela de login
    const restoreSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          console.warn('[Auth] Aviso ao ler sessão persistida:', error.message || error);
        }
        if (data?.session?.user) {
          console.log(`[Auth] Sessão persistida restaurada: ${data.session.user.email} (ID: ${data.session.user.id})`);
          await fetchUserProfile(data.session.user.id, data.session.user.email || '');
        } else {
          console.log('[Auth] Nenhuma sessão persistida ativa encontrada no localStorage.');
          setUser(null);
        }
      } catch (err) {
        console.warn('[Auth] Erro ao recuperar sessão inicial:', err);
      } finally {
        setIsInitializing(false);
      }
    };

    restoreSession();

    // 2. Listener onAuthStateChange:
    // Deslogue apenas e exclusivamente se o evento for event === 'SIGNED_OUT'.
    // Não deslogue se newSession vier vazio durante atualizações de token ou eventos transitórios.
    // Mantenha o usuário autenticado quando ocorrer renovação automática (TOKEN_REFRESHED e INITIAL_SESSION).
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event: string, newSession: any) => {
      console.log(`[Auth onAuthStateChange] Evento: ${event}`, newSession?.user?.email || '(sem sessão)');

      if (event === 'SIGNED_OUT') {
        console.log('[Auth] Evento SIGNED_OUT confirmado. Deslogando usuário...');
        setUser(null);
        setIsInitializing(false);
        return;
      }

      if (event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
        if (newSession?.user) {
          setUser(prevUser => {
            if (!prevUser || prevUser.id !== newSession.user.id) {
              fetchUserProfile(newSession.user.id, newSession.user.email || '');
            }
            return prevUser;
          });
        }
        setIsInitializing(false);
        return;
      }

      // Eventos transitórios ou atualização momentânea de token: NÃO deslogar!
    });

    loadInitialData();
    fetchSystemSettings();

    return () => {
      clearInterval(timer);
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  async function fetchSystemSettings() {
    try {
      const [logoRes, bgRes] = await Promise.all([
        supabase.proposals.getSystemLogo(),
        supabase.proposals.getSystemBackground()
      ]);
      
      if (logoRes.data) setSystemLogo(HARDCODED_LOGO_URL || logoRes.data);
      if (bgRes.data) setSystemBackground(HARDCODED_BACKGROUND_URL || bgRes.data);
      
      if (logoRes.error || bgRes.error) {
        console.info("Configurações customizadas não encontradas ou opcionais (usando padrão):", { logo: logoRes.error, bg: bgRes.error });
      }
    } catch (err) {
      console.info("Erro ao buscar configurações customizadas (usando padrão):", err);
    }
  }

  const checkPendingTickets = useCallback(() => {
    const openTickets = tickets.filter(t => t.status !== TicketStatus.FINALIZADO);
    if (openTickets.length === 0) return;
    const isPrivileged = ['OWNER', 'SUPERVISOR', 'ADMINISTRATIVO', 'ADMINISTRADOR'].includes(user?.role || '');
    const relevantTickets = isPrivileged ? openTickets : openTickets.filter(t => t.requesterId === user?.id);
    if (relevantTickets.length === 0) return;
    const now = new Date();
    const urgentTicket = relevantTickets.find(t => new Date(t.deadlineAt) < now);
    if (urgentTicket) setTicketToNotify({ ticket: urgentTicket, isUrgent: true });
    else if (relevantTickets.length > 0) setTicketToNotify({ ticket: relevantTickets[0], isUrgent: false });
  }, [tickets, user]);

  const handleRequestAccess = async (toolId: string, toolName: string) => {
    if (!user) return;
    const newRequest: AccessRequest = {
      id: `req-${Date.now()}`,
      userId: user.id,
      userName: user.name,
      toolId,
      toolName,
      status: 'PENDING',
      requestedAt: new Date().toISOString()
    };
    setAccessRequests(prev => [...prev, newRequest]);
    await logActivity(`Solicitou acesso à ferramenta: ${toolName}`, toolName);
  };

  const handleApproveAccess = async (requestId: string) => {
    setAccessRequests(prev => prev.map(req => {
      if (req.id === requestId) {
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour from now
        return { ...req, status: 'APPROVED', expiresAt };
      }
      return req;
    }));
    const req = accessRequests.find(r => r.id === requestId);
    if (req) await logActivity(`Aprovou acesso para ${req.userName} na ferramenta ${req.toolName}`, req.toolName);
  };

  useEffect(() => {
    if (user && tickets.length > 0) checkPendingTickets();
  }, [user, tickets, checkPendingTickets]);

  useEffect(() => {
    if (allUsers.length > 0 && user) {
      const today = new Date();
      const todayMonthDay = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      
      const bdayUsers = allUsers.filter(u => {
        if (!u.birthDate) return false;
        const parts = u.birthDate.split('-');
        const userMonthDay = parts.length === 3 ? `${parts[1]}-${parts[2]}` : `${parts[0]}-${parts[1]}`;
        return userMonthDay === todayMonthDay;
      });

      if (bdayUsers.length > 0) {
        const sessionKey = `birthday_shown_${todayMonthDay}`;
        if (!sessionStorage.getItem(sessionKey)) {
          setBirthdayUsers(bdayUsers);
          setShowBirthdayModal(true);
          sessionStorage.setItem(sessionKey, 'true');
        }
      }
    }
  }, [allUsers, user]);

  const logActivity = async (action: string, target: string) => {
    if (!user) return;
    const activity: Activity = {
      id: `act-${Date.now()}`,
      userName: user.name,
      action,
      target,
      timestamp: new Date().toISOString()
    };
    setActivities(prev => [activity, ...prev]);
    await supabase.activities.insert(activity);
  };

  async function fetchUserProfile(userId: string, email: string) {
    console.log(`[Auth] Iniciando busca de perfil para: ${email} (ID: ${userId})`);
    
    const delays = [2000, 4000, 6000];
    let profileData: any = null;
    let queryError: any = null;

    // Tentativa inicial + até 3 retentativas com espera de 2s, 4s e 6s em caso de erro/timeout
    for (let attempt = 0; attempt <= delays.length; attempt++) {
      if (attempt > 0) {
        console.warn(`[Auth] Retentando busca de perfil (${attempt}/${delays.length}) após espera de ${delays[attempt - 1] / 1000}s...`);
        setIsDbUnstable(true);
        await new Promise(resolve => setTimeout(resolve, delays[attempt - 1]));
      }

      const res = await supabase.users.getProfile(userId, email);
      profileData = res.data;
      queryError = res.error;

      // Se encontrou o perfil com sucesso, encerra retentativas
      if (profileData) {
        setIsDbUnstable(false);
        break;
      }

      // Se a consulta concluiu com sucesso e confirmou que a linha não existe (data: null e error: null), não houve erro/timeout
      if (!queryError) {
        break;
      }

      console.warn(`[Auth] Erro ou timeout na leitura de perfil (tentativa ${attempt + 1}):`, queryError?.message || queryError);
    }

    // Se houve erro ou timeout após todas as retentativas:
    // Mostrar o usuário em modo de emergência APENAS na tela (SEM GRAVAR NADA NO BANCO) e exibir aviso discreto
    if (queryError) {
      console.error(`[Auth] Todas as tentativas de leitura falharam para ${email}. Ativando modo de emergência em memória.`, queryError);
      setIsDbUnstable(true);

      const isEmergencyOwner = email.toLowerCase().trim() === 'vinicius@ocomunicacao.com';
      const isYasmin = email.toLowerCase().includes('yasmin');

      const emergencyUser: User = {
        id: userId,
        email,
        name: isEmergencyOwner ? 'VINICIUS (EMERGÊNCIA)' : isYasmin ? 'YASMIN VITÓRIA' : (email ? email.split('@')[0].toUpperCase() : 'USUÁRIO'),
        role: isEmergencyOwner ? UserRole.OWNER : UserRole.VENDEDOR,
        status: UserStatus.ACTIVE,
        avatar: isEmergencyOwner 
          ? 'https://ui-avatars.com/api/?name=Vinicius&background=0D8ABC&color=fff&size=128' 
          : isYasmin 
            ? 'https://i.imgur.com/m4WqE5P.png' 
            : undefined
      };

      // NUNCA chamar users.upsert aqui!
      setUser(emergencyUser);
      return;
    }

    // Perfil localizado com sucesso no banco de dados
    if (profileData) {
      setIsDbUnstable(false);
      console.log(`[Auth] PERFIL LOCALIZADO NO BANCO:`, profileData.name, `(Cargo: ${profileData.role}, Status: ${profileData.status})`);
      
      const statusUpper = String(profileData.status || '').toUpperCase().trim();
      const isBlocked = statusUpper === 'BLOQUEADO' || statusUpper === 'DESATIVADO' || statusUpper === 'DESATIVADA';
      
      if (isBlocked) {
        console.warn("[Auth] Usuário bloqueado ou desativado:", profileData.email);
        setLoginError({ title: "ACESSO BLOQUEADO", msg: "Seu perfil foi desativado pelo administrador." });
        await supabase.auth.signOut();
        return;
      }

      const mappedUser: User = {
        ...profileData,
        birthDate: (profileData as any).birth_date || (profileData as any).birthDate,
        role: profileData.role as UserRole,
        status: profileData.status as UserStatus
      };
      
      setUser(mappedUser);
      return;
    }

    // Se não encontrou por ID, verificar obrigatoriamente se existe registro pelo e-mail
    if (email) {
      const emailCheck = await supabase.users.checkEmailExists(email);

      // Se a consulta por e-mail falhou por erro de conexão/timeout, NUNCA criar nem sobrescrever perfil
      if (emailCheck.error) {
        console.warn(`[Auth] Erro ao verificar perfil por e-mail (${email}):`, emailCheck.error);
        setIsDbUnstable(true);
        const fallbackUser: User = {
          id: userId,
          email,
          name: email.split('@')[0].toUpperCase(),
          role: UserRole.VENDEDOR,
          status: UserStatus.ACTIVE
        };
        setUser(fallbackUser);
        return;
      }

      // Se o perfil existe com este e-mail, utiliza o perfil real do banco sem sobrescrever
      if (emailCheck.data) {
        console.log(`[Auth] Perfil real encontrado por e-mail (${email}). Carregando do banco.`);
        setIsDbUnstable(false);
        setUser(emailCheck.data);
        return;
      }
    }

    // SÓ CRIAR PERFIL se a consulta foi concluída com sucesso E confirmou que não existe nenhuma linha com aquele id nem com aquele e-mail
    console.log(`[Auth] Confirmado com sucesso que não existe nenhuma linha com id ${userId} nem com email ${email}. Criando perfil inicial...`);
    setIsDbUnstable(false);

    const isOwnerEmail = email.toLowerCase().trim() === 'vinicius@ocomunicacao.com';
    const isYasmin = email.toLowerCase().includes('yasmin');
    const formattedName = isOwnerEmail 
      ? 'VINICIUS' 
      : isYasmin 
        ? 'YASMIN VITÓRIA' 
        : (email ? email.split('@')[0].toUpperCase() : 'NOVO USUÁRIO');

    const newUser: User = { 
      id: userId, 
      email, 
      name: formattedName, 
      role: isOwnerEmail ? UserRole.OWNER : UserRole.VENDEDOR, 
      status: UserStatus.ACTIVE,
      avatar: isYasmin ? 'https://i.imgur.com/m4WqE5P.png' : undefined
    };

    try {
      await supabase.users.upsert(newUser);
      console.log('[Auth] Novo perfil inicial criado no banco para:', email);
    } catch (err) {
      console.error('[Auth] Erro ao criar perfil no banco:', err);
    }
    setUser(newUser);
  };

  async function loadInitialData() {
    setIsRefreshing(true);
    try {
        const [leadsRes, closedRes, usersRes, activityRes, goalsRes, ticketRes, leadCount, closedCount, leadsByStatus, closedByStatus, realRevenueLeads, realRevenueClosed, sumAtivosLeads, sumAtivosClosed] = await Promise.all([
          supabase.leads.getAll(100).catch(err => ({ data: [], error: err })),
          supabase.clientes_fechados.getAll(100).catch(err => ({ data: [], error: err })),
          supabase.users.getAll().catch(err => ({ data: [], error: err })),
          supabase.activities.getAll().catch(err => ({ data: [], error: err })),
          supabase.goals.getAll().catch(err => ({ data: [], error: err })),
          supabase.tickets.getAll(50).catch(err => ({ data: [], error: err })),
          supabase.leads.getCount().catch(err => ({ count: 0, error: err })),
          supabase.clientes_fechados.getCount().catch(err => ({ count: 0, error: err })),
          supabase.stats.getCountsByStatus('leads', PIPELINE_STATUSES).catch(() => ({})),
          supabase.stats.getCountsByStatus('clientes_fechados', CLOSED_FLOW_STATUSES).catch(() => ({})),
          supabase.stats.getSumByStatus('leads', PIPELINE_STATUSES).catch(() => ({})),
          supabase.stats.getSumByStatus('clientes_fechados', CLOSED_FLOW_STATUSES).catch(() => ({})),
          supabase.stats.getSumAtivos('leads').catch(() => 0),
          supabase.stats.getSumAtivos('clientes_fechados').catch(() => 0)
        ]);
        
        if (usersRes?.data) {
          const userMap = new Map<string, User>();
          usersRes.data.forEach((u: any) => {
            const userObj: User = { ...u, role: u.role as UserRole, status: u.status as UserStatus };
            const key = u.id || (u.email ? u.email.toLowerCase().trim() : String(Math.random()));
            if (!userMap.has(key)) {
              userMap.set(key, userObj);
            }
          });
          const mappedUsersList = Array.from(userMap.values());
          setAllUsers(mappedUsersList);

          // Se o usuário atual estava em modo de emergência em tela, recupera o perfil real do banco
          setUser(currentUser => {
            if (currentUser && currentUser.name?.includes('(EMERGÊNCIA)')) {
              const realUser = mappedUsersList.find(u => 
                u.id === currentUser.id || (u.email && u.email.toLowerCase() === currentUser.email?.toLowerCase())
              );
              if (realUser) {
                setIsDbUnstable(false);
                return realUser;
              }
            }
            return currentUser;
          });
        }
        if (activityRes?.data) setActivities(activityRes.data);
        if (goalsRes?.data) setGoals(goalsRes.data);
        if (ticketRes?.data) setTickets(ticketRes.data);

        const merged = [...(leadsRes?.data || []), ...(closedRes?.data || [])];
        const unique = Array.from(new Map(merged.map(l => [l.id, l])).values());
        setAllLeads(unique);
        
        setDbStats({
          leads: (leadsByStatus || {}) as Record<string, number>,
          closed: (closedByStatus || {}) as Record<string, number>,
          totalLeads: leadCount?.count || 0,
          totalClosed: closedCount?.count || 0,
          totalTickets: ticketRes?.data?.filter((t: any) => t.status !== TicketStatus.FINALIZADO).length || 0,
          totalAtivos: ((sumAtivosLeads as number) || 0) + ((sumAtivosClosed as number) || 0),
          realRevenue: { ...((realRevenueLeads as any) || {}), ...((realRevenueClosed as any) || {}) }
        });
        setLastSync(new Date().toLocaleTimeString());
    } catch (err) {
        console.warn("Erro ao carregar dados iniciais do Supabase:", err);
    } finally {
        setIsRefreshing(false);
    }
  };

  const handleSSORedirect = async (baseUrl: string) => {
    setIsRefreshing(true);
    try {
      const fullUrl = await buildSSOUrl(baseUrl, { user_email: user?.email });
      window.location.href = fullUrl;
    } catch (err) {
      window.location.href = baseUrl;
    } finally {
      setIsRefreshing(false);
    }
  };

  const renderContent = () => {
    if (!user) return null;
    switch(activeTab) {
      case 'dashboard': return (
        <div className="h-full flex flex-col">
          <Dashboard user={user} allUsers={allUsers} leads={allLeads} activities={activities} dbStats={dbStats} hideHeader={false} systemLogo={systemLogo} />
        </div>
      );
      case 'whatsapp': return (
        <div className="h-full w-full flex flex-col min-h-0 bg-[#000d26]">
          <WhatsAppCRM 
            user={user} 
            phone={whatsappTarget?.phone}
            cnpj={whatsappTarget?.cnpj}
            leadName={whatsappTarget?.leadName}
            company={whatsappTarget?.company}
            leadId={whatsappTarget?.leadId}
            isFullScreen={isPortalFullScreen}
            onToggleFullScreen={setIsPortalFullScreen}
            onBack={() => {
              setIsPortalFullScreen(false);
              if (whatsappTarget?.fromTab) {
                setActiveTab(whatsappTarget.fromTab);
              } else {
                setActiveTab('dashboard');
              }
              setWhatsappTarget(null);
            }}
          />
        </div>
      );
      case 'closed-leads': return (
        <div className="h-full w-full flex flex-col min-h-0 bg-[#000d26]">
          {closedLeadsViewMode === 'native' ? (
            <div className="h-full w-full flex flex-col min-h-0">
              <div className="bg-[#001a4d] border-b border-white/10 px-6 py-2.5 flex items-center justify-between shrink-0">
                <div className="flex items-center space-x-3">
                  <Handshake className="text-[#00A1E4]" size={20} />
                  <span className="text-white font-black text-xs uppercase tracking-wider">Clientes Fechados & Pós-Venda</span>
                  <span className="bg-emerald-500/20 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">Modo Integrado Nativo</span>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setClosedLeadsViewMode('portal')}
                    className="text-white/70 hover:text-white bg-white/5 hover:bg-white/10 px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5"
                  >
                    <span>Abrir Portal Web</span>
                    <ExternalLink size={12} className="text-[#00A1E4]" />
                  </button>
                </div>
              </div>
              <div className="flex-1 min-h-0 p-6 overflow-y-auto custom-scrollbar">
                <ClosedLeadsManagement 
                  user={user} 
                  allUsers={allUsers} 
                  leads={closedLeads} 
                  onUpdateLead={async (l) => {
                    await supabase.clientes_fechados.upsert(l);
                    await loadInitialData();
                  }}
                  onDeleteLeads={async (ids) => {
                    await supabase.clientes_fechados.deleteBulk(ids);
                    await loadInitialData();
                  }}
                  onOpenWhatsApp={handleOpenWhatsApp}
                />
              </div>
            </div>
          ) : (
            <EmbeddedPortal 
              title="Clientes Fechados" 
              baseUrl="https://clientesfechados.vecgroup.com.br" 
              icon={<Handshake size={28} />} 
              user={user} 
              showExternalButton={true}
              isFullScreen={isPortalFullScreen}
              onToggleFullScreen={setIsPortalFullScreen}
              onBack={() => {
                setIsPortalFullScreen(false);
                setActiveTab('dashboard');
              }}
              onToggleNativeView={() => setClosedLeadsViewMode('native')}
              nativeViewLabel="Modo Integrado"
            />
          )}
        </div>
      );
      case 'leads': return (
        <div className="h-full w-full flex flex-col min-h-0 bg-[#000d26]">
          {leadsViewMode === 'native' ? (
            <div className="h-full w-full flex flex-col min-h-0">
              <div className="bg-[#001a4d] border-b border-white/10 px-6 py-2.5 flex items-center justify-between shrink-0">
                <div className="flex items-center space-x-3">
                  <UsersIcon className="text-[#00A1E4]" size={20} />
                  <span className="text-white font-black text-xs uppercase tracking-wider">Gestão de Leads VIVO</span>
                  <span className="bg-emerald-500/20 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">Modo Integrado Nativo</span>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setLeadsViewMode('portal')}
                    className="text-white/70 hover:text-white bg-white/5 hover:bg-white/10 px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5"
                  >
                    <span>Abrir Portal Web</span>
                    <ExternalLink size={12} className="text-[#00A1E4]" />
                  </button>
                </div>
              </div>
              <div className="flex-1 min-h-0 p-6 overflow-y-auto custom-scrollbar">
                <LeadsManagement 
                  user={user} 
                  allUsers={allUsers} 
                  leads={activeLeads} 
                  allLeads={allLeads}
                  onUpdateLead={async (l) => {
                    await supabase.leads.upsert(l);
                    await loadInitialData();
                  }}
                  onSetLeads={(newLeads) => setAllLeads(newLeads)}
                  onDeleteLeads={async (ids) => {
                    await supabase.leads.deleteBulk(ids);
                    await loadInitialData();
                  }}
                  onOpenWhatsApp={handleOpenWhatsApp}
                />
              </div>
            </div>
          ) : (
            <EmbeddedPortal 
              title="VIVO Leads" 
              baseUrl="https://leads.vecgroup.com.br" 
              icon={<UsersIcon size={28} />} 
              user={user} 
              showExternalButton={true}
              isFullScreen={isPortalFullScreen}
              onToggleFullScreen={setIsPortalFullScreen}
              onBack={() => {
                setIsPortalFullScreen(false);
                setActiveTab('dashboard');
              }}
              onToggleNativeView={() => setLeadsViewMode('native')}
              nativeViewLabel="Modo Integrado"
            />
          )}
        </div>
      );
      case 'tim-leads': return (
        <div className="h-full w-full flex flex-col min-h-0 bg-[#000d26]">
          <EmbeddedPortal 
            title="TIM Leads" 
            baseUrl="https://leadstim.vecgroup.com.br" 
            icon={<UsersIcon size={28} />} 
            user={user} 
            showExternalButton={true}
            isFullScreen={isPortalFullScreen}
            onToggleFullScreen={setIsPortalFullScreen}
            onBack={() => {
              setIsPortalFullScreen(false);
              setActiveTab('dashboard');
            }}
          />
        </div>
      );
      case 'tickets': return <div className="p-8 h-full overflow-y-auto custom-scrollbar"><TicketsManagement user={user} tickets={tickets} leads={allLeads} onBack={() => setActiveTab('dashboard')} onOpenWhatsApp={handleOpenWhatsApp} onDeleteTicket={async (id) => { setTickets(prev => prev.filter(t => t.id !== id)); await supabase.tickets.delete(id); }} onUpdateTicket={async (t) => { setTickets(prev => { const exists = prev.find(x => x.id === t.id); return exists ? prev.map(x => x.id === t.id ? t : x) : [t, ...prev]; }); await supabase.tickets.upsert(t); }} /></div>;
      case 'users': return <div className="p-8 h-full overflow-y-auto custom-scrollbar"><UsersManagement currentUser={user} /></div>;
      case 'settings': return <div className="p-8 h-full overflow-y-auto custom-scrollbar"><Settings user={user} onUpdateUser={async (u) => { try { const { error } = await supabase.users.upsert(u); if (error) throw error; await fetchUserProfile(u.id, u.email); setAllUsers(prev => prev.map(existing => (existing.id === u.id || (existing.email && existing.email.toLowerCase() === u.email?.toLowerCase())) ? { ...existing, ...u } : existing)); } catch (e: any) { console.error("Erro ao salvar perfil:", e); alert("Erro ao salvar perfil: " + (e.message || "Tente novamente.")); throw e; } }} /></div>;
      case 'tools': return (
        <div className="p-8 h-full overflow-y-auto custom-scrollbar">
          <Tools 
            user={user} 
            allUsers={allUsers} 
            onLogTool={() => {}} 
            globalGoals={goals} 
            tickets={tickets} 
            leadsForTickets={allLeads} 
            systemLogo={systemLogo}
            onAddGoal={async (g) => { 
              setGoals(prev => {
                const exists = prev.find(x => x.id === g.id);
                return exists ? prev.map(x => x.id === g.id ? g : x) : [g, ...prev];
              }); 
              await supabase.goals.upsert(g); 
            }} 
            onDeleteGoal={async (id) => { setGoals(prev => prev.filter(x => x.id !== id)); await supabase.goals.delete(id); }} 
            onUpdateGoalProgress={async (id, amt) => { 
              setGoals(prev => {
                const goal = prev.find(g => g.id === id);
                if (!goal) return prev;

                const newProgress = goal.currentProgress + amt;
                const isCompleted = newProgress >= goal.objective;
                
                if (!goal.isCompleted && isCompleted) {
                  setGoalToCelebrate({ ...goal, currentProgress: newProgress, isCompleted });
                }
                
                const updatedGoal = { ...goal, currentProgress: newProgress, isCompleted };
                supabase.goals.upsert(updatedGoal);
                return prev.map(g => g.id === id ? updatedGoal : g);
              }); 
            }} 
            onSetGoalProgress={async (id, total) => {
              setGoals(prev => {
                const goal = prev.find(g => g.id === id);
                if (!goal) return prev;

                const isCompleted = total >= goal.objective;
                
                if (!goal.isCompleted && isCompleted) {
                  setGoalToCelebrate({ ...goal, currentProgress: total, isCompleted });
                }
                
                const updatedGoal = { ...goal, currentProgress: total, isCompleted };
                supabase.goals.upsert(updatedGoal);
                return prev.map(g => g.id === id ? updatedGoal : g);
              });
            }}
            onTicketUpdate={async (t) => { 
              setTickets(prev => prev.map(x => x.id === t.id ? t : x)); 
              await supabase.tickets.upsert(t); 
            }} 
            onRefreshGoals={loadInitialData}
            onCelebrate={(g) => setGoalToCelebrate(g)}
            accessRequests={accessRequests}
            onRequestAccess={handleRequestAccess}
            onApproveAccess={handleApproveAccess}
          />
        </div>
      );
      default: return null;
    }
  };

  if (isInitializing) return <div className="min-h-screen bg-[#000d26] flex items-center justify-center"><Loader2 className="text-[#00A1E4] animate-spin" size={40} /></div>;

  if (!user) {
    return (
      <div className="h-screen w-full bg-[#000d26] flex flex-col lg:flex-row overflow-hidden relative">
        {systemBackground && (
          <div 
            className="absolute inset-0 z-0 opacity-20 pointer-events-none"
            style={{ 
              backgroundImage: `url(${systemBackground})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          />
        )}
        {/* Left Side: Login Form */}
        <div className="w-full lg:w-[460px] xl:w-[480px] flex flex-col justify-center p-8 lg:p-12 xl:p-14 relative z-10 bg-[#001a4d] shadow-2xl border-r border-white/5 shrink-0 h-full overflow-y-auto custom-scrollbar">
          <div className="max-w-sm mx-auto w-full">
            <div className="mb-10">
              <VecLogo className="h-24" logoUrl={systemLogo} />
            </div>
            
            <form onSubmit={async (e) => { 
              e.preventDefault(); 
              setIsLoggingIn(true); 
              setLoginError(null); 
              try { 
                const { data, error } = await supabase.auth.signIn(loginEmail, loginPassword); 
                if (error) {
                  setLoginError({ title: "ACESSO NEGADO", msg: error.message || "Credenciais inválidas." });
                } else if (data?.user) { 
                  await fetchUserProfile(data.user.id, data.user.email || ''); 
                  await loadInitialData(); 
                } 
              } catch (err: any) { 
                console.warn("[Auth] Login error:", err);
                setLoginError({ title: "ERRO", msg: "Falha na conexão ou credenciais inválidas." }); 
              } finally { 
                setIsLoggingIn(false); 
              } 
            }} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block">E-mail Corporativo</label>
                <div className="relative">
                  <Mail className="absolute left-0 top-1/2 -translate-y-1/2 text-white/20" size={20} />
                  <input 
                    type="email" 
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="exemplo@vecgroup.com.br"
                    className="w-full pl-8 py-3 bg-transparent border-b-2 border-white/5 focus:border-[#00A1E4] outline-none transition-all text-white font-medium placeholder:text-white/10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block">Senha de Acesso</label>
                <div className="relative">
                  <Key className="absolute left-0 top-1/2 -translate-y-1/2 text-white/20" size={20} />
                  <input 
                    type="password" 
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-8 py-3 bg-transparent border-b-2 border-white/5 focus:border-[#00A1E4] outline-none transition-all text-white font-medium placeholder:text-white/10"
                  />
                </div>
              </div>

              {loginError && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-red-500/10 p-4 border-l-4 border-red-500 flex items-start space-x-3"
                >
                  <div className="text-red-500 mt-0.5">
                    <X size={16} />
                  </div>
                  <div>
                    <h4 className="text-[10px] font-black uppercase text-red-500">{loginError.title}</h4>
                    <p className="text-[10px] font-bold text-red-500/70 uppercase leading-tight mt-0.5">{loginError.msg}</p>
                  </div>
                </motion.div>
              )}

              <button 
                type="submit"
                disabled={isLoggingIn}
                className="w-full py-4 bg-[#00A1E4] text-white font-black uppercase tracking-widest rounded-full shadow-xl shadow-[#00A1E4]/20 hover:bg-[#003399] transition-all active:scale-95 flex items-center justify-center space-x-3"
              >
                {isLoggingIn ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <>
                    <span>ENTRAR NO SISTEMA</span>
                    <ArrowRight size={20} />
                  </>
                )}
              </button>
            </form>

            <div className="mt-12 pt-6 border-t border-white/5">
              <p className="text-white/20 text-[9px] font-bold uppercase tracking-[0.2em]">
                © {new Date().getFullYear()} VEC GROUP • CORPORATE CRM
              </p>
            </div>
          </div>
        </div>

        {/* Right Side: Video Player */}
        <div className="flex-1 bg-[#000d26] relative hidden lg:flex flex-col items-center justify-center h-full min-h-0 min-w-0 overflow-hidden border-l border-white/5">
          <video 
            src="https://i.imgur.com/pE0X2it.mp4" 
            autoPlay 
            loop 
            muted 
            playsInline 
            className="w-full h-full object-cover"
          />
          {/* Subtle gradient vignette */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#000d26]/80 via-transparent to-[#000d26]/40 pointer-events-none" />
          <div className="absolute inset-0 bg-[#001a4d]/10 pointer-events-none" />
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#000d26] flex overflow-hidden relative">
      {systemBackground && (
        <div 
          className="fixed inset-0 z-0 opacity-10 pointer-events-none"
          style={{ 
            backgroundImage: `url(${systemBackground})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
      )}

      {/* Mobile Menu Toggle */}
      {!isPortalFullScreen && (
        <div className="lg:hidden fixed top-4 left-4 z-50">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-3 bg-[#00A1E4] text-white rounded-2xl shadow-lg shadow-[#00A1E4]/30 active:scale-95 transition-all"
          >
            {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      )}

      {/* Mobile Backdrop */}
      <AnimatePresence>
        {!isPortalFullScreen && isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          />
        )}
      </AnimatePresence>

      {/* Left Sidebar */}
      <aside 
        onMouseEnter={() => setIsSidebarCollapsed(false)}
        onMouseLeave={() => setIsSidebarCollapsed(true)}
        className={`
          ${isPortalFullScreen ? 'hidden' : 'flex'}
          fixed lg:relative
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          ${isSidebarCollapsed ? 'lg:w-[80px]' : 'lg:w-[320px]'}
          w-[280px] h-full flex-col bg-[#001a4d] border-r border-white/5 z-50 lg:z-20 transition-all duration-500 ease-[0.16, 1, 0.3, 1] shadow-2xl shrink-0
        `}
      >
        {/* Desktop Collapse Toggle */}
        <button
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className="hidden absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-12 bg-[#00A1E4] text-white items-center justify-center rounded-full shadow-lg z-30 hover:scale-110 transition-all"
        >
          {isSidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>

        <div className={`p-6 flex flex-col h-full overflow-y-auto custom-scrollbar ${isSidebarCollapsed ? 'items-center' : ''}`}>
          <div className={`mb-10 flex flex-col items-center ${isSidebarCollapsed ? 'scale-75' : ''}`}>
            {!isSidebarCollapsed && (
              <div className="text-center mb-6">
                <p className="text-white text-3xl font-black tracking-tighter">
                  {currentTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </p>
                <p className="text-[#00A1E4] text-[10px] font-black uppercase tracking-[0.2em] mt-1">
                  {currentTime.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                </p>
              </div>
            )}
            <VecLogo className={isSidebarCollapsed ? "h-10" : "h-16"} logoUrl={systemLogo} collapsed={isSidebarCollapsed} />
          </div>

          {/* User Profile Summary */}
          <div className={`mb-10 flex flex-col items-center text-center ${isSidebarCollapsed ? 'scale-90' : ''}`}>
            <div className={`${isSidebarCollapsed ? 'w-10 h-10' : 'w-20 h-20'} rounded-2xl border-2 border-[#00A1E4] overflow-hidden shadow-2xl mb-4 transition-all`}>
              <img 
                src={user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=00A1E4&color=fff`} 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            {!isSidebarCollapsed && (
              <div className="overflow-hidden">
                <p className="text-[13px] font-black text-[#00A1E4] uppercase tracking-widest truncate mb-1">{user.name}</p>
                <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest">{user.role}</p>
              </div>
            )}
          </div>

          {/* Navigation Menu - List Format */}
          <div className="flex flex-col space-y-2 mb-8">
            <motion.div
              whileHover={{ x: isSidebarCollapsed ? 0 : 5 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                setActiveTab('dashboard');
                setIsPortalFullScreen(false);
                setIsSidebarOpen(false);
              }}
              className={`flex items-center ${isSidebarCollapsed ? 'justify-center' : 'space-x-4'} p-4 rounded-2xl cursor-pointer transition-all border ${
                activeTab === 'dashboard' 
                  ? 'bg-[#00A1E4] border-[#00A1E4] text-white shadow-lg shadow-[#00A1E4]/20' 
                  : 'bg-white/5 border-white/5 text-white/60 hover:bg-white/10 hover:text-white'
              }`}
              title={isSidebarCollapsed ? "Dashboard" : ""}
            >
              <LayoutDashboard size={18} />
              {!isSidebarCollapsed && <span className="text-[10px] font-black uppercase tracking-widest">Dashboard</span>}
            </motion.div>

            {navItems.map((item: any) => {
              const isAdvogadoRestricted = user?.role === 'ADVOGADO' && ['leads', 'tim-leads', 'tickets', 'users'].includes(item.id);
              
              return (
                <motion.div
                  key={item.id}
                  whileHover={isAdvogadoRestricted ? {} : { x: isSidebarCollapsed ? 0 : 5 }}
                  whileTap={isAdvogadoRestricted ? {} : { scale: 0.98 }}
                  onClick={() => {
                    if (isAdvogadoRestricted) {
                      alert("Seu perfil de Advogado não possui permissão para acessar esta área.");
                      return;
                    }
                    setActiveTab(item.id);
                    setIsPortalFullScreen(false);
                    setIsSidebarOpen(false);
                  }}
                  className={`flex items-center ${isSidebarCollapsed ? 'justify-center' : 'space-x-4'} p-4 rounded-2xl cursor-pointer transition-all border ${
                    isAdvogadoRestricted
                      ? 'bg-white/5 border-white/5 text-white/30 cursor-not-allowed opacity-50'
                      : activeTab === item.id 
                        ? 'bg-[#00A1E4] border-[#00A1E4] text-white shadow-lg shadow-[#00A1E4]/20' 
                        : 'bg-white/5 border-white/5 text-white/60 hover:bg-white/10 hover:text-white'
                  }`}
                  title={isSidebarCollapsed ? (isAdvogadoRestricted ? `${item.label} (Acesso Restrito)` : item.label) : ""}
                >
                  <div className="relative">
                    {React.cloneElement(item.icon as React.ReactElement, { size: 18 })}
                    {isAdvogadoRestricted && (
                      <div className="absolute -top-1 -right-1 bg-red-500 rounded-full p-[2.5px] text-white">
                        <Lock size={6} />
                      </div>
                    )}
                  </div>
                  {!isSidebarCollapsed && (
                    <div className="flex items-center space-x-2">
                      <span className="text-[10px] font-black uppercase tracking-widest">{item.label}</span>
                      {isAdvogadoRestricted && <Lock size={10} className="text-red-500" />}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>

          {/* Bottom Actions */}
          <div className={`mt-auto pt-8 border-t border-white/5 space-y-4 ${isSidebarCollapsed ? 'items-center' : ''}`}>
            {!isSidebarCollapsed && (
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center space-x-2">
                  <LifeBuoy size={14} className="text-red-500" />
                  <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">Chamados: {dbStats.totalTickets}</span>
                </div>
                {['OWNER', 'SUPERVISOR', 'ADMINISTRATIVO', 'ADMINISTRADOR'].includes(user.role) && accessRequests.some(r => r.status === 'PENDING') && (
                  <div className="flex items-center space-x-2">
                    <Shield size={14} className="text-amber-500" />
                    <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest">{accessRequests.filter(r => r.status === 'PENDING').length}</span>
                  </div>
                )}
              </div>
            )}
            
            <button 
              onClick={async () => { await supabase.auth.signOut(); setUser(null); }}
              className={`w-full py-4 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center ${isSidebarCollapsed ? '' : 'space-x-3'}`}
              title={isSidebarCollapsed ? "Sair" : ""}
            >
              <LogOut size={16} />
              {!isSidebarCollapsed && <span>SAIR DO SISTEMA</span>}
            </button>

            {!isSidebarCollapsed && (
              <div className="text-center">
                <p className="text-white/10 text-[8px] font-bold uppercase tracking-[0.2em]">
                  © {new Date().getFullYear()} VEC GROUP • CRM
                </p>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Right Content Area */}
      <main className="flex-1 relative z-10 overflow-hidden flex flex-col bg-[#000d26] h-full min-h-0 w-full">
        {isDbUnstable && (
          <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 flex items-center justify-center space-x-2 text-amber-400 text-xs font-semibold shrink-0 z-30">
            <RefreshCw size={13} className="animate-spin text-amber-400" />
            <span>Conexão instável com o banco, tentando novamente…</span>
          </div>
        )}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className={`h-full w-full flex flex-col min-h-0 ${isPortalFullScreen ? 'pt-0' : 'pt-16 lg:pt-0'}`}
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Modals & Overlays */}
      {!isPortalFullScreen && <GoalFloatingWidget goals={goals} user={user} />}
      {showBirthdayModal && <BirthdayCelebrationModal users={birthdayUsers} onClose={() => setShowBirthdayModal(false)} />}
      {ticketToNotify && (
        <TicketNotificationModal 
          ticket={ticketToNotify.ticket} 
          isUrgent={ticketToNotify.isUrgent} 
          onClose={() => setTicketToNotify(null)} 
        />
      )}

      {goalToCelebrate && (
        <GoalCelebrationModal 
          goal={goalToCelebrate} 
          onClose={() => setGoalToCelebrate(null)} 
        />
      )}
    </div>
  );
};

export default App;
