/* 
 * ============================================================
 * ZONA PROTEGIDA - MÓDULO DE GESTÃO DE LEADS
 * REGRA: ORDEM DE COLUNAS ATUALIZADA - TELEFONE E ATIVOS APÓS STATUS
 * ============================================================
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Plus, Search, Square, CheckSquare, ChevronDown, FileText, Filter, Loader2,
  FileSpreadsheet, Trash2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  Zap, UserCircle, Check, CheckCircle2, AlertTriangle, Info, X, CheckCircle,
  ListChecks, Copy, Calendar, DollarSign, Smartphone, UserPlus, RefreshCw,
  AlertCircle, FileWarning, Phone
} from 'lucide-react';
import { Lead, LeadStatus, User, UserRole } from '../types';
import { STATUS_COLORS, STATUS_ICONS, STATUS_ACCENT_COLORS } from '../constants';
import { supabase } from '../lib/supabase';
import LeadDetailsModal from './LeadDetailsModal';
import NewLeadModal from './NewLeadModal';
import ProposalGenerator from './ProposalGenerator';
import LeadClosingModal from './LeadClosingModal';

declare const XLSX: any;

export const formatDateBR = (dateStr: string | undefined | null): string => {
  if (!dateStr || dateStr === 'undefined' || dateStr === 'null' || dateStr === '') return '--/--/----';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      if (dateStr.includes('/') && dateStr.split('/').length === 3) {
        const parts = dateStr.split(' ')[0].split('/');
        return `${parts[0].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[2]}`;
      }
      return dateStr;
    }
    const day = String(date.getUTCDate()).padStart(2, '0');
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const year = date.getUTCFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return '--/--/----';
  }
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

interface LeadsManagementProps { 
  user: User; 
  allUsers: User[];
  leads: Lead[];
  allLeads: Lead[];
  onUpdateLead: (lead: Lead) => Promise<void>;
  onBulkUpdateLeads?: (leads: Lead[]) => Promise<void>;
  onSetLeads: (leads: Lead[]) => void;
  onDeleteLeads: (ids: string[]) => void;
  dbStats?: any;
  onOpenWhatsApp?: (options: { phone?: string; cnpj?: string; leadName?: string; company?: string; leadId?: string }) => void;
}

const ColumnFilter = ({ placeholder, value, onChange }: { placeholder: string, value: string, onChange: (v: string) => void }) => (
  <input type="text" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-[9px] font-black uppercase focus:outline-none shadow-inner" />
);

const DateRangeFilter = ({ startValue, endValue, onStartChange, onEndChange }: any) => (
  <div className="flex flex-col space-y-1 p-1 bg-white border border-slate-200 rounded-lg shadow-inner overflow-hidden min-w-[120px]">
    <div className="flex items-center bg-white px-2 py-1 rounded">
      <span className="text-[7px] font-black text-slate-400 mr-1">DE:</span>
      <input type="date" value={startValue} onChange={(e) => onStartChange(e.target.value)} className="text-[8px] font-bold border-none bg-transparent focus:outline-none w-full text-slate-700" />
    </div>
    <div className="flex items-center bg-white px-2 py-1 rounded">
      <span className="text-[7px] font-black text-slate-400 mr-1">ATÉ:</span>
      <input type="date" value={endValue} onChange={(e) => onEndChange(e.target.value)} className="text-[8px] font-bold border-none bg-transparent focus:outline-none w-full text-slate-700" />
    </div>
  </div>
);

const LeadsManagement: React.FC<LeadsManagementProps> = ({ user, allUsers, leads, allLeads, onUpdateLead, onBulkUpdateLeads, onDeleteLeads, dbStats, onOpenWhatsApp }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [proposalLead, setProposalLead] = useState<Lead | null>(null);
  const [closingLead, setClosingLead] = useState<Lead | null>(null);
  const [isNewLeadModalOpen, setIsNewLeadModalOpen] = useState(false);
  const [showColFilters, setShowColFilters] = useState(true);
  
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [importSummary, setImportSummary] = useState<{ saved: number, skipped: number, total: number } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);
  const [openStatusId, setOpenStatusId] = useState<string | null>(null);
  const [openSellerId, setOpenSellerId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
  const [showBulkStatusMenu, setShowBulkStatusMenu] = useState(false);
  const [showBulkSellerMenu, setShowBulkSellerMenu] = useState(false);

  const [colFilters, setColFilters] = useState({ 
    ELEMENTO: '', CNPJ: '', razaoSocial: '', estado: '', dateStart: '', dateEnd: '',
    lastOrderStart: '', lastOrderEnd: '', Status: '', Vendedor: '', Telefone: '', operadora: '', ATIVOS: '' 
  });

  const [phoneSearchResults, setPhoneSearchResults] = useState<Lead[] | null>(null);
  const [isPhoneSearching, setIsPhoneSearching] = useState(false);
  const phoneAbortRef = useRef<AbortController | null>(null);
  const phoneDebounceRef = useRef<any>(null);

  const PIPELINE_STATUSES = [
    LeadStatus.ENTRAR_CONTATO, LeadStatus.ENVIADO_TIM, LeadStatus.ENVIADO_ALIVE, LeadStatus.NEGOCIANDO, LeadStatus.RENOVADO, LeadStatus.FECHADO, LeadStatus.SEM_INTERESSE
  ];

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
        const res = await supabase.leads.searchByPhone({
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

  const getVendedorInfo = (vendedorName: string) => {
    const found = allUsers.find(u => u.name.toUpperCase() === vendedorName.toUpperCase());
    return {
      avatar: found?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(vendedorName)}&background=random`,
      fullName: found?.name || vendedorName
    };
  };

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
      const matchSearch = (l.razaoSocial || '').toLowerCase().includes(searchTerm.toLowerCase()) || (l.CNPJ || '').includes(searchTerm);
      const leadDate = parseDateForFilter(l.DATA_Consulta);
      const start = colFilters.dateStart ? new Date(colFilters.dateStart + 'T00:00:00') : null;
      const end = colFilters.dateEnd ? new Date(colFilters.dateEnd + 'T23:59:59') : null;
      let dateMatch = true;
      if (start && leadDate && leadDate < start) dateMatch = false;
      if (end && leadDate && leadDate > end) dateMatch = false;
      const lastOrderDate = parseDateForFilter(l.DATA_ULTIMO_PEDIDO_NA_VIVO);
      const loStart = colFilters.lastOrderStart ? new Date(colFilters.lastOrderStart + 'T00:00:00') : null;
      const loEnd = colFilters.lastOrderEnd ? new Date(colFilters.lastOrderEnd + 'T23:59:59') : null;
      let lastOrderDateMatch = true;
      if (loStart && (!lastOrderDate || lastOrderDate < loStart)) lastOrderDateMatch = false;
      if (loEnd && (!lastOrderDate || lastOrderDate > loEnd)) lastOrderDateMatch = false;

      // Status: comparação de igualdade exata
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

      return matchSearch && dateMatch && lastOrderDateMatch && statusMatch && vendorMatch && phoneMatch &&
        (l.ELEMENTO || '').toLowerCase().includes(colFilters.ELEMENTO.toLowerCase()) &&
        (l.CNPJ || '').includes(colFilters.CNPJ) &&
        (l.razaoSocial || '').toLowerCase().includes(colFilters.razaoSocial.toLowerCase()) &&
        (l.estado || '').toLowerCase().includes(colFilters.estado.toLowerCase()) &&
        (l.operadora || '').toLowerCase().includes(colFilters.operadora.toLowerCase()) &&
        (l.ATIVOS || '').includes(colFilters.ATIVOS);
    });
  }, [baseLeads, searchTerm, colFilters, allUsers]);

  const totalItems = filteredLeads.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const paginatedLeads = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredLeads.slice(start, start + itemsPerPage);
  }, [filteredLeads, currentPage, itemsPerPage]);

  useEffect(() => { setCurrentPage(1); }, [searchTerm, colFilters, itemsPerPage]);

  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsImporting(true);
    setImportSummary(null);
    setImportProgress({ current: 0, total: 0 });

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: "" });
        const totalRows = jsonData.length;
        
        setImportProgress({ current: 0, total: totalRows });
        
        const newLeadsToDb: Lead[] = [];
        let skippedCount = 0;
        
        const existingCnpjs = new Set(allLeads.map(l => String(l.CNPJ || '').replace(/\D/g, '')));
        
        const CHUNK_SIZE = 1000;
        for (let i = 0; i < totalRows; i += CHUNK_SIZE) {
          const chunk = jsonData.slice(i, i + CHUNK_SIZE);
          
          chunk.forEach((row: any, idxInChunk) => {
            const rawCnpj = String(row['CNPJ'] || "");
            const cleanCnpj = rawCnpj.replace(/\D/g, '');
            
            if (!cleanCnpj || existingCnpjs.has(cleanCnpj)) {
              skippedCount++;
            } else {
              newLeadsToDb.push({
                id: `imp-${Date.now()}-${i + idxInChunk}-${Math.random()}`,
                ELEMENTO: String(row['ELEMENTO'] || row['ELEMENTO_ID'] || `E${Math.floor(Math.random()*9000)+1000}`),
                CNPJ: rawCnpj,
                razaoSocial: String(row['razaoSocial'] || row['Razão Social'] || row['NOME EMPRESARIAL'] || "EMPRESA SEM NOME").toUpperCase().trim(),
                estado: String(row['estado'] || row['Estado'] || row['UF'] || "").toUpperCase().trim(),
                DATA_Consulta: String(row['DATA Consulta'] || row['DATA_Consulta'] || new Date().toLocaleDateString('pt-BR')),
                Status: LeadStatus.ENTRAR_CONTATO,
                Vendedor: user.name.toUpperCase(),
                Telefone_Principal: String(row['Telefone Principal'] || row['Telefone'] || row['TEL'] || ""),
                operadora: String(row['operadora'] || row['OPERADORA'] || "VIVO"),
                ATIVOS: String(row['ATIVOS'] || row['QTD ATIVOS'] || "0"),
                DATA_ULTIMO_PEDIDO_NA_VIVO: String(row['DATA ULTIMO PEDIDO NA VIVO'] || row['ULTIMO PEDIDO'] || ""),
                NOME: String(row['NOME'] || row['NOME DO SOCIO'] || row['REPRESENTANTE'] || row['CONTATO'] || ""),
                CPF: String(row['CPF'] || row['CPF SOCIO'] || ""),
                CELULAR: String(row['CELULAR'] || row['WHATSAPP'] || row['CEL'] || ""),
                EMAIL: String(row['EMAIL'] || row['E-MAIL'] || "").toLowerCase(),
                NOME_02: String(row['NOME_02'] || row['NOME 02'] || ""), CPF_02: String(row['CPF_02'] || row['CPF 02'] || ""), CELULAR_02: String(row['CELULAR_02'] || row['CELULAR 02'] || ""), EMAIL_02: String(row['EMAIL_02'] || row['EMAIL 02'] || ""),
                NOME_03: String(row['NOME_03'] || row['NOME 03'] || ""), CPF_03: String(row['CPF_03'] || row['CPF 03'] || ""), CELULAR_03: String(row['CELULAR_03'] || row['CELULAR 03'] || ""), EMAIL_03: String(row['EMAIL_03'] || row['EMAIL 03'] || ""),
                NOME_04: String(row['NOME_04'] || row['NOME 04'] || ""), CPF_04: String(row['CPF_04'] || row['CPF 04'] || ""), CELULAR_04: String(row['CELULAR_04'] || row['CELULAR 04'] || ""), EMAIL_04: String(row['EMAIL_04'] || row['EMAIL 04'] || ""),
                NOME_05: String(row['NOME_05'] || row['NOME 05'] || ""), CPF_05: String(row['CPF_05'] || row['CPF 05'] || ""), CELULAR_05: String(row['CELULAR_05'] || row['CELULAR 05'] || ""), EMAIL_05: String(row['EMAIL_05'] || row['EMAIL 05'] || ""),
                notes: [], attachments: [], linhasDetalhas: []
              } as Lead);
              existingCnpjs.add(cleanCnpj);
            }
          });
          
          setImportProgress({ current: Math.min(i + CHUNK_SIZE, totalRows), total: totalRows });
          await new Promise(resolve => setTimeout(resolve, 10));
        }

        if (newLeadsToDb.length > 0 && onBulkUpdateLeads) {
          await onBulkUpdateLeads(newLeadsToDb);
        }

        setImportSummary({ saved: newLeadsToDb.length, skipped: skippedCount, total: totalRows });
        setIsImporting(false);
        
        alert(`IMPORTAÇÃO FINALIZADA!\n\nLidos do Excel: ${totalRows}\nNovos Salvos: ${newLeadsToDb.length}\nIgnorados (Duplicados): ${skippedCount}`);

      } catch (err) { 
        setIsImporting(false); 
        console.error("Erro na leitura do Excel:", err);
        alert("Erro crítico ao ler o arquivo Excel. Verifique se o arquivo está corrompido.");
      }
    };
    reader.readAsArrayBuffer(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSelectAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedIds.size === paginatedLeads.length) {
      setSelectedIds(new Set());
      setLastSelectedIndex(null);
    } else {
      setSelectedIds(new Set(paginatedLeads.map(l => l.id)));
      setLastSelectedIndex(null);
    }
  };

  const toggleSelect = (e: React.MouseEvent, id: string, index: number) => {
    e.stopPropagation();
    const newSelected = new Set(selectedIds);
    
    // Lógica Excel-Style: Shift + Clique
    if (e.shiftKey && lastSelectedIndex !== null) {
      const start = Math.min(lastSelectedIndex, index);
      const end = Math.max(lastSelectedIndex, index);
      const range = paginatedLeads.slice(start, end + 1);
      
      // Determine se vamos selecionar ou deselecionar baseado no estado do primeiro elemento clicado
      const shouldSelect = !selectedIds.has(id);
      
      range.forEach(lead => {
        if (shouldSelect) newSelected.add(lead.id);
        else newSelected.delete(lead.id);
      });
      setLastSelectedIndex(index);
    } else {
      if (newSelected.has(id)) newSelected.delete(id);
      else newSelected.add(id);
      setLastSelectedIndex(index);
    }
    
    setSelectedIds(newSelected);
  };

  const handleBulkDelete = () => {
    if (confirm(`Excluir ${selectedIds.size} leads?`)) {
      onDeleteLeads(Array.from(selectedIds));
      setSelectedIds(new Set());
      setLastSelectedIndex(null);
    }
  };

  const handleBulkStatusChange = async (newStatus: LeadStatus) => {
    if (!onBulkUpdateLeads) return;
    const leadsToUpdate = leads.filter(l => selectedIds.has(l.id)).map(l => ({ ...l, Status: newStatus }));
    await onBulkUpdateLeads(leadsToUpdate);
    setSelectedIds(new Set());
    setLastSelectedIndex(null);
    setShowBulkStatusMenu(false);
  };

  const handleBulkSellerChange = async (newSellerName: string) => {
    if (!onBulkUpdateLeads) return;
    const leadsToUpdate = leads.filter(l => selectedIds.has(l.id)).map(l => ({ ...l, Vendedor: newSellerName.toUpperCase() }));
    await onBulkUpdateLeads(leadsToUpdate);
    setSelectedIds(new Set());
    setLastSelectedIndex(null);
    setShowBulkSellerMenu(false);
  };

  const handleQuickStatusUpdate = async (e: React.MouseEvent, lead: Lead, newStatus: LeadStatus) => {
    e.stopPropagation();
    setOpenStatusId(null);
    if (newStatus === LeadStatus.FECHADO) setClosingLead(lead);
    else await onUpdateLead({ ...lead, Status: newStatus });
  };

  const handleQuickSellerUpdate = async (e: React.MouseEvent, lead: Lead, newSeller: string) => {
    e.stopPropagation();
    setOpenSellerId(null);
    await onUpdateLead({ ...lead, Vendedor: newSeller.toUpperCase() });
  };

  const importPercent = importProgress.total > 0 ? Math.round((importProgress.current / importProgress.total) * 100) : 0;

  // Função para filtrar ao clicar nos cards do pipeline
  const handlePipelineClick = (status: string) => {
    setColFilters(prev => ({
      ...prev,
      Status: prev.Status === status ? '' : status // Toggle
    }));
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-24 relative">
      {isImporting && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-md p-10 rounded-[3rem] shadow-2xl text-center space-y-8">
              <div className="relative inline-block">
                 <div className="w-24 h-24 rounded-full border-8 border-slate-100 border-t-blue-600 animate-spin mx-auto"></div>
                 <div className="absolute inset-0 flex items-center justify-center"><span className="text-xl font-black text-slate-900">{importPercent}%</span></div>
              </div>
              <div>
                <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Processando Gigante</h3>
                <p className="text-slate-500 font-bold text-sm mt-2 uppercase tracking-widest">Leitura: {importProgress.current.toLocaleString()} de {importProgress.total.toLocaleString()}</p>
              </div>
              <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                <div className="bg-blue-600 h-full transition-all duration-300" style={{ width: `${importPercent}%` }}></div>
              </div>
              <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
                <p className="text-[9px] font-black text-amber-700 uppercase leading-tight">Aguarde. Arquivos de 40k+ linhas podem levar alguns minutos para serem validados pelo banco.</p>
              </div>
           </div>
        </div>
      )}

      {selectedIds.size > 0 && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] bg-[#050a18] text-white px-10 py-5 rounded-[2.5rem] shadow-2xl flex items-center space-x-8 animate-in slide-in-from-bottom-10 border border-white/10">
           <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400">Ações em Massa</span>
              <span className="text-sm font-black uppercase tracking-tight">{selectedIds.size} Itens Selecionados</span>
           </div>
           <div className="h-8 w-px bg-white/10"></div>
           <div className="flex items-center space-x-3">
              <div className="relative">
                 <button onClick={() => setShowBulkStatusMenu(!showBulkStatusMenu)} className="flex items-center space-x-2 px-6 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
                    <RefreshCw size={14} className="text-blue-400" />
                    <span>Mudar Status</span>
                    <ChevronDown size={12} />
                 </button>
                 {showBulkStatusMenu && (
                    <div className="absolute bottom-full left-0 mb-4 w-60 bg-white rounded-2xl shadow-2xl border border-slate-100 py-2 overflow-hidden animate-in fade-in slide-in-from-bottom-2">
                       {PIPELINE_STATUSES.map(s => (
                          <button key={s} onClick={() => handleBulkStatusChange(s)} className="w-full text-left px-6 py-3 text-[10px] font-black uppercase text-slate-600 hover:bg-slate-50 flex items-center space-x-3">
                             {STATUS_ICONS[s]} <span>{s}</span>
                          </button>
                       ))}
                    </div>
                 )}
              </div>
              {isPrivileged && (
                <div className="relative">
                   <button onClick={() => setShowBulkSellerMenu(!showBulkSellerMenu)} className="flex items-center space-x-2 px-6 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
                      <UserPlus size={14} className="text-emerald-400" />
                      <span>Transferir Vendedor</span>
                      <ChevronDown size={12} />
                   </button>
                   {showBulkSellerMenu && (
                      <div className="absolute bottom-full left-0 mb-4 w-64 bg-white rounded-2xl shadow-2xl border border-slate-100 py-2 max-h-[300px] overflow-y-auto custom-scrollbar animate-in fade-in slide-in-from-bottom-2">
                         {allUsers.map((u, idx) => (
                            <button key={`${u.id || u.name}-${idx}`} onClick={() => handleBulkSellerChange(u.name)} className="w-full text-left px-6 py-3 text-[10px] font-black uppercase text-slate-600 hover:bg-slate-50 flex items-center space-x-3">
                               <img src={u.avatar || `https://ui-avatars.com/api/?name=${u.name}&background=random`} className="w-8 h-8 rounded-full" />
                               <span>{u.name}</span>
                            </button>
                         ))}
                      </div>
                   )}
                </div>
              )}
              {isPrivileged && (
                <button onClick={handleBulkDelete} className="flex items-center space-x-2 px-6 py-3 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
                   <Trash2 size={14} />
                   <span>Remover da Base</span>
                </button>
              )}
           </div>
           <button onClick={() => { setSelectedIds(new Set()); setLastSelectedIndex(null); }} className="p-2 text-slate-400 hover:text-white transition-colors">
              <X size={20} />
           </button>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {PIPELINE_STATUSES.map(status => {
          const realCount = isPrivileged 
            ? (dbStats?.leads[status] || leads.filter(l => l.Status === status).length)
            : leads.filter(l => l.Status === status).length;
          
          const isActive = colFilters.Status === status;
            
          return (
            <div 
              key={status} 
              onClick={() => handlePipelineClick(status)}
              className={`bg-white rounded-[1.5rem] p-6 shadow-sm border transition-all cursor-pointer flex flex-col items-center group relative overflow-hidden active:scale-95 ${isActive ? 'border-blue-500 ring-4 ring-blue-50 shadow-lg' : 'border-slate-100 hover:border-blue-200'}`}
            >
              <div className={`w-12 h-12 rounded-xl mb-4 flex items-center justify-center transition-transform group-hover:scale-110 ${STATUS_COLORS[status].split(' ')[0]} text-current`}>{STATUS_ICONS[status]}</div>
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.1em] mb-1 text-center">{status}</p>
              <p className={`text-3xl font-black transition-colors ${isActive ? 'text-blue-600' : 'text-slate-900'}`}>{realCount.toLocaleString()}</p>
              <div className={`absolute bottom-0 left-0 right-0 h-1 opacity-20 ${STATUS_ACCENT_COLORS[status]}`}></div>
              {isActive && <div className="absolute top-2 right-2 w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>}
            </div>
          );
        })}
      </div>

      <div className="flex flex-col lg:flex-row items-center gap-4">
        <div className="flex-1 w-full relative"><Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} /><input type="text" placeholder="Busca Geral..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-14 pr-6 py-4 rounded-2xl bg-white border border-slate-100 text-slate-800 focus:outline-none focus:ring-4 focus:ring-blue-50 font-semibold text-sm transition-all" /></div>
        <div className="flex items-center space-x-2">
          {user.role === UserRole.OWNER && (
            <>
              <input type="file" key={Date.now()} ref={fileInputRef} onChange={handleExcelImport} className="hidden" accept=".xlsx,.xls" />
              <button onClick={() => fileInputRef.current?.click()} className="flex items-center space-x-2 px-6 py-4 bg-emerald-600 text-white rounded-2xl font-black text-[10px] uppercase shadow-md transition-all hover:bg-emerald-700">
                <FileSpreadsheet size={16} />
                <span>Importar Leads</span>
              </button>
            </>
          )}
          <button onClick={() => setShowColFilters(!showColFilters)} className={`flex items-center space-x-2 px-6 py-4 rounded-2xl font-black text-[10px] uppercase shadow-md transition-all ${showColFilters ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700 border border-slate-200'}`}><Filter size={16} /><span>Filtros</span></button>
          <button onClick={() => setIsNewLeadModalOpen(true)} className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase shadow-xl hover:bg-black transition-all"><Plus size={18} /><span>Nova Empresa</span></button>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[2800px]">
            <thead>
              <tr className="bg-white">
                <th className="px-4 py-5 border-b border-slate-100 text-center w-12 sticky left-0 bg-white z-10"><button onClick={handleSelectAll} className="text-slate-400">{selectedIds.size === paginatedLeads.length && paginatedLeads.length > 0 ? <CheckSquare size={18} className="text-blue-600" /> : <Square size={18} />}</button></th>
                <th className="px-4 py-5 text-[9px] font-black text-slate-400 uppercase border-b border-slate-100">ELEMENTO</th>
                <th className="px-4 py-5 text-[9px] font-black text-slate-400 uppercase border-b border-slate-100">CNPJ</th>
                <th className="px-6 py-5 text-[9px] font-black text-slate-400 uppercase border-b border-slate-100">Razão Social</th>
                <th className="px-4 py-5 text-[9px] font-black text-slate-400 uppercase border-b border-slate-100 text-center">Estado</th>
                <th className="px-4 py-5 text-[9px] font-black text-slate-400 uppercase border-b border-slate-100 text-center">DATA Consulta</th>
                <th className="px-4 py-5 text-[9px] font-black text-slate-400 uppercase border-b border-slate-100 text-center">Status</th>
                <th className="px-4 py-5 text-[9px] font-black text-blue-600 uppercase border-b border-slate-100 bg-blue-50/5">Telefone Principal</th>
                <th className="px-4 py-5 text-[9px] font-black text-slate-900 uppercase border-b border-slate-100 text-center bg-slate-50/5">ATIVOS</th>
                <th className="px-6 py-5 text-[9px] font-black text-slate-400 uppercase border-b border-slate-100 text-center">Vendedor</th>
                <th className="px-6 py-5 text-[9px] font-black text-blue-600 uppercase border-b border-slate-100 bg-blue-50/5">Plano Contratado</th>
                <th className="px-6 py-5 text-[9px] font-black text-emerald-600 uppercase border-b border-slate-100 bg-emerald-50/5 text-right">Valor Mensal</th>
                <th className="px-4 py-5 text-[9px] font-black text-slate-400 uppercase border-b border-slate-100 text-center">Operadora</th>
                <th className="px-4 py-5 text-[9px] font-black text-slate-400 uppercase border-b border-slate-100 text-center">Último Pedido</th>
                <th className="px-4 py-5 text-[9px] font-black text-slate-400 uppercase border-b border-slate-100 text-center w-32">Ações</th>
              </tr>
              {showColFilters && (
                <tr className="bg-white">
                  <th className="px-4 py-3 sticky left-0 bg-white z-10"></th>
                  <th className="px-3 py-2"><ColumnFilter placeholder="ID..." value={colFilters.ELEMENTO} onChange={(v)=>setColFilters({...colFilters, ELEMENTO: v})} /></th>
                  <th className="px-3 py-2"><ColumnFilter placeholder="CNPJ..." value={colFilters.CNPJ} onChange={(v)=>setColFilters({...colFilters, CNPJ: v})} /></th>
                  <th className="px-3 py-2"><ColumnFilter placeholder="Empresa..." value={colFilters.razaoSocial} onChange={(v)=>setColFilters({...colFilters, razaoSocial: v})} /></th>
                  <th className="px-3 py-2"><ColumnFilter placeholder="UF..." value={colFilters.estado} onChange={(v)=>setColFilters({...colFilters, estado: v})} /></th>
                  <th className="px-3 py-2 text-center"><DateRangeFilter startValue={colFilters.dateStart} endValue={colFilters.dateEnd} onStartChange={(v:any)=>setColFilters({...colFilters, dateStart: v})} onEndChange={(v:any)=>setColFilters({...colFilters, dateEnd: v})} /></th>
                  <th className="px-3 py-2"><ColumnFilter placeholder="Status..." value={colFilters.Status} onChange={(v)=>setColFilters({...colFilters, Status: v})} /></th>
                  <th className="px-3 py-2 bg-blue-50/5 relative">
                    <div className="relative flex items-center">
                      <ColumnFilter placeholder="Tel..." value={colFilters.Telefone} onChange={(v)=>setColFilters({...colFilters, Telefone: v})} />
                      {isPhoneSearching && (
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                          <Loader2 size={11} className="animate-spin text-blue-500" />
                        </div>
                      )}
                    </div>
                  </th>
                  <th className="px-3 py-2 bg-slate-50/5"><ColumnFilter placeholder="Qtd..." value={colFilters.ATIVOS} onChange={(v)=>setColFilters({...colFilters, ATIVOS: v})} /></th>
                  <th className="px-3 py-2"><ColumnFilter placeholder="Vendedor..." value={colFilters.Vendedor} onChange={(v)=>setColFilters({...colFilters, Vendedor: v})} /></th>
                  <th className="px-3 py-2 bg-blue-50/5"></th>
                  <th className="px-3 py-2 bg-emerald-50/5"></th>
                  <th className="px-3 py-2"><ColumnFilter placeholder="Op..." value={colFilters.operadora} onChange={(v)=>setColFilters({...colFilters, operadora: v})} /></th>
                  <th className="px-3 py-2 text-center"><DateRangeFilter startValue={colFilters.lastOrderStart} endValue={colFilters.lastOrderEnd} onStartChange={(v:any)=>setColFilters({...colFilters, lastOrderStart: v})} onEndChange={(v:any)=>setColFilters({...colFilters, lastOrderEnd: v})} /></th>
                  <th className="px-3 py-2"></th>
                </tr>
              )}
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedLeads.map((lead, idx) => {
                const vend = getVendedorInfo(lead.Vendedor);
                const hasDetails = (lead.linhasDetalhas || []).length > 0;
                const mainPlan = hasDetails ? lead.linhasDetalhas![0].plano : '--';
                const totalValue = lead.valorTotalReceita || (hasDetails ? lead.linhasDetalhas!.reduce((acc, c) => acc + (c.valor || 0), 0) : 0);
                return (
                  <tr key={lead.id} onClick={() => setSelectedLead(lead)} className={`hover:bg-blue-50/30 cursor-pointer transition-all group ${selectedIds.has(lead.id) ? 'bg-blue-50/50' : ''}`}>
                    <td className="px-4 py-5 text-center sticky left-0 bg-white group-hover:bg-blue-50/30 z-10" onClick={(e) => toggleSelect(e, lead.id, idx)}><button className={selectedIds.has(lead.id) ? 'text-blue-600' : 'text-slate-200'}>{selectedIds.has(lead.id) ? <CheckSquare size={18} /> : <Square size={18} />}</button></td>
                    <td className="px-4 py-5 font-mono text-[10px] font-bold text-slate-400">{lead.ELEMENTO}</td><td className="px-4 py-5 font-mono text-[10px] font-bold text-slate-500">{lead.CNPJ}</td><td className="px-6 py-5"><span className="text-[10px] font-black text-slate-900 uppercase line-clamp-1">{lead.razaoSocial}</span></td><td className="px-4 py-5 text-center"><span className="text-[10px] font-black px-3 py-1.5 rounded-lg border uppercase bg-blue-50 text-blue-600 border-blue-100">{lead.estado || '--'}</span></td><td className="px-4 py-5 text-center font-mono text-[10px] text-slate-500">{formatDateBR(lead.DATA_Consulta)}</td>
                    <td className="px-4 py-5 text-center"><div className="relative inline-block" onClick={(e) => { e.stopPropagation(); setOpenStatusId(openStatusId === lead.id ? null : lead.id); }}><div className={`inline-flex items-center space-x-2 px-3 py-1.5 rounded-full border text-[8px] font-black uppercase transition-all hover:scale-105 active:scale-95 ${STATUS_COLORS[lead.Status]}`}>{STATUS_ICONS[lead.Status]} <span>{lead.Status}</span><ChevronDown size={10} className="ml-1 opacity-50" /></div>
                          {openStatusId === lead.id && (<div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 w-[180px] bg-white rounded-xl shadow-2xl border border-slate-100 py-1">{PIPELINE_STATUSES.map(s => <button key={s} onClick={(e) => handleQuickStatusUpdate(e, lead, s)} className="w-full text-left px-4 py-2.5 text-[9px] font-black uppercase flex items-center space-x-2 hover:bg-slate-50">{STATUS_ICONS[s]} <span>{s}</span></button>)}</div>)}</div></td>
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
                    <td className="px-4 py-5 text-center text-[11px] font-black text-slate-900 bg-slate-50/5">{lead.ATIVOS}</td>
                    <td className="px-6 py-5 text-center"><div className="relative inline-block" onClick={(e) => { e.stopPropagation(); if(isPrivileged) setOpenSellerId(openSellerId === lead.id ? null : lead.id); }}><div className="flex items-center justify-center space-x-3 hover:bg-slate-50 p-2 rounded-xl transition-all cursor-pointer"><img src={vend.avatar} className="w-8 h-8 rounded-full border border-slate-200 shadow-sm object-cover" /><span className="text-[10px] font-black text-slate-700 uppercase whitespace-nowrap">{vend.fullName}</span>{isPrivileged && <ChevronDown size={10} className="text-slate-400" />}</div>
                        {isPrivileged && openSellerId === lead.id && (<div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-[60] w-[200px] bg-white rounded-xl shadow-2xl border border-slate-100 py-1 max-h-[250px] overflow-y-auto custom-scrollbar">{allUsers.map((u, sIdx) => (<button key={`${u.id || u.name}-${sIdx}`} onClick={(e) => handleQuickSellerUpdate(e, lead, u.name)} className="w-full text-left px-4 py-2.5 text-[9px] font-black uppercase flex items-center space-x-3 hover:bg-slate-50"><img src={u.avatar || `https://ui-avatars.com/api/?name=${u.name}&background=random`} className="w-6 h-6 rounded-full" /><span>{u.name}</span></button>))}</div>)}</div></td>
                    <td className="px-6 py-5 bg-blue-50/5"><div className="flex items-center space-x-2"><Smartphone size={12} className="text-blue-400" /><span className="text-[10px] font-black text-blue-900 uppercase truncate max-w-[180px]">{mainPlan}</span></div></td>
                    <td className="px-6 py-5 bg-emerald-50/5 text-right"><span className="text-[11px] font-black text-emerald-600">{totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></td>
                    <td className="px-4 py-5 text-[10px] font-black text-blue-600 uppercase text-center font-bold">{lead.operadora}</td><td className="px-4 py-5 text-center font-mono text-[10px] text-slate-500">{formatDateBR(lead.DATA_Consulta)}</td>
                    <td className="px-4 py-5 text-center">
                      <div className="flex items-center justify-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            const targetPhone = lead.Telefone_Principal || lead.CELULAR || lead.CELULAR_02;
                            if (onOpenWhatsApp) {
                              onOpenWhatsApp({
                                phone: targetPhone,
                                cnpj: lead.CNPJ,
                                leadName: lead.razaoSocial || lead.NOME,
                                company: lead.razaoSocial,
                                leadId: lead.id
                              });
                            } else {
                              window.parent.postMessage({
                                type: 'OPEN_WHATSAPP',
                                phone: targetPhone,
                                cnpj: lead.CNPJ,
                                name: lead.razaoSocial || lead.NOME,
                                company: lead.razaoSocial,
                                leadId: lead.id
                              }, '*');
                            }
                          }} 
                          className="p-1.5 hover:bg-emerald-50 text-slate-300 hover:text-emerald-600 rounded-lg transition-all"
                          title="Abrir WhatsApp CRM"
                        >
                          <img src="https://i.imgur.com/Y1YwAp2.png" alt="WhatsApp" className="w-4 h-4 object-contain" referrerPolicy="no-referrer" />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); setProposalLead(lead); }} className="p-2 text-slate-300 hover:text-blue-600 transition-all"><FileText size={16} /></button>
                        <button onClick={(e) => { e.stopPropagation(); if(confirm('Excluir?')) onDeleteLeads([lead.id]); }} className="p-2 text-slate-300 hover:text-red-500 transition-all"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-8 py-5 border-t border-slate-100 flex flex-col md:flex-row items-center justify-between gap-4 bg-white">
          <div className="flex items-center space-x-4">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Itens por página</span>
            <select value={itemsPerPage} onChange={(e) => setItemsPerPage(Number(e.target.value))} className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-[10px] font-black focus:outline-none shadow-sm cursor-pointer">
              {[5, 10, 20, 30, 50, 100, 200, 500, 1000].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            {/* FIX: Vendedores vêem apenas contagem total dos leads atribuídos a eles */}
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-l border-slate-200 pl-4">Contagem Real: {(isPrivileged ? (dbStats?.totalLeads || totalItems) : totalItems).toLocaleString()} Empresas</span>
          </div>
          <div className="flex items-center space-x-2">
            <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="p-2 rounded-lg bg-white border border-slate-200 text-slate-400 disabled:opacity-30 hover:bg-slate-50 transition-colors"><ChevronsLeft size={16} /></button>
            <button onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1} className="p-2 rounded-lg bg-white border border-slate-200 text-slate-400 disabled:opacity-30 hover:bg-slate-50 transition-colors"><ChevronLeft size={16} /></button>
            <div className="flex items-center bg-white border border-slate-200 rounded-lg px-4 py-1.5 shadow-sm"><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Página <span className="text-blue-600">{currentPage}</span> de {totalPages || 1}</span></div>
            <button onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages || totalPages === 0} className="p-2 rounded-lg bg-white border border-slate-200 text-slate-400 disabled:opacity-30 hover:bg-slate-50 transition-colors"><ChevronRight size={16} /></button>
            <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages || totalPages === 0} className="p-2 rounded-lg bg-white border border-slate-200 text-slate-400 disabled:opacity-30 hover:bg-slate-50 transition-colors"><ChevronsRight size={16} /></button>
          </div>
        </div>
      </div>
      {selectedLead && <LeadDetailsModal lead={selectedLead} onClose={() => setSelectedLead(null)} user={user} allUsers={allUsers} onUpdate={onUpdateLead} onOpenWhatsApp={onOpenWhatsApp} />}
      {isNewLeadModalOpen && <NewLeadModal onClose={() => setIsNewLeadModalOpen(false)} onSave={(l) => { onUpdateLead(l); setIsNewLeadModalOpen(false); }} user={user} allUsers={allUsers} existingLeads={allLeads} />}
      {proposalLead && <ProposalGenerator lead={proposalLead} currentUser={user} onClose={() => setProposalLead(null)} />}
      {closingLead && <LeadClosingModal lead={closingLead} user={user} onClose={() => setClosingLead(null)} onConfirm={async (l) => { await onUpdateLead(l); setClosingLead(null); }} />}
    </div>
  );
};

export default LeadsManagement;