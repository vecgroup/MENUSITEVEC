
import React, { useMemo, useState, useEffect } from 'react';
import { User, Activity, Lead, LeadStatus } from '../types';
import { 
  Users, 
  Zap, 
  Calendar, 
  DollarSign,
  Smartphone,
  ArrowUpRight,
  LifeBuoy,
  ExternalLink,
  Trophy,
  ShoppingBag,
  Handshake,
  Lock,
  RefreshCw,
  Maximize2,
  CheckCircle2,
  Globe,
  Radio,
  Video,
  PlayCircle
} from 'lucide-react';
import { supabase, buildSSOUrl } from '../lib/supabase';

interface DashboardProps {
  user: User;
  allUsers?: User[];
  leads: Lead[];
  activities: Activity[];
  systemLogo?: string | null;
  dbStats?: {
    leads: Record<string, number>,
    closed: Record<string, number>,
    totalLeads: number,
    totalClosed: number,
    totalTickets: number,
    totalAtivos: number,
    realRevenue: Record<string, number>
  };
  hideHeader?: boolean;
}

type ViewMode = 'video' | 'closed' | 'leads';

const Dashboard: React.FC<DashboardProps> = ({ user, allUsers = [], leads, activities, systemLogo, dbStats, hideHeader = false }) => {
  const [selectedMonthYear, setSelectedMonthYear] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  // Estado para alternar entre o Vídeo Institucional, Clientes Fechados e Leads
  const [viewMode, setViewMode] = useState<ViewMode>('video');
  const [leadsUrl, setLeadsUrl] = useState('https://leads.vecgroup.com.br');
  const [closedUrl, setClosedUrl] = useState('https://clientesfechados.vecgroup.com.br');
  const [portalKey, setPortalKey] = useState(0);

  useEffect(() => {
    const syncSession = async () => {
      try {
        const [fullLeadsUrl, fullClosedUrl] = await Promise.all([
          buildSSOUrl('https://leads.vecgroup.com.br', { user_email: user?.email }),
          buildSSOUrl('https://clientesfechados.vecgroup.com.br', { user_email: user?.email })
        ]);
        setLeadsUrl(fullLeadsUrl);
        setClosedUrl(fullClosedUrl);
      } catch (err) {
        console.error("Erro ao sincronizar sessão para os portais:", err);
      }
    };
    syncSession();
  }, [user]);

  const CLOSED_FLOW_STATUSES = [
    LeadStatus.FECHADO, LeadStatus.COLETA_ASSINATURA, LeadStatus.CONFIRMACAO_TELEFONICA,
    LeadStatus.EM_ANALISE, LeadStatus.VALIDANDO, LeadStatus.VALIDANDO_PORTABILIDADE, 
    LeadStatus.REPROVADO, LeadStatus.CANCELADO, LeadStatus.ESTORNADO, 
    LeadStatus.CORRECAO_CONSULTOR, LeadStatus.FINALIZADO, LeadStatus.RENOVAR,
    LeadStatus.R_ASSINATURA, LeadStatus.R_CONFIRMACAO, LeadStatus.R_ANALISE,
    LeadStatus.R_VALIDANDO, LeadStatus.R_FECHADO
  ];

  const stats = useMemo(() => {
    const totalFaturamento = CLOSED_FLOW_STATUSES.reduce((acc, status) => acc + (dbStats?.realRevenue[status] || 0), 0);
    const activeLeadsCount = dbStats?.totalLeads || 0;
    const closedCountTotal = dbStats?.totalClosed || 0;
    const openTicketsCount = dbStats?.totalTickets || 0;
    const conversionRate = activeLeadsCount > 0 ? (closedCountTotal / activeLeadsCount) * 100 : 0;
    const totalLinhasAtivas = dbStats?.totalAtivos || 0;
    
    return [
      { label: 'Faturamento Total', value: totalFaturamento.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), icon: <DollarSign className="text-emerald-600" />, color: 'bg-emerald-50' },
      { label: 'Chamados em Aberto', value: openTicketsCount.toLocaleString(), icon: <LifeBuoy className="text-rose-600" />, color: 'bg-rose-50' },
      { label: 'Empresas na Base', value: activeLeadsCount.toLocaleString(), icon: <Users className="text-indigo-600" />, color: 'bg-indigo-50' },
      { label: 'Taxa de Conversão', value: conversionRate.toFixed(1) + '%', icon: <Zap className="text-amber-600" />, color: 'bg-amber-50' },
      { label: 'Total Linhas (Base)', value: totalLinhasAtivas.toLocaleString(), icon: <Smartphone className="text-cyan-600" />, color: 'bg-cyan-50' },
    ];
  }, [dbStats]);

  const isAdvogado = user.role === 'ADVOGADO';

  return (
    <div className="h-full flex flex-col animate-in fade-in duration-500">
      {/* Main Content Area: Background Video Full Container */}
      <div className="flex-1 relative flex flex-col min-h-0 bg-[#000d26] overflow-hidden">
        <div className="w-full h-full flex items-center justify-center bg-[#000d26] relative overflow-hidden pointer-events-none select-none">
          <video 
            src="https://i.imgur.com/pE0X2it.mp4" 
            autoPlay 
            loop 
            muted 
            playsInline 
            disablePictureInPicture
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#000d26]/40 via-transparent to-[#000d26]/20 pointer-events-none" />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

