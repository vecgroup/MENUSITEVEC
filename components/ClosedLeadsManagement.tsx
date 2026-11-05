/* 
 * CRITICAL: CLOSED LEADS & RENEWAL MODULE - PROTECTED ZONE
 * -------------------------------------------------------
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Search, Filter, Building, Trash2, ChevronLeft, ChevronRight, ChevronsLeft,
  ChevronsRight, ChevronDown, Check, CheckCircle2, X, CheckSquare, Square,
  Activity, History, Loader2, Calendar, Smartphone, DollarSign, UserPlus,
  RefreshCw, Save, Building2, AlertTriangle
} from 'lucide-react';
import { Lead, LeadStatus, User, UserRole, LeadNote } from '../types';
import { STATUS_COLORS, STATUS_ICONS, STATUS_ACCENT_COLORS } from '../constants';
import { supabase } from '../lib/supabase';
import LeadDetailsModal from './LeadDetailsModal';
import { formatDateBR } from './LeadsManagement';

interface ClosedLeadsManagementProps { 
  user: User; 
  allUsers: User[];
  leads: Lead[];
  onUpdateLead: (lead: Lead) => Promise<void>;
  onBulkUpdateLeads?: (leads: Lead[]) => Promise<void>;
  onDeleteLeads: (ids: string[]) => void;
  dbStats?: any;
  onOpenWhatsApp?: (options: { phone?: string; cnpj?: string; leadName?: string; company?: string; leadId?: string }) => void;
}

const FilterInput = ({ placeholder, value, onChange }: { placeholder: string, value: string, onChange: (v: string) => void }) => (
  <input type="text" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} className="w-full text-[9px] font-black uppercase bg-white border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none shadow-inner" />
);

const DateRangeFilter = ({ startValue, endValue, onStartChange, onEndChange }: any) => (
  <div className="flex flex-col space-y-1 p-1 bg-white border border-slate-200 rounded-lg shadow-inner min-w-[120px]">
    <div className="flex items-center bg-slate-50 px-2 py-1 rounded">
      <span className="text-[7px] font-black text-slate-400 mr-1">DE:</span>
      <input type="date" value={startValue} onChange={(e) => onStartChange(e.target.value)} className="text-[8px] font-bold border-none bg-transparent focus:outline-none w-full text-slate-700" />
    </div>
    <div className="flex items-center bg-slate-50 px-2 py-1 rounded">
      <span className="text-[7px] font-black text-slate-400 mr-1">ATÉ:</span>
      <input type="date" value={endValue} onChange={(e) => onEndChange(e.target.value)} className="text-[8px] font-bold border-none bg-transparent focus:outline-none w-full text-slate-700" />
    </div>
  </div>
);

const ToggleSwitch = ({ label, enabled, onChange, disabled, dateInfo }: { label: string, enabled: boolean, onChange: (val: boolean) => void, disabled?: boolean, dateInfo?: string }) => {
  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    onChange(!enabled);
  };
  return (
    <div className="flex flex-col items-center justify-center min-w-[100px] py-1">
      <button type="button" disabled={disabled} onClick={handleToggle} className={`w-10 h-5 rounded-full relative transition-all duration-300 ${enabled ? 'bg-emerald-500' : 'bg-slate-200'} ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:scale-110 shadow-sm'}`}>
        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-md transition-all duration-300 ${enabled ? 'left-[22px]' : 'left-0.5'}`} />
      </button>
      <div className="flex flex-col items-center mt-1 text-center w-full leading-tight min-h-[22px]"><span className="text-[9px] font-black uppercase tracking-tighter text-slate-400 mb-0.5">{label}</span>{enabled && dateInfo && (<span className="text-[10px] font-black text-[#2563eb] whitespace-nowrap block animate-in fade-in slide-in-from-top-1">{formatDateBR(dateInfo)}</span>)}</div>
    </div>
  );
};

const parseDateForFilter = (d: string | undefined | null) => {
  if (!d) return null;
  if (d.includes('/')) {
    const parts = d.split(' ')[0].split('/');
    if (parts.length === 3) return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
  }
  const isoDate = new Date(d);
  return isNaN(isoDate.getTime()) ? null : isoDate;
};

const ClosedLeadsManagement: React.FC<ClosedLeadsManagementProps> = ({ user, allUsers, leads, onUpdateLead, onBulkUpdateLeads, onDeleteLeads, dbStats, onOpenWhatsApp }) => {
  const [activeSubTab, setActiveSubTab] = useState<'closed' | 'renewed'>('closed');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [showColFilters, setShowColFilters] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
  const [showBulkStatusMenu, setShowBulkStatusMenu] = useState(false);
  const [portPromptLead, setPortPromptLead] = useState<Lead | null>(null);
  const [portDateInput, setPortDateInput] = useState('');
  const [urlParamCnpj, setUrlParamCnpj] = useState<string | null>(null);

  const [colFilters, setColFilters] = useState({ ELEMENTO: '', CNPJ: '', razaoSocial: '', estado: '', dateStart: '', dateEnd: '', Status: '', Vendedor: '', Telefone: '', operadora: '', ATIVOS: '' });

  const [phoneSearchResults, setPhoneSearchResults] = useState<Lead[] | null>(null);
  const [isPhoneSearching, setIsPhoneSearching] = useState(false);
  const phoneAbortRef = useRef<AbortController | null>(null);
  const phoneDebounceRef = useRef<any>(null);
  const urlParamsCheckedRef = useRef(false);

  const POST_SALES_STATUSES = [
    LeadStatus.FECHADO, LeadStatus.COLETA_ASSINATURA, LeadStatus.CONFIRMACAO_TELEFONICA, LeadStatus.EM_ANALISE, LeadStatus.VALIDANDO, LeadStatus.VALIDANDO_PORTABILIDADE, 
    LeadStatus.REPROVADO, LeadStatus.CANCELADO, LeadStatus.ESTORNADO, LeadStatus.CORRECAO_CONSULTOR, LeadStatus.FINALIZADO, LeadStatus.RENOVAR
  ];

  const RENEWAL_STATUSES = [ LeadStatus.RENOVAR, LeadStatus.R_ASSINATURA, LeadStatus.R_CONFIRMACAO, LeadStatus.R_ANALISE, LeadStatus.R_VALIDANDO, LeadStatus.R_FECHADO ];

  // Executa apenas uma vez para processar parâmetros da URL sem disparar loops
  useEffect(() => {
    if (urlParamsCheckedRef.current) return;
    const params = new URLSearchParams(window.location.search);
    let urlCnpj = params.get('cnpj') || params.get('CNPJ');
    
    if (!urlCnpj && window.location.hash) {
      if (window.location.hash.split('?')[1]) {
        const hashParams = new URLSearchParams(window.location.hash.split('?')[1]);
        urlCnpj = hashParams.get('cnpj') || hashParams.get('CNPJ');
      }
      if (!urlCnpj) {
        const hashParts = window.location.hash.slice(1).split('&');
        for (const part of hashParts) {
          const [key, val] = part.split('=');
          if (key === 'cnpj' || key === 'CNPJ') {
            urlCnpj = decodeURIComponent(val);
            break;
          }
        }
      }
    }
    
    if (urlCnpj) {
      urlParamsCheckedRef.current = true;
      const cleanCnpj = urlCnpj.trim();
      setSearchTerm(cleanCnpj);
      setUrlParamCnpj(cleanCnpj);
      
      const rawDigits = cleanCnpj.replace(/\D/g, '');
      if (rawDigits) {
        const matchingLead = leads.find(l => {
          const lCnpj = (l.CNPJ || '').replace(/\D/g, '');
          return lCnpj === rawDigits;
        });
        
        if (matchingLead) {
          const currentStatus = (matchingLead.Status || '').toLowerCase().trim();
          const isRenewedStatus = RENEWAL_STATUSES.some(s => s.toLowerCase().trim() === currentStatus && s !== LeadStatus.RENOVAR);
          if (isRenewedStatus) {
            setActiveSubTab('renewed');
          } else {
            setActiveSubTab('closed');
          }
        }
      }
    }
  }, []);

  const isPrivileged = useMemo(() => {
    const roleStr = String(user.role || '').toUpperCase();
    return ['OWNER', 'SUPERVISOR', 'ADMINISTRATIVO', 'ADMIN', 'ADMINISTRADOR', 'ADVOGADO'].includes(roleStr);
  }, [user.role]);

  const allUsersRef = useRef(allUsers);
  allUsersRef.current = allUsers;

  // Busca por telefone com debounce de 600ms, mínimo de 8 dígitos, cancelamento da requisição anterior via AbortController
  useEffect(() => {
    const rawPhone = colFilters.Telefone || '';
    const cleanDigits = rawPhone.replace(/\D/g, '');

    // 1. Cancela IMEDIATAMENTE qualquer requisição que já esteja rodando no Supabase ao digitar/alterar filtro
    if (phoneAbortRef.current) {
      phoneAbortRef.current.abort('Nova digitação ou alteração de filtro');
      phoneAbortRef.current = null;
    }

    // 2. Limpa qualquer timer de debounce agendado anteriormente
    if (phoneDebounceRef.current) {
      clearTimeout(phoneDebounceRef.current);
      phoneDebounceRef.current = null;
    }

    // 3. Se tiver menos de 8 dígitos, limpa resultados da busca e não consulta o banco
    if (cleanDigits.length < 8) {
      setIsPhoneSearching(false);
      setPhoneSearchResults(null);
      return;
    }

    setIsPhoneSearching(true);

    // 4. Cria o novo AbortController com antecedência para poder ser abortado caso o usuário digite novamente durante o debounce
    const controller = new AbortController();
    phoneAbortRef.current = controller;

    phoneDebounceRef.current = setTimeout(async () => {
      // Filtro de vendedor: se houver assigned_to (ou usuário identificado), filtrar SÓ por assigned_to = id (sem o OR vendedor ilike).
      // Usa o filtro por nome apenas para leads antigos que não têm assigned_to.
      let assignedToId: string | undefined;
      let legacySellerName: string | undefined;

      const currentUsers = allUsersRef.current || [];
      if (colFilters.Vendedor && colFilters.Vendedor.trim()) {
        const vendorUpper = colFilters.Vendedor.trim().toUpperCase();
        const found = currentUsers.find(u => u.name.toUpperCase().trim() === vendorUpper);
        if (found?.id) {
          assignedToId = found.id;
        } else {
          legacySellerName = colFilters.Vendedor.trim();
        }
      } else if (!isPrivileged && user?.id) {
        assignedToId = user.id;
      }

      // Status: valor exato
      const exactStatus = colFilters.Status ? colFilters.Status.trim() : undefined;

      try {
        const res = await supabase.clientes_fechados.searchByPhone({
          phone: cleanDigits,
          status: exactStatus,
          assignedTo: assignedToId,
          vendedorName: legacySellerName,
          signal: controller.signal,
          limit: 100
        });

        if (!controller.signal.aborted) {
          if (!res.error && res.data) {
            setPhoneSearchResults(res.data);
          }
          setIsPhoneSearching(false);
        }
      } catch (err: any) {
        if (!controller.signal.aborted) {
          setIsPhoneSearching(false);
        }
      }
    }, 600);

    return () => {
      if (phoneDebounceRef.current) {
        clearTimeout(phoneDebounceRef.current);
        phoneDebounceRef.current = null;
      }
      if (phoneAbortRef.current) {
        phoneAbortRef.current.abort('Componente desmontado ou dependência alterada');
        phoneAbortRef.current = null;
      }
    };
  }, [colFilters.Telefone, colFilters.Status, colFilters.Vendedor, isPrivileged, user?.id]);

  const baseLeads = useMemo(() => {
    if (phoneSearchResults !== null) {
      const map = new Map<string, Lead>();
      phoneSearchResults.forEach(l => map.set(l.id, l));
      leads.forEach(l => {
        if (!map.has(l.id)) map.set(l.id, l);
      });
      return Array.from(map.values());
    }
    return leads;
  }, [leads, phoneSearchResults]);

  const filteredLeads = useMemo(() => {
    const cleanFilterPhone = colFilters.Telefone.replace(/\D/g, '');
    const vendorFilter = colFilters.Vendedor.trim().toUpperCase();
    const statusFilter = colFilters.Status.trim().toUpperCase();

    return baseLeads.filter(l => {
      const rawSearch = searchTerm.replace(/\D/g, '');
      const matchSearch = (l.razaoSocial || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (l.CNPJ || '').includes(searchTerm) ||
                          (rawSearch !== '' && (l.CNPJ || '').replace(/\D/g, '').includes(rawSearch));
      const leadDate = parseDateForFilter(l.dataFechamento || l.DATA_Consulta);
      const start = colFilters.dateStart ? new Date(colFilters.dateStart + 'T00:00:00') : null;
      const end = colFilters.dateEnd ? new Date(colFilters.dateEnd + 'T23:59:59') : null;
      let dateMatch = true;
      if (start && leadDate && leadDate < start) dateMatch = false;
      if (end && leadDate && leadDate > end) dateMatch = false;
      
      const currentStatus = (l.Status || '').toLowerCase().trim();
      
      if (activeSubTab === 'renewed') {
         // Na aba renovação, só mostramos se o status bater com os de renovação
         if (!RENEWAL_STATUSES.some(s => s.toLowerCase().trim() === currentStatus)) return false;
      } else {
         // Na aba vendas ativas, mostramos tudo que veio da tabela de fechados OU tem status de pós-venda,
         // mas filtramos se estiver explicitamente na lista de renovação para não duplicar.
         if (RENEWAL_STATUSES.some(s => s.toLowerCase().trim() === currentStatus && s !== LeadStatus.RENOVAR)) return false;
      }

      // Status: igualdade exata
      const statusMatch = !statusFilter || (l.Status || '').trim().toUpperCase() === statusFilter;

      // Vendedor: quando há ID assigned_to, compara diretamente; caso contrário, compara nome
      let vendorMatch = true;
      if (vendorFilter) {
        const foundUser = allUsers.find(u => u.name.toUpperCase().trim() === vendorFilter);
        if (foundUser?.id && (l as any).assigned_to) {
          vendorMatch = (l as any).assigned_to === foundUser.id;
        } else {
          vendorMatch = (l.Vendedor || '').toUpperCase().includes(vendorFilter);
        }
      }

      // Telefone: compara dígitos limpos em todos os telefones de contato
      let phoneMatch = true;
      if (cleanFilterPhone) {
        const phones = [
          (l.Telefone_Principal || '').replace(/\D/g, ''),
          (l.CELULAR || '').replace(/\D/g, ''),
          (l.CELULAR_02 || '').replace(/\D/g, ''),
          (l.CELULAR_03 || '').replace(/\D/g, ''),
          (l.CELULAR_04 || '').replace(/\D/g, ''),
          (l.CELULAR_05 || '').replace(/\D/g, '')
        ];
        phoneMatch = phones.some(p => p.includes(cleanFilterPhone));
      }

      return matchSearch && dateMatch && statusMatch && vendorMatch && phoneMatch &&
        (l.ELEMENTO || '').toLowerCase().includes(colFilters.ELEMENTO.toLowerCase()) && 
        (l.CNPJ || '').includes(colFilters.CNPJ) && 
        (l.razaoSocial || '').toLowerCase().includes(colFilters.razaoSocial.toLowerCase()) && 
        (l.estado || '').toLowerCase().includes(colFilters.estado.toLowerCase()) && 
        (l.operadora || '').toLowerCase().includes(colFilters.operadora.toLowerCase()) && 
        (l.ATIVOS || '').includes(colFilters.ATIVOS);
    });
  }, [baseLeads, searchTerm, colFilters, activeSubTab, allUsers]);

  const totalItems = filteredLeads.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const paginatedLeads = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredLeads.slice(start, start + itemsPerPage);
  }, [filteredLeads, currentPage, itemsPerPage]);

  useEffect(() => { setCurrentPage(1); }, [searchTerm, colFilters, itemsPerPage, activeSubTab]);

  const getVendedorInfo = (vendedorName: string) => {
    const found = allUsers.find(u => u.name.toUpperCase() === vendedorName.toUpperCase());
    return { avatar: found?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(vendedorName)}&background=random`, fullName: found?.name || vendedorName };
  };

  const handleRowSelect = (e: React.MouseEvent, id: string, index: number) => {
    e.stopPropagation();
    const newSelected = new Set(selectedIds);
    if (e.shiftKey && lastSelectedIndex !== null) {
      const start = Math.min(lastSelectedIndex, index);
      const end = Math.max(lastSelectedIndex, index);
      const range = paginatedLeads.slice(start, end + 1);
      const shouldSelect = !selectedIds.has(id);
      range.forEach(l => shouldSelect ? newSelected.add(l.id) : newSelected.delete(l.id));
    } else {
      if (newSelected.has(id)) newSelected.delete(id);
      else newSelected.add(id);
      setLastSelectedIndex(index);
    }
    setSelectedIds(newSelected);
  };

  const handleBulkStatusChange = async (newStatus: LeadStatus) => {
    if (!onBulkUpdateLeads) return;
    const leadsToUpdate = leads.filter(l => selectedIds.has(l.id)).map(l => ({ ...l, Status: newStatus }));
    await onBulkUpdateLeads(leadsToUpdate); 
    setSelectedIds(new Set()); 
    setShowBulkStatusMenu(false);
  };

  const handlePagoToggle = async (lead: Lead, val: boolean) => { await onUpdateLead({ ...lead, isPago: val }); };
  const handlePortToggle = async (lead: Lead, val: boolean) => { 
    if (val) { 
      setPortPromptLead(lead); 
      const now = new Date();
      const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      setPortDateInput(localDate); 
    } else { 
      await onUpdateLead({ ...lead, isPortado: false, dataPortabilidade: "" }); 
    } 
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-24 relative">
      {portPromptLead && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-100 relative">
            <div className="bg-emerald-600 p-8 flex flex-col items-center text-white">
              <Calendar size={32} className="mb-4" />
              <h4 className="text-lg font-black uppercase tracking-tighter">Data de Portabilidade</h4>
            </div>
            <div className="p-10 space-y-6">
              <input type="date" value={portDateInput} onChange={(e) => setPortDateInput(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-bold focus:outline-none" />
              <div className="flex space-x-3">
                <button onClick={() => setPortPromptLead(null)} className="flex-1 py-4 bg-slate-100 text-slate-400 rounded-2xl font-black text-[10px] uppercase">Cancelar</button>
                <button onClick={async () => { if(portPromptLead) await onUpdateLead({...portPromptLead, isPortado: true, dataPortabilidade: portDateInput}); setPortPromptLead(null); }} className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-black text-[10px] uppercase">Confirmar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedIds.size > 0 && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] bg-[#050a18] text-white px-10 py-5 rounded-[2.5rem] shadow-2xl flex items-center space-x-8 border border-white/10">
           <div className="flex flex-col"><span className="text-[10px] font-black uppercase text-blue-400">Pós-Venda em Massa</span><span className="text-sm font-black">{selectedIds.size} Itens</span></div>
           <button onClick={() => setShowBulkStatusMenu(!showBulkStatusMenu)} className="flex items-center space-x-2 px-6 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] font-black uppercase transition-all">
              <RefreshCw size={14} className="text-blue-400" />
              <span>Status</span>
           </button>
           {showBulkStatusMenu && (
              <div className="absolute bottom-full left-0 mb-4 w-60 bg-white rounded-2xl shadow-2xl border py-2 overflow-hidden">
                 {(activeSubTab === 'closed' ? POST_SALES_STATUSES : RENEWAL_STATUSES).map(s => (
                    <button key={s} onClick={() => handleBulkStatusChange(s)} className="w-full text-left px-5 py-3 text-[10px] font-black uppercase text-slate-600 hover:bg-slate-50">{s}</button>
                 ))}
              </div>
           )}
           <button onClick={() => setSelectedIds(new Set())} className="p-2 text-slate-400 hover:text-white"><X size={20} /></button>
        </div>
      )}

      <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
        <div><h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">Gestão de Pós-Venda</h1><p className="text-slate-500 mt-1 font-medium italic uppercase text-[10px]">VEC GROUP CRM - Módulo de Ativação</p></div>
        <div className="flex space-x-2 bg-slate-100 p-1.5 rounded-2xl shadow-inner border border-slate-200">
          <button onClick={() => setActiveSubTab('closed')} className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${activeSubTab === 'closed' ? 'bg-white text-blue-600 shadow-md' : 'text-slate-400'}`}>Vendas Ativas</button>
          <button onClick={() => setActiveSubTab('renewed')} className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${activeSubTab === 'renewed' ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-400'}`}>Renovação</button>
        </div>
      </div>

      {urlParamCnpj && (
        <div className="animate-in slide-in-from-top-6 duration-300">
          {totalItems > 0 ? (
            <div className="bg-emerald-50 border border-emerald-200 p-6 rounded-[2rem] flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm shadow-emerald-500/5">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-emerald-500 text-white rounded-2xl shadow-md shrink-0">
                  <CheckCircle2 size={24} />
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase text-emerald-800 tracking-wider">Cliente Localizado Automaticamente</h4>
                  <p className="text-xs font-bold text-emerald-600/80 uppercase leading-normal mt-1">
                    Exibindo os dados correspondentes ao chamado CNPJ: <span className="font-mono text-emerald-950 bg-emerald-100 px-2.5 py-1 rounded-lg font-black ml-1 select-all">{urlParamCnpj}</span>
                  </p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setSearchTerm('');
                  setUrlParamCnpj(null);
                }} 
                className="px-5 py-2.5 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-700 rounded-xl text-[10px] font-black uppercase transition-all shrink-0 cursor-pointer"
              >
                Limpar Filtro
              </button>
            </div>
          ) : (
            <div className="bg-rose-50 border border-rose-200 p-6 rounded-[2rem] flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm shadow-rose-500/5">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-rose-500 text-white rounded-2xl shadow-md shrink-0">
                  <AlertTriangle size={24} />
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase text-rose-800 tracking-wider">Nenhum Cliente Localizado</h4>
                  <p className="text-xs font-bold text-rose-600/80 uppercase leading-normal mt-1">
                    Não foi encontrado nenhum registro correspondente ao CNPJ do chamado: <span className="font-mono text-rose-950 bg-rose-100 px-2.5 py-1 rounded-lg font-black ml-1 select-all">{urlParamCnpj}</span>
                  </p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setSearchTerm('');
                  setUrlParamCnpj(null);
                }} 
                className="px-5 py-2.5 bg-[#f43f5e1a] hover:bg-[#f43f5e2d] text-rose-700 rounded-xl text-[10px] font-black uppercase transition-all shrink-0 cursor-pointer"
              >
                Limpar Busca
              </button>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        {(activeSubTab === 'closed' ? POST_SALES_STATUSES : RENEWAL_STATUSES).map(status => {
          // Contagem insensível a maiúsculas
          const realCount = leads.filter(l => (l.Status || '').toLowerCase().trim() === status.toLowerCase().trim()).length;
          const isActive = colFilters.Status.toLowerCase().trim() === status.toLowerCase().trim();
          return (
            <div key={status} onClick={() => setColFilters({...colFilters, Status: isActive ? '' : status})} className={`bg-white rounded-[1.5rem] p-5 shadow-sm border transition-all cursor-pointer flex flex-col items-center group relative h-32 justify-center active:scale-95 ${isActive ? 'border-blue-500 ring-4 ring-blue-50 shadow-lg' : 'border-slate-100 hover:border-blue-200'}`}>
              <div className={`w-10 h-10 rounded-xl mb-3 flex items-center justify-center ${STATUS_COLORS[status]?.split(' ')[0] || 'bg-slate-100'} text-current`}>{STATUS_ICONS[status] || <RefreshCw size={14}/>}</div>
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.1em] mb-1 text-center line-clamp-2 w-full px-2">{status}</p>
              <p className={`text-2xl font-black ${isActive ? 'text-blue-600' : 'text-slate-900'}`}>{realCount.toLocaleString()}</p>
              <div className={`absolute bottom-0 left-0 right-0 h-1 opacity-20 ${STATUS_ACCENT_COLORS[status] || 'bg-slate-400'}`}></div>
              {isActive && <div className="absolute top-2 right-2 w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>}
            </div>
          );
        })}
      </div>

      <div className="flex flex-col lg:flex-row items-center gap-4">
        <div className="flex-1 w-full relative"><Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} /><input type="text" placeholder="Busca Geral..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setUrlParamCnpj(null); }} className="w-full pl-14 pr-6 py-4 rounded-2xl bg-[#050a18] text-white focus:outline-none font-semibold text-sm" /></div>
        <button onClick={() => setShowColFilters(!showColFilters)} className={`flex items-center space-x-2 px-8 py-4 rounded-2xl font-black text-[10px] uppercase shadow-md transition-all ${showColFilters ? 'bg-blue-600 text-white' : 'bg-white text-slate-700 border border-slate-200'}`}><Filter size={16} /><span>Filtros</span></button>
      </div>

      <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[3200px]">
            <thead>
              <tr className="bg-slate-50/80">
                <th className="px-4 py-5 border-b border-slate-100 text-center w-12 sticky left-0 bg-slate-50 z-10"><button onClick={() => { if(selectedIds.size === paginatedLeads.length) setSelectedIds(new Set()); else setSelectedIds(new Set(paginatedLeads.map(l => l.id))); }} className="text-slate-400">{selectedIds.size > 0 ? <CheckSquare size={18} className="text-blue-600" /> : <Square size={18} />}</button></th>
                <th className="px-4 py-5 text-[9px] font-black text-slate-400 uppercase border-b border-slate-100 w-32">ID (ELEMENTO)</th>
                <th className="px-4 py-5 text-[9px] font-black text-slate-400 uppercase border-b border-slate-100 w-40">CNPJ</th>
                <th className="px-6 py-5 text-[9px] font-black text-slate-400 uppercase border-b border-slate-100 min-w-[300px]">Razão Social</th>
                <th className="px-4 py-5 text-[9px] font-black text-slate-400 uppercase border-b border-slate-100 text-center w-20">UF</th>
                <th className="px-4 py-5 text-[9px] font-black text-slate-400 uppercase border-b border-slate-100 text-center w-32">Fechamento</th>
                <th className="px-6 py-5 text-[9px] font-black text-slate-400 uppercase border-b border-slate-100 text-center w-48">Status Pós-Venda</th>
                <th className="px-4 py-5 text-[9px] font-black text-blue-600 uppercase border-b border-slate-100 bg-blue-50/10 text-center w-40">Telefone Principal</th>
                <th className="px-4 py-5 text-[9px] font-black text-slate-900 uppercase border-b border-slate-100 text-center w-20">Ativos</th>
                <th className="px-6 py-5 text-[9px] font-black text-slate-400 uppercase border-b border-slate-100 text-center w-40">Vendedor</th>
                <th className="px-6 py-5 text-[9px] font-black text-blue-600 uppercase border-b border-slate-100 bg-blue-50/20 w-56">Plano Ativado</th>
                <th className="px-6 py-5 text-[9px] font-black text-emerald-600 uppercase border-b border-slate-100 text-right w-32">Valor Mensal</th>
                <th className="px-4 py-5 text-[9px] font-black text-slate-400 uppercase border-b border-slate-100 text-center w-28">Operadora</th>
                <th className="px-4 py-5 text-[9px] font-black text-slate-400 uppercase border-b border-slate-100 text-center font-bold w-28">Pago</th>
                <th className="px-4 py-5 text-[9px] font-black text-slate-400 uppercase border-b border-slate-100 text-center font-bold w-28">Portado</th>
              </tr>
              {showColFilters && (
                <tr className="bg-slate-100/40">
                  <th className="px-4 py-3 sticky left-0 bg-slate-50 z-10"></th>
                  <th className="px-3 py-2"><FilterInput placeholder="ID..." value={colFilters.ELEMENTO} onChange={(v)=>setColFilters({...colFilters, ELEMENTO: v})} /></th>
                  <th className="px-3 py-2"><FilterInput placeholder="CNPJ..." value={colFilters.CNPJ} onChange={(v)=>setColFilters({...colFilters, CNPJ: v})} /></th>
                  <th className="px-3 py-2"><FilterInput placeholder="Empresa..." value={colFilters.razaoSocial} onChange={(v)=>setColFilters({...colFilters, razaoSocial: v})} /></th>
                  <th className="px-3 py-2"><FilterInput placeholder="UF..." value={colFilters.estado} onChange={(v)=>setColFilters({...colFilters, estado: v})} /></th>
                  <th className="px-3 py-2 text-center"><DateRangeFilter startValue={colFilters.dateStart} endValue={colFilters.dateEnd} onStartChange={(v:any)=>setColFilters({...colFilters, dateStart: v})} onEndChange={(v:any)=>setColFilters({...colFilters, dateEnd: v})} /></th>
                  <th className="px-3 py-2"><FilterInput placeholder="Status..." value={colFilters.Status} onChange={(v)=>setColFilters({...colFilters, Status: v})} /></th>
                  <th className="px-3 py-2 bg-blue-50/10 relative">
                    <div className="relative flex items-center">
                      <FilterInput placeholder="Tel..." value={colFilters.Telefone} onChange={(v)=>setColFilters({...colFilters, Telefone: v})} />
                      {isPhoneSearching && (
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                          <Loader2 size={11} className="animate-spin text-blue-500" />
                        </div>
                      )}
                    </div>
                  </th>
                  <th className="px-3 py-2"><FilterInput placeholder="Qtd..." value={colFilters.ATIVOS} onChange={(v)=>setColFilters({...colFilters, ATIVOS: v})} /></th>
                  <th className="px-3 py-2"><FilterInput placeholder="Vendedor..." value={colFilters.Vendedor} onChange={(v)=>setColFilters({...colFilters, Vendedor: v})} /></th>
                  <th className="px-3 py-2 bg-blue-50/10"></th>
                  <th className="px-3 py-2"></th>
                  <th className="px-3 py-2"><FilterInput placeholder="Op..." value={colFilters.operadora} onChange={(v)=>setColFilters({...colFilters, operadora: v})} /></th>
                  <th className="px-3 py-2"></th><th className="px-3 py-2"></th>
                </tr>
              )}
            </thead>
            <tbody className="divide-y divide-slate-50">
              {paginatedLeads.map((lead, idx) => {
                const vend = getVendedorInfo(lead.Vendedor);
                const hasDetails = (lead.linhasDetalhas || []).length > 0;
                const mainPlan = hasDetails ? lead.linhasDetalhas![0].plano : '--';
                const totalValue = Number(lead.valorTotalReceita) || (hasDetails ? lead.linhasDetalhas!.reduce((acc, c) => acc + (Number(c.valor) || 0), 0) : 0);
                const isHighlighted = !!(urlParamCnpj && lead.CNPJ && (lead.CNPJ.replace(/\D/g, '') === urlParamCnpj.replace(/\D/g, '')));
                return (
                  <tr key={lead.id} onClick={() => setSelectedLead(lead)} className={`transition-all duration-500 cursor-pointer group ${isHighlighted ? 'bg-amber-100/40 hover:bg-amber-100/60 border-y-2 border-amber-400 bg-gradient-to-r from-amber-500/[0.03] to-amber-500/[0.08] relative outline outline-2 outline-amber-400 outline-offset-[-2px] shadow-lg shadow-amber-500/5 animate-[pulse_3s_infinite]' : selectedIds.has(lead.id) ? 'bg-indigo-50/50' : 'hover:bg-slate-50/50'}`}>
                    <td className={`px-4 py-5 text-center sticky left-0 z-10 ${isHighlighted ? 'bg-[#fffbeb] group-hover:bg-[#fef3c7]' : 'bg-white group-hover:bg-slate-50/50'}`} onClick={(e) => handleRowSelect(e, lead.id, idx)}><button className={selectedIds.has(lead.id) ? 'text-indigo-600' : 'text-slate-200'}>{selectedIds.has(lead.id) ? <CheckSquare size={18} /> : <Square size={18} />}</button></td>
                    <td className="px-4 py-5 font-mono text-[10px] font-bold text-slate-400">{lead.ELEMENTO}</td>
                    <td className="px-4 py-5 font-mono text-[10px] font-bold text-slate-500">{lead.CNPJ}</td>
                    <td className="px-6 py-5"><div className="flex items-center space-x-3"><div className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-50 text-blue-500 shrink-0"><Building size={14} /></div><span className="text-[10px] font-black text-slate-900 uppercase line-clamp-1">{lead.razaoSocial}</span></div></td>
                    <td className="px-4 py-5 text-center"><span className="bg-slate-100 text-slate-500 text-[9px] font-black px-2 py-1 rounded border uppercase">{lead.estado}</span></td>
                    <td className="px-4 py-5 text-center"><span className="text-[10px] font-black text-emerald-600">{formatDateBR(lead.dataFechamento || lead.DATA_Consulta)}</span></td>
                    <td className="px-4 py-5 text-center"><div className={`inline-flex items-center space-x-2 px-3 py-1.5 rounded-full border text-[8px] font-black uppercase ${STATUS_COLORS[lead.Status] || 'bg-slate-100'}`}>{STATUS_ICONS[lead.Status]} <span>{lead.Status}</span></div></td>
                    <td className="px-4 py-5 font-mono text-[11px] font-black text-blue-700 bg-blue-50/10 text-center">
                      <div className="flex items-center justify-center space-x-1.5 group/phone">
                        <span>{lead.Telefone_Principal || '--'}</span>
                        {lead.Telefone_Principal && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onOpenWhatsApp) {
                                onOpenWhatsApp({
                                  phone: lead.Telefone_Principal,
                                  cnpj: lead.CNPJ,
                                  leadName: lead.razaoSocial || lead.NOME,
                                  company: lead.razaoSocial,
                                  leadId: lead.id
                                });
                              } else {
                                window.parent.postMessage({
                                  type: 'OPEN_WHATSAPP',
                                  phone: lead.Telefone_Principal,
                                  cnpj: lead.CNPJ,
                                  name: lead.razaoSocial || lead.NOME,
                                  company: lead.razaoSocial,
                                  leadId: lead.id
                                }, '*');
                              }
                            }}
                            className="opacity-0 group-hover:opacity-100 hover:scale-110 p-1 bg-emerald-50 text-emerald-600 rounded-lg transition-all"
                            title="Conversar no WhatsApp CRM"
                          >
                            <img src="https://i.imgur.com/Y1YwAp2.png" alt="WhatsApp" className="w-3.5 h-3.5 object-contain" referrerPolicy="no-referrer" />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-5 text-center text-[11px] font-black text-slate-900">{lead.ATIVOS}</td>
                    <td className="px-6 py-5 text-center"><div className="flex items-center justify-center space-x-2"><img src={vend.avatar} className="w-6 h-6 rounded-full shrink-0" /><span className="text-[9px] font-black uppercase truncate max-w-[100px]">{vend.fullName}</span></div></td>
                    <td className="px-6 py-5 bg-blue-50/10"><span className="text-[10px] font-black text-blue-900 uppercase truncate max-w-[180px] block">{mainPlan}</span></td>
                    <td className="px-6 py-5 text-right font-black text-emerald-600 text-[11px]">{totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                    <td className="px-4 py-5 text-[10px] font-black text-blue-600 uppercase text-center font-bold">{lead.operadora || '--'}</td>
                    <td className="px-4 py-5 text-center"><ToggleSwitch label="PAGO" enabled={!!lead.isPago} onChange={(val) => handlePagoToggle(lead, val)} disabled={!isPrivileged} /></td>
                    <td className="px-4 py-5 text-center"><ToggleSwitch label="PORT" enabled={!!lead.isPortado} onChange={(val) => handlePortToggle(lead, val)} dateInfo={lead.dataPortabilidade} /></td>
                  </tr>
                );
              })}
              {paginatedLeads.length === 0 && (
                <tr>
                  <td colSpan={15} className="py-24 text-center">
                    {urlParamCnpj ? (
                      <div className="max-w-md mx-auto p-8 rounded-[2rem] bg-rose-50 border border-rose-200 text-rose-800 space-y-4 animate-in zoom-in-95">
                        <div className="w-16 h-16 bg-rose-100/80 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-2 shadow-inner">
                          <AlertTriangle size={32} />
                        </div>
                        <h4 className="text-sm font-black uppercase tracking-tight">Nenhum cliente localizado</h4>
                        <p className="text-xs font-bold text-rose-600/80 normal-case leading-relaxed">
                          Nenhum cliente foi localizado na base de Clientes Fechados para o CNPJ informado:<br/>
                          <span className="font-mono text-xs text-rose-900 bg-rose-100 px-3 py-1.5 rounded-lg inline-block mt-2 font-black">{urlParamCnpj}</span>
                        </p>
                      </div>
                    ) : (
                      <div className="opacity-20 text-slate-400">
                        <Building2 size={64} className="mx-auto mb-4" />
                        <p className="text-xs font-black uppercase tracking-widest">Nenhum cliente fechado encontrado</p>
                      </div>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-8 py-5 border-t border-slate-50 flex flex-col md:flex-row items-center justify-between gap-4 bg-slate-50/50">
          <div className="flex items-center space-x-4">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ver:</span>
            <select value={itemsPerPage} onChange={(e) => setItemsPerPage(Number(e.target.value))} className="bg-white border rounded-lg px-3 py-1.5 text-[10px] font-black focus:outline-none">
              {[5, 10, 20, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-l border-slate-200 pl-4">Exibindo {totalItems.toLocaleString()} de {(isPrivileged ? (dbStats?.totalClosed || leads.length) : leads.length).toLocaleString()} Total</span>
          </div>
          <div className="flex items-center space-x-2">
            <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="p-2 rounded-lg bg-white border text-slate-400 disabled:opacity-30"><ChevronsLeft size={16} /></button>
            <button onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1} className="p-2 rounded-lg bg-white border text-slate-400 disabled:opacity-30"><ChevronLeft size={16} /></button>
            <div className="flex items-center bg-white border rounded-lg px-4 py-1.5"><span className="text-[10px] font-black text-slate-400 uppercase">Página <span className="text-blue-600">{currentPage}</span> de {totalPages}</span></div>
            <button onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages} className="p-2 rounded-lg bg-white border text-slate-400 disabled:opacity-30"><ChevronRight size={16} /></button>
            <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} className="p-2 rounded-lg bg-white border text-slate-400 disabled:opacity-30"><ChevronsRight size={16} /></button>
          </div>
        </div>
      </div>
      {selectedLead && <LeadDetailsModal lead={selectedLead} onClose={() => setSelectedLead(null)} user={user} allUsers={allUsers} onUpdate={onUpdateLead} onOpenWhatsApp={onOpenWhatsApp} />}
    </div>
  );
};

export default ClosedLeadsManagement;