
import React from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Settings,
  Wrench, 
  PhoneCall, 
  Send, 
  MessageSquare,
  RefreshCcw,
  CheckCircle,
  ShieldAlert,
  Handshake,
  FileSearch,
  AlertTriangle,
  XCircle,
  FileCheck2,
  PhoneForwarded,
  Slash,
  History,
  Search,
  ClipboardCheck,
  UserCheck,
  LifeBuoy
} from 'lucide-react';
import { LeadStatus, UserRole } from './types';

export const STATUS_COLORS: Record<LeadStatus, string> = {
  [LeadStatus.ENTRAR_CONTATO]: 'bg-[#e0f2fe] text-[#0369a1] border-[#bae6fd]',
  [LeadStatus.ENVIADO_TIM]: 'bg-[#f3e8ff] text-[#7e22ce] border-[#e9d5ff]',
  [LeadStatus.ENVIADO_ALIVE]: 'bg-[#fff7ed] text-[#c2410c] border-[#ffedd5]',
  [LeadStatus.NEGOCIANDO]: 'bg-[#ecfeff] text-[#0e7490] border-[#cffafe]',
  [LeadStatus.RENOVADO]: 'bg-[#eef2ff] text-[#4338ca] border-[#e07ff]',
  [LeadStatus.FECHADO]: 'bg-[#f0fdf4] text-[#15803d] border-[#dcfce7]',
  [LeadStatus.SEM_INTERESSE]: 'bg-slate-100 text-slate-500 border-slate-200',
  [LeadStatus.COLETA_ASSINATURA]: 'bg-amber-50 text-amber-700 border-amber-200',
  [LeadStatus.CONFIRMACAO_TELEFONICA]: 'bg-blue-50 text-blue-700 border-blue-200',
  [LeadStatus.EM_ANALISE]: 'bg-slate-100 text-slate-700 border-slate-200',
  [LeadStatus.VALIDANDO]: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  [LeadStatus.VALIDANDO_PORTABILIDADE]: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  [LeadStatus.REPROVADO]: 'bg-red-50 text-red-700 border-red-200',
  [LeadStatus.CANCELADO]: 'bg-gray-100 text-gray-700 border-gray-300',
  [LeadStatus.ESTORNADO]: 'bg-rose-50 text-rose-700 border-rose-200',
  [LeadStatus.CORRECAO_CONSULTOR]: 'bg-orange-50 text-orange-700 border-orange-200',
  [LeadStatus.FINALIZADO]: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  [LeadStatus.RENOVAR]: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  [LeadStatus.R_ASSINATURA]: 'bg-violet-50 text-violet-700 border-violet-200',
  [LeadStatus.R_CONFIRMACAO]: 'bg-blue-50 text-blue-700 border-blue-200',
  [LeadStatus.R_ANALISE]: 'bg-slate-100 text-slate-700 border-slate-200',
  [LeadStatus.R_VALIDANDO]: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  [LeadStatus.R_FECHADO]: 'bg-emerald-100 text-emerald-800 border-emerald-200',
};

export const STATUS_ACCENT_COLORS: Record<LeadStatus, string> = {
  [LeadStatus.ENTRAR_CONTATO]: 'bg-blue-500',
  [LeadStatus.ENVIADO_TIM]: 'bg-purple-500',
  [LeadStatus.ENVIADO_ALIVE]: 'bg-orange-500',
  [LeadStatus.NEGOCIANDO]: 'bg-cyan-500',
  [LeadStatus.RENOVADO]: 'bg-indigo-500',
  [LeadStatus.FECHADO]: 'bg-emerald-500',
  [LeadStatus.SEM_INTERESSE]: 'bg-slate-400',
  [LeadStatus.COLETA_ASSINATURA]: 'bg-amber-500',
  [LeadStatus.CONFIRMACAO_TELEFONICA]: 'bg-blue-600',
  [LeadStatus.EM_ANALISE]: 'bg-slate-500',
  [LeadStatus.VALIDANDO]: 'bg-indigo-600',
  [LeadStatus.VALIDANDO_PORTABILIDADE]: 'bg-cyan-600',
  [LeadStatus.REPROVADO]: 'bg-red-600',
  [LeadStatus.CANCELADO]: 'bg-gray-600',
  [LeadStatus.ESTORNADO]: 'bg-rose-600',
  [LeadStatus.CORRECAO_CONSULTOR]: 'bg-orange-600',
  [LeadStatus.FINALIZADO]: 'bg-emerald-600',
  [LeadStatus.RENOVAR]: 'bg-indigo-600',
  [LeadStatus.R_ASSINATURA]: 'bg-violet-600',
  [LeadStatus.R_CONFIRMACAO]: 'bg-blue-600',
  [LeadStatus.R_ANALISE]: 'bg-slate-600',
  [LeadStatus.R_VALIDANDO]: 'bg-indigo-600',
  [LeadStatus.R_FECHADO]: 'bg-emerald-600',
};

export const STATUS_ICONS: Record<LeadStatus, React.ReactNode> = {
  [LeadStatus.ENTRAR_CONTATO]: <PhoneCall size={14} />,
  [LeadStatus.ENVIADO_TIM]: <Send size={14} />,
  [LeadStatus.ENVIADO_ALIVE]: <Send size={14} />,
  [LeadStatus.NEGOCIANDO]: <MessageSquare size={14} />,
  [LeadStatus.RENOVADO]: <RefreshCcw size={14} />,
  [LeadStatus.FECHADO]: <CheckCircle size={14} />,
  [LeadStatus.SEM_INTERESSE]: <Slash size={14} />,
  [LeadStatus.COLETA_ASSINATURA]: <FileSearch size={14} />,
  [LeadStatus.CONFIRMACAO_TELEFONICA]: <PhoneForwarded size={14} />,
  [LeadStatus.EM_ANALISE]: <RefreshCcw size={14} />,
  [LeadStatus.VALIDANDO]: <Search size={14} />,
  [LeadStatus.VALIDANDO_PORTABILIDADE]: <RefreshCcw size={14} />,
  [LeadStatus.REPROVADO]: <AlertTriangle size={14} />,
  [LeadStatus.CANCELADO]: <XCircle size={14} />,
  [LeadStatus.ESTORNADO]: <RefreshCcw size={14} />,
  [LeadStatus.CORRECAO_CONSULTOR]: <AlertTriangle size={14} />,
  [LeadStatus.FINALIZADO]: <FileCheck2 size={14} />,
  [LeadStatus.RENOVAR]: <History size={14} />,
  [LeadStatus.R_ASSINATURA]: <ClipboardCheck size={14} />,
  [LeadStatus.R_CONFIRMACAO]: <UserCheck size={14} />,
  [LeadStatus.R_ANALISE]: <RefreshCcw size={14} />,
  [LeadStatus.R_VALIDANDO]: <Search size={14} />,
  [LeadStatus.R_FECHADO]: <CheckCircle size={14} />,
};

export const getNavItems = (role: string) => {
  const currentRole = (role || '').toUpperCase();
  const items = [
    { 
      id: 'whatsapp', 
      label: 'WHATSAPP', 
      icon: (
        <div className="w-5 h-5 rounded flex items-center justify-center overflow-hidden shrink-0">
          <img 
            src="https://i.imgur.com/Y1YwAp2.png" 
            alt="WhatsApp" 
            className="w-full h-full object-contain"
            referrerPolicy="no-referrer"
          />
        </div>
      ),
      description: 'Central de WhatsApp CRM e atendimento integrado.',
      image: 'https://i.imgur.com/Y1YwAp2.png'
    },
    { 
      id: 'closed-leads', 
      label: 'CLIENTES FECHADOS', 
      icon: <Handshake size={20} />,
      url: 'https://clientesfechados.vecgroup.com.br',
      description: 'Arquivo de contratos finalizados e pós-venda.',
      image: 'https://img.freepik.com/fotos-premium/outro-negocio-fechado-closeup-de-dois-empresarios-apertando-as-maos-generative-ai_60438-2593.jpg'
    },
    { 
      id: 'leads', 
      label: 'VIVO LEADS', 
      icon: <Users size={20} />, 
      url: 'https://leads.vecgroup.com.br',
      restricted: ['OWNER', 'SUPERVISOR', 'ADMINISTRATIVO', 'ADMINISTRADOR', 'VENDEDOR'],
      description: 'Gerenciamento completo de prospecção e funil de vendas.',
      image: 'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&q=80&w=800'
    },
    { 
      id: 'tim-leads', 
      label: 'TIM LEADS', 
      icon: <Users size={20} />, 
      url: 'https://leadstim.vecgroup.com.br',
      restricted: ['OWNER', 'SUPERVISOR', 'ADMINISTRATIVO', 'ADMINISTRADOR', 'VENDEDOR'],
      description: 'Acesso rápido ao sistema de leads da TIM.',
      image: 'https://images.unsplash.com/photo-1557426272-fc759fdf7a8d?auto=format&fit=crop&q=80&w=800'
    },
    { 
      id: 'tickets', 
      label: 'CHAMADOS', 
      icon: <LifeBuoy size={20} />,
      restricted: ['OWNER', 'SUPERVISOR', 'ADMINISTRATIVO', 'ADMINISTRADOR', 'VENDEDOR'],
      description: 'Suporte técnico e administrativo para a operação.',
      image: 'https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?auto=format&fit=crop&q=80&w=800'
    },
    { 
      id: 'users', 
      label: 'GESTÃO DE USUÁRIOS', 
      icon: <ShieldAlert size={20} />, 
      restricted: ['OWNER', 'SUPERVISOR', 'ADMINISTRATIVO', 'ADMINISTRADOR'],
      description: 'Controle de acessos, permissões e perfis da equipe.',
      image: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&q=80&w=800'
    },
    { 
      id: 'settings', 
      label: 'CONFIGURAÇÕES', 
      icon: <Settings size={20} />,
      description: 'Personalização da plataforma e dados da conta.',
      image: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&q=80&w=800'
    },
    { 
      id: 'tools', 
      label: 'FERRAMENTAS', 
      icon: <Wrench size={20} />,
      description: 'Utilitários, calculadoras e geradores de documentos.',
      image: 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?auto=format&fit=crop&q=80&w=800'
    },
  ];

  return items.filter(item => {
    if (currentRole === 'ADVOGADO') return true;
    if (!item.restricted) return true;
    return item.restricted.includes(currentRole);
  });
};
