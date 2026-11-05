
import React, { useState, useMemo, useEffect } from 'react';
import { 
  Shield, 
  Clock, 
  FileSpreadsheet, 
  Target, 
  Smartphone, 
  Calculator, 
  Receipt, 
  FileText, 
  CheckSquare,
  ArrowLeft,
  LifeBuoy,
  ChevronRight,
  Lock
} from 'lucide-react';
import { motion } from 'framer-motion';
import TimeClock from './TimeClock';
import GoalsManagement from './GoalsManagement';
import ChipControl from './ChipControl';
import TimContractGenerator from './TimContractGenerator';
import CommissionCalculator from './CommissionCalculator';
import TicketsManagement from './TicketsManagement';
import { User, UserRole, Goal, Ticket, Lead, AccessRequest } from '../types';
import { supabase, supabaseClient, buildSSOUrl } from '../lib/supabase';

interface ToolsProps {
  user: User;
  allUsers: User[];
  onLogTool: (name: string) => void;
  globalGoals: Goal[];
  tickets: Ticket[];
  leadsForTickets: Lead[];
  onAddGoal: (goal: Goal) => void;
  onDeleteGoal: (id: string) => void;
  onUpdateGoalProgress: (id: string, amount: number) => void;
  onTicketUpdate: (ticket: Ticket) => Promise<void>;
  onRefreshGoals?: () => Promise<void>;
  onCelebrate?: (goal: Goal) => void;
  accessRequests: AccessRequest[];
  onRequestAccess: (toolId: string, toolName: string) => Promise<void>;
  onApproveAccess: (requestId: string) => Promise<void>;
  systemLogo?: string | null;
}

const TOOL_CARDS = [
  { id: 'clock', title: 'Relógio Ponto', desc: 'Registro de jornada sincronizado.', icon: <Clock />, restricted: false, image: 'https://images.unsplash.com/photo-1508962914676-134849a727f0?auto=format&fit=crop&q=80&w=800' },
  { id: 'goals', title: 'Gestão de Metas', desc: 'Desafios e acompanhamento da equipe.', icon: <Target />, restricted: true, image: 'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&q=80&w=800' },
  { id: 'tickets', title: 'Chamados', desc: 'Suporte administrativo e correções.', icon: <LifeBuoy />, restricted: false, image: 'https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?auto=format&fit=crop&q=80&w=800' },
  { id: 'chips', title: 'Controle de Chip', desc: 'Gerencie status de linhas e aquecimento.', icon: <Smartphone />, restricted: 'request', image: 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?auto=format&fit=crop&q=80&w=800' },
  { id: 'tim', title: 'TIM Ap. Contrato', desc: 'Gerador de Termo de Contratação.', icon: <Receipt />, restricted: false, image: 'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&q=80&w=800' },
  { id: 'calc', title: 'Calculadora de Comissão', desc: 'Simule comissões e resultados.', icon: <Calculator />, restricted: false, image: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&q=80&w=800' },
  { id: 'sales', title: 'Espelho de Vendas', desc: 'Cálculo de comissões via planilha.', icon: <FileSpreadsheet />, restricted: true, image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=800' },
  { id: 'receipt', title: 'Comprovante Pagamento', desc: 'Gerar comprovante bancário oficial.', icon: <Receipt />, restricted: true, image: 'https://images.unsplash.com/photo-1556742044-3c52d6e88c62?auto=format&fit=crop&q=80&w=800' },
  { id: 'sim', title: 'Simulador de Extrato', desc: 'Geração de extratos de alta fidelidade.', icon: <FileText />, restricted: true, image: 'https://images.unsplash.com/photo-1554224154-26032ffc0d07?auto=format&fit=crop&q=80&w=800' },
  { id: 'statute', title: 'Simulador de estatuto e ata', desc: 'Simule e gere documentos de estatutos e atas.', icon: <FileText />, restricted: false, image: 'https://i.imgur.com/redb89o.png' },
  { id: 'faturas-simulador', title: 'Simulador de Faturas', desc: 'Simulação e análise detalhada de faturas de telefonia.', icon: <Calculator />, restricted: false, image: 'https://vcx.solutions/wp-content/uploads/2024/02/Simulador-de-Faturas.png.webp' },
];

const Tools: React.FC<ToolsProps> = ({ 
  user, 
  allUsers, 
  onLogTool, 
  globalGoals, 
  tickets,
  leadsForTickets,
  onAddGoal, 
  onDeleteGoal, 
  onUpdateGoalProgress,
  onTicketUpdate,
  onRefreshGoals,
  onCelebrate,
  accessRequests,
  onRequestAccess,
  onApproveAccess,
  systemLogo
}) => {
  const [activeTool, setActiveTool] = useState<string | null>(null);

  useEffect(() => {
    if (activeTool) {
      console.log('Active tool changed to:', activeTool);
    }
  }, [activeTool]);

  const isPrivileged = useMemo(() => {
    const role = (user.role || '').toUpperCase();
    return ['OWNER', 'SUPERVISOR', 'ADMINISTRATIVO', 'ADMINISTRADOR'].includes(role);
  }, [user.role]);

  const checkAccess = (tool: any) => {
    if (user.role === 'ADVOGADO' || user.role === UserRole.ADVOGADO) return false;
    if (isPrivileged) return true;
    
    // Check for temporary access
    const tempAccess = accessRequests.find(req => 
      req.userId === user.id && 
      req.toolId === tool.id && 
      req.status === 'APPROVED' &&
      req.expiresAt && new Date(req.expiresAt) > new Date()
    );
    
    if (tempAccess) return true;

    if (tool.restricted === true) return false;
    if (tool.restricted === 'request') return false; 
    return true;
  };

  const handleOpenTool = async (tool: any) => {
    const hasAccess = checkAccess(tool);

    if (!hasAccess) {
      if (tool.id === 'chips') {
        const pendingRequest = accessRequests.find(r => r.userId === user.id && r.toolId === tool.id && r.status === 'PENDING');
        if (pendingRequest) {
          alert("Sua solicitação já foi enviada. Aguarde a autorização do Owner/Supervisor.");
          return;
        }

        const confirmRequest = window.confirm("Você não tem permissão para acessar o Controle de Chip. Deseja pedir permissão para entrar?");
        if (confirmRequest) {
          await onRequestAccess(tool.id, tool.title);
          alert("Sua solicitação foi enviada para o Owner/Supervisor. Aguarde a autorização.");
        }
      } else {
        alert("Acesso restrito. Esta ferramenta está disponível apenas para Owner, Supervisor e Administrativo.");
      }
      return;
    }

    onLogTool(tool.title);
    
    // SSO Handover logic for external vecgroup tools
    const handleExternalRedirect = async (url: string, newTab: boolean = true) => {
      try {
        let finalUrl = url;
        if (url.includes('vecgroup.com.br') || url.includes('timempresas.shop')) {
          finalUrl = await buildSSOUrl(url, { user_email: user?.email });
        }
        
        if (newTab) {
          window.open(finalUrl, '_blank');
        } else {
          window.location.href = finalUrl;
        }
      } catch (err) {
        if (newTab) {
          window.open(url, '_blank');
        } else {
          window.location.href = url;
        }
      }
    };
    
    if (tool.id === 'receipt') {
      handleExternalRedirect('https://comprovantepagamento.vecgroup.com.br/', true);
      return;
    }

    if (tool.id === 'sim') {
      handleExternalRedirect('https://geradorfat.vecgroup.com.br/', true);
      return;
    }

    if (tool.id === 'statute') {
      handleExternalRedirect('https://ataestatuto.vecgroup.com.br/', false);
      return;
    }

    if (tool.id === 'faturas-simulador') {
      handleExternalRedirect('https://faturasonline.vecgroup.com.br/', true);
      return;
    }

    setActiveTool(tool.id);
  };

  if (activeTool === 'clock') return <TimeClock user={user} allUsers={allUsers} onBack={() => setActiveTool(null)} />;
  if (activeTool === 'goals') return (
    <GoalsManagement 
      user={user} 
      allUsers={allUsers} 
      onBack={() => setActiveTool(null)} 
      onAddGoal={onAddGoal} 
      goals={globalGoals} 
      onDeleteGoal={onDeleteGoal} 
      onUpdateGoalProgress={onUpdateGoalProgress} 
      onRefreshGoals={onRefreshGoals}
      onCelebrate={onCelebrate}
      systemLogo={systemLogo}
    />
  );
  if (activeTool === 'tickets') return (
    <TicketsManagement 
      user={user} 
      tickets={tickets}
      leads={leadsForTickets}
      onBack={() => setActiveTool(null)} 
      onUpdateTicket={onTicketUpdate}
    />
  );
  if (activeTool === 'chips') return <ChipControl user={user} allUsers={allUsers} onBack={() => setActiveTool(null)} />;
  if (activeTool === 'tim') return <TimContractGenerator user={user} allUsers={allUsers} onBack={() => setActiveTool(null)} />;
  if (activeTool === 'calc') return <CommissionCalculator onBack={() => setActiveTool(null)} />;

  return (
    <div className="space-y-12 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tighter uppercase font-display">Ferramentas</h1>
          <p className="text-white/40 mt-2 font-bold uppercase tracking-widest text-[10px]">
            Ecossistema <span className="text-[#00A1E4]">VEC GROUP</span> • Ferramentas de Apoio
          </p>
        </div>
      </div>

      {isPrivileged && accessRequests.some(r => r.status === 'PENDING') && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-[2rem] p-8 animate-in slide-in-from-top duration-500">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <Shield className="text-amber-500" size={24} />
              <h2 className="text-xl font-black text-white uppercase tracking-tighter">Solicitações de Acesso Pendentes</h2>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {accessRequests.filter(r => r.status === 'PENDING').map(req => (
              <div key={req.id} className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col justify-between">
                <div>
                  <p className="text-[10px] font-black text-[#00A1E4] uppercase tracking-widest mb-1">{req.userName}</p>
                  <p className="text-sm font-bold text-white mb-4">Solicitou acesso ao {req.toolName}</p>
                </div>
                <div className="flex items-center space-x-2">
                  <button 
                    onClick={() => onApproveAccess(req.id)}
                    className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors"
                  >
                    Autorizar (1h)
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
        {TOOL_CARDS.map((tool) => {
          const hasAccess = checkAccess(tool);
          return (
            <motion.div 
              key={tool.id} 
              whileHover={hasAccess ? { scale: 1.02, y: -5 } : {}}
              whileTap={hasAccess ? { scale: 0.98 } : {}}
              onClick={() => handleOpenTool(tool)}
              className={`group relative h-[350px] overflow-hidden rounded-[2.5rem] cursor-pointer shadow-2xl border border-white/10 transition-all duration-500 ${hasAccess ? 'bg-[#001a4d]' : 'bg-slate-900/50 grayscale opacity-60'}`}
            >
              <img 
                src={tool.image} 
                alt={tool.title}
                referrerPolicy="no-referrer"
                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${hasAccess ? 'opacity-80 group-hover:opacity-100' : 'opacity-20'}`}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#000d26] via-[#000d26]/40 to-transparent" />
              
              <div className="absolute inset-0 p-8 flex flex-col justify-end">
                <div className={`mb-4 w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg transition-all ${hasAccess ? 'bg-[#00A1E4] shadow-[#00A1E4]/20' : 'bg-slate-700 shadow-none'}`}>
                  {hasAccess ? React.cloneElement(tool.icon as React.ReactElement, { size: 24 }) : <Lock size={24} />}
                </div>
                <h3 className={`text-xl font-black uppercase tracking-tighter mb-2 ${hasAccess ? 'text-white' : 'text-slate-500'}`}>{tool.title}</h3>
                <p className={`text-[10px] font-bold uppercase tracking-widest leading-relaxed ${hasAccess ? 'text-white/60' : 'text-slate-600'}`}>
                  {tool.desc}
                </p>
                <div className={`mt-6 flex items-center font-black text-[10px] uppercase tracking-[0.2em] transition-opacity ${hasAccess ? 'text-[#00A1E4] opacity-0 group-hover:opacity-100' : 'text-slate-600 opacity-100'}`}>
                  <span>{hasAccess ? 'Abrir Ferramenta' : 'Acesso Restrito'}</span>
                  {hasAccess ? <ChevronRight size={14} className="ml-1" /> : <Lock size={12} className="ml-1" />}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default Tools;
