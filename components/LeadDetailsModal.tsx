
import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, Building, Save, Loader2, CreditCard, UserPlus, RefreshCw, CheckCircle2, 
  MessageSquare, FileText, LayoutGrid, Paperclip, Send, Trash2, Download,
  FolderOpen, Star, Smartphone, DollarSign, ListChecks, Info, PlusCircle, Copy, AlertTriangle
} from 'lucide-react';
import { Lead, User as AppUser, LeadStatus, LeadNote, Attachment, LineDetail, Ticket, TicketNote } from '../types';
import { STATUS_COLORS, STATUS_ICONS } from '../constants';
import { supabase } from '../lib/supabase';

interface UnifiedTimelineItem {
  id: string;
  type: 'lead_note' | 'ticket_creation' | 'ticket_note';
  userName: string;
  content: string;
  createdAt: string;
  timestamp: number;
  ticketId?: string;
  ticketStatus?: string;
  attachments?: Attachment[];
}

interface LeadDetailsModalProps {
  lead: Lead;
  onClose: () => void;
  user: AppUser;
  allUsers: AppUser[];
  onUpdate: (updatedLead: Lead) => Promise<void>;
  onOpenWhatsApp?: (options: { phone?: string; cnpj?: string; leadName?: string; company?: string; leadId?: string }) => void;
}

const EditableField = ({ label, value, field, disabled, onChange, type = "text", action }: any) => (
  <div className="space-y-1.5">
    <div className="flex items-center justify-between">
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
      {action}
    </div>
    <input 
      type={type} value={value || ''} disabled={disabled} onChange={(e) => onChange(field, e.target.value)}
      className={`w-full text-[13px] font-bold border rounded-xl px-4 py-2.5 focus:outline-none transition-all ${disabled ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-slate-50 text-slate-700 border-slate-100 focus:bg-white focus:border-blue-300'}`}
    />
  </div>
);

const parseDateTime = (dateStr: string): number => {
  if (!dateStr) return 0;
  if (dateStr.includes('-') && !dateStr.includes('/')) {
    const d = Date.parse(dateStr);
    if (!isNaN(d)) return d;
  }
  try {
    const clean = dateStr.replace(',', '').trim();
    const parts = clean.split(' ');
    const dateParts = parts[0].split('/');
    if (dateParts.length === 3) {
      const day = parseInt(dateParts[0], 10);
      const month = parseInt(dateParts[1], 10) - 1;
      const year = parseInt(dateParts[2], 10);
      
      let hour = 0, minute = 0, second = 0;
      if (parts[1]) {
        const timeParts = parts[1].split(':');
        hour = parseInt(timeParts[0], 10) || 0;
        minute = parseInt(timeParts[1], 10) || 0;
        second = parseInt(timeParts[2], 10) || 0;
      }
      return new Date(year, month, day, hour, minute, second).getTime();
    }
  } catch (e) {
    console.warn("Date parsing fallback:", e);
  }
  const parsed = Date.parse(dateStr);
  return isNaN(parsed) ? 0 : parsed;
};

const LeadDetailsModal: React.FC<LeadDetailsModalProps> = ({ lead, onClose, user, allUsers, onUpdate, onOpenWhatsApp }) => {
  const [editableLead, setEditableLead] = useState<Lead>({ ...lead });
  const [rightPanelTab, setRightPanelTab] = useState<'notas' | 'arquivos'>('notas');
  const [leftPanelTab, setLeftPanelTab] = useState<'cadastro' | 'linhas'>('cadastro');
  const [activeContact, setActiveContact] = useState(1);
  const [newNote, setNewNote] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [isSyncing, setIsSyncing] = useState(false);

  const handleLaunchWhatsApp = (phoneNum?: string, contactName?: string) => {
    const rawTarget = phoneNum || editableLead.Telefone_Principal || editableLead.CELULAR || editableLead.CELULAR_02 || editableLead.CELULAR_03 || editableLead.CELULAR_04 || editableLead.CELULAR_05;
    if (!rawTarget && !editableLead.CNPJ) {
      alert("Nenhum telefone ou CNPJ cadastrado para este cliente.");
      return;
    }
    onClose();
    if (onOpenWhatsApp) {
      onOpenWhatsApp({
        phone: rawTarget,
        cnpj: editableLead.CNPJ,
        leadName: contactName || editableLead.razaoSocial || editableLead.NOME,
        company: editableLead.razaoSocial,
        leadId: editableLead.id
      });
    } else {
      window.parent.postMessage({
        type: 'OPEN_WHATSAPP',
        phone: rawTarget,
        cnpj: editableLead.CNPJ,
        name: contactName || editableLead.razaoSocial || editableLead.NOME,
        company: editableLead.razaoSocial,
        leadId: editableLead.id
      }, '*');
    }
  };

  // Integração com Chamados
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);

  useEffect(() => {
    let active = true;
    const fetchTickets = async () => {
      setLoadingTickets(true);
      try {
        const { data, error } = await supabase.tickets.getAll();
        if (error) throw error;
        if (data && active) {
          const cleanLeadCnpj = (editableLead.CNPJ || '').replace(/\D/g, '');
          const filtered = data.filter((t: Ticket) => {
            const isSameLead = t.leadId === editableLead.id;
            const cleanTicketCnpj = (t.cnpj || '').replace(/\D/g, '');
            const isSameCnpj = cleanLeadCnpj && cleanTicketCnpj && cleanTicketCnpj === cleanLeadCnpj;
            return isSameLead || isSameCnpj;
          });
          setTickets(filtered);
        }
      } catch (err) {
        console.error("Erro ao carregar chamados relacionados:", err);
      } finally {
        if (active) setLoadingTickets(false);
      }
    };
    fetchTickets();
    return () => {
      active = false;
    };
  }, [editableLead.id, editableLead.CNPJ]);

  const unifiedTimeline = useMemo(() => {
    const items: UnifiedTimelineItem[] = [];

    // 1. Adicionar Notas próprias do Lead
    if (editableLead.notes) {
      editableLead.notes.forEach((note) => {
        items.push({
          id: note.id,
          type: 'lead_note',
          userName: note.userName,
          content: note.content,
          createdAt: note.createdAt,
          timestamp: parseDateTime(note.createdAt),
          attachments: note.attachments
        });
      });
    }

    // 2. Adicionar Aberturas de Chamado e Atualizações de Chamado
    tickets.forEach((t) => {
      items.push({
        id: `ticket-creation-${t.id}`,
        type: 'ticket_creation',
        userName: t.requesterName,
        content: `🎫 CHAMADO ABERTO (#${t.id.slice(-6).toUpperCase()}):\n\n${t.description}`,
        createdAt: t.createdAt,
        timestamp: parseDateTime(t.createdAt),
        ticketId: t.id,
        ticketStatus: t.status,
        attachments: t.attachments
      });

      if (t.notes) {
        t.notes.forEach((note) => {
          items.push({
            id: note.id,
            type: 'ticket_note',
            userName: note.userName,
            content: `💬 ATUALIZAÇÃO NO CHAMADO (#${t.id.slice(-6).toUpperCase()}):\n\n${note.content}`,
            createdAt: note.createdAt,
            timestamp: parseDateTime(note.createdAt),
            ticketId: t.id,
            attachments: note.attachments
          });
        });
      }
    });

    return items.sort((a, b) => b.timestamp - a.timestamp);
  }, [editableLead.notes, tickets]);

  const CLOSED_FLOW_STATUSES = [
    LeadStatus.FECHADO, LeadStatus.COLETA_ASSINATURA, LeadStatus.CONFIRMACAO_TELEFONICA, LeadStatus.EM_ANALISE, LeadStatus.VALIDANDO, LeadStatus.VALIDANDO_PORTABILIDADE, 
    LeadStatus.REPROVADO, LeadStatus.CANCELADO, LeadStatus.ESTORNADO, LeadStatus.CORRECAO_CONSULTOR, LeadStatus.FINALIZADO, LeadStatus.RENOVAR,
    LeadStatus.R_ASSINATURA, LeadStatus.R_CONFIRMACAO, LeadStatus.R_ANALISE, LeadStatus.R_VALIDANDO, LeadStatus.R_FECHADO
  ];

  const isClosedClient = CLOSED_FLOW_STATUSES.includes(editableLead.Status);

  // Função de input inteligente: se o campo editado pertencer ao contato principal atual, atualiza o Telefone_Principal
  const handleInputChange = (field: keyof Lead, value: any) => {
    setEditableLead(prev => {
      const updated = { ...prev, [field]: value };
      const currentPrimary = prev.primaryContactIndex || 1;
      
      const isPrimaryPhoneField = 
        (currentPrimary === 1 && field === 'CELULAR') ||
        (currentPrimary === 2 && field === 'CELULAR_02') ||
        (currentPrimary === 3 && field === 'CELULAR_03') ||
        (currentPrimary === 4 && field === 'CELULAR_04') ||
        (currentPrimary === 5 && field === 'CELULAR_05');
      
      if (isPrimaryPhoneField) {
        updated.Telefone_Principal = value;
      }
      
      return updated;
    });
  };

  const handleLineChange = (index: number, field: keyof LineDetail, value: any) => {
    const newLines = [...(editableLead.linhasDetalhas || [])];
    if (field === 'valor') {
      newLines[index] = { ...newLines[index], [field]: parseFloat(value) || 0 };
    } else {
      newLines[index] = { ...newLines[index], [field]: value };
    }
    const newTotal = newLines.reduce((acc, curr) => acc + (curr.valor || 0), 0);
    setEditableLead(prev => ({ 
      ...prev, 
      linhasDetalhas: newLines,
      valorTotalReceita: newTotal,
      ATIVOS: newLines.length.toString()
    }));
  };

  const addLine = () => {
    const newLine: LineDetail = { telefone: '', plano: 'NOVO PLANO', valor: 0, idLinha: '', aging: '', conta: '' };
    const newLines = [...(editableLead.linhasDetalhas || []), newLine];
    setEditableLead(prev => ({ ...prev, linhasDetalhas: newLines, ATIVOS: newLines.length.toString() }));
  };

  const removeLine = (index: number) => {
    const newLines = (editableLead.linhasDetalhas || []).filter((_, i) => i !== index);
    const newTotal = newLines.reduce((acc, curr) => acc + (curr.valor || 0), 0);
    setEditableLead(prev => ({ ...prev, linhasDetalhas: newLines, valorTotalReceita: newTotal, ATIVOS: newLines.length.toString() }));
  };

  const replicateFirstRow = () => {
    const lines = editableLead.linhasDetalhas || [];
    if (lines.length < 2) return;
    const firstLine = lines[0];
    const updatedLines = lines.map((line, idx) => idx === 0 ? line : { ...line, plano: firstLine.plano, valor: firstLine.valor });
    const totalValue = updatedLines.reduce((acc, curr) => acc + curr.valor, 0);
    setEditableLead(prev => ({ ...prev, linhasDetalhas: updatedLines, valorTotalReceita: totalValue }));
  };

  const syncBrasilAPI = async () => {
    const cnpjClean = String(editableLead.CNPJ || '').replace(/\D/g, '');
    if (!cnpjClean || cnpjClean.length !== 14) {
      alert("CNPJ inválido para sincronização.");
      return;
    }
    setIsSyncing(true);
    try {
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjClean}`);
      if (!response.ok) throw new Error("Erro na API");
      const data = await response.json();
      
      const syncedLead = {
        ...editableLead,
        razaoSocial: data.razao_social?.toUpperCase() || editableLead.razaoSocial,
        estado: data.uf?.toUpperCase() || editableLead.estado,
        Telefone_Principal: data.ddd_telefone_1 || editableLead.Telefone_Principal,
        NOME: (data.qsa?.[0] as { nome?: string })?.nome?.toUpperCase() || editableLead.NOME,
        EMAIL: data.email?.toLowerCase() || editableLead.EMAIL,
        CELULAR: data.ddd_telefone_1 || editableLead.CELULAR
      };

      setEditableLead(syncedLead);
      alert("Dados atualizados com sucesso pela API! Clique em SALVAR para confirmar no banco.");
    } catch (e) {
      console.error("Erro sync:", e);
      alert("Falha ao consultar CNPJ. Verifique a conexão.");
    } finally { setIsSyncing(false); }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    const note: LeadNote = { id: `note-${Date.now()}`, leadId: editableLead.id, userName: user.name, content: newNote, createdAt: new Date().toLocaleString('pt-BR') };
    const updated = { ...editableLead, notes: [note, ...(editableLead.notes || [])] };
    setEditableLead(updated);
    setNewNote('');
    await onUpdate(updated);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newAttachments: Attachment[] = Array.from(files).map((f: File) => ({
      id: `att-${Date.now()}-${Math.random()}`,
      name: f.name.toUpperCase(),
      url: '#',
      type: f.type,
      size: (f.size / 1024).toFixed(1) + ' KB',
      createdAt: new Date().toLocaleString('pt-BR')
    }));
    const updated = { ...editableLead, attachments: [...(editableLead.attachments || []), ...newAttachments] };
    setEditableLead(updated);
    await onUpdate(updated);
  };

  const handleSave = async () => {
    setSaveStatus('saving');
    try {
      await onUpdate(editableLead);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err) {
      console.error("Erro ao salvar lead:", err);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

  // Correção: Agora usa o valor mais atual do estado funcional para definir o Telefone_Principal
  const setPrimaryContact = (index: number) => {
    setEditableLead(prev => {
      let phoneToUse = '';
      switch(index) {
        case 1: phoneToUse = prev.CELULAR; break;
        case 2: phoneToUse = prev.CELULAR_02; break;
        case 3: phoneToUse = prev.CELULAR_03; break;
        case 4: phoneToUse = prev.CELULAR_04; break;
        case 5: phoneToUse = prev.CELULAR_05; break;
      }
      return {
        ...prev,
        primaryContactIndex: index,
        Telefone_Principal: phoneToUse || prev.Telefone_Principal
      };
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 lg:p-6 animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={onClose}></div>
      <div className="bg-slate-50 w-full max-w-[1550px] h-full max-h-[96vh] rounded-[3rem] shadow-2xl overflow-hidden flex flex-col relative z-10 border border-white/20">
        
        <div className="px-10 py-5 border-b border-slate-200 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center space-x-5">
            <div className={`w-12 h-12 rounded-2xl bg-slate-900 flex items-center justify-center text-white shadow-lg`}>
              {isClosedClient ? <CheckCircle2 size={24} className="text-emerald-400" /> : <Building size={24} />}
            </div>
            <div>
               <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">{editableLead.razaoSocial}</h2>
               <div className="flex items-center space-x-2 mt-0.5">
                <span className={`px-2.5 py-0.5 rounded-lg text-[8px] font-black uppercase border flex items-center space-x-1 ${STATUS_COLORS[editableLead.Status]}`}>
                  {STATUS_ICONS[editableLead.Status]} <span>{editableLead.Status}</span>
                </span>
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-2">ID: {editableLead.ELEMENTO} • Vendedor: {editableLead.Vendedor}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button 
              type="button"
              onClick={() => handleLaunchWhatsApp()}
              className="flex items-center space-x-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white rounded-xl text-[10px] font-black uppercase transition-all shadow-md shadow-emerald-500/20"
              title="Abrir WhatsApp CRM para este cliente"
            >
              <div className="w-4 h-4 rounded-full overflow-hidden flex items-center justify-center shrink-0">
                <img src="https://i.imgur.com/Y1YwAp2.png" alt="WhatsApp" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
              </div>
              <span>WhatsApp CRM</span>
            </button>

            <button onClick={syncBrasilAPI} disabled={isSyncing} className="flex items-center space-x-2 px-6 py-2.5 bg-emerald-50 text-emerald-600 rounded-xl text-[10px] font-black uppercase border border-emerald-100 hover:bg-emerald-100 transition-all">
              {isSyncing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
              <span>Sincronizar API</span>
            </button>
            <button 
              onClick={handleSave} 
              disabled={saveStatus === 'saving'}
              className={`px-8 py-2.5 rounded-xl text-[11px] font-black uppercase transition-all shadow-xl shadow-blue-100 flex items-center space-x-2 ${
                saveStatus === 'saved' ? 'bg-emerald-500 text-white' : 
                saveStatus === 'error' ? 'bg-red-500 text-white' : 
                'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {saveStatus === 'saving' ? <Loader2 size={16} className="animate-spin" /> : 
               saveStatus === 'saved' ? <CheckCircle2 size={16} /> : 
               saveStatus === 'error' ? <AlertTriangle size={16} /> : 
               <Save size={16} />}
              <span>
                {saveStatus === 'saving' ? 'Salvando...' : 
                 saveStatus === 'saved' ? 'Concluído!' : 
                 saveStatus === 'error' ? 'Falha no Banco' : 
                 'Salvar Alterações'}
              </span>
            </button>
            <button onClick={onClose} className="p-2.5 bg-slate-50 text-slate-400 hover:text-slate-900 rounded-xl border border-slate-100 ml-2"><X size={20} /></button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          <div className="w-[60%] flex flex-col border-r border-slate-200">
             <div className="px-10 py-4 bg-white border-b border-slate-100 flex items-center space-x-6">
                <button onClick={() => setLeftPanelTab('cadastro')} className={`flex items-center space-x-2 pb-4 pt-2 border-b-4 transition-all ${leftPanelTab === 'cadastro' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400'}`}><FileText size={16} /><span className="text-[10px] font-black uppercase tracking-widest">Dados Cadastrais</span></button>
                <button onClick={() => setLeftPanelTab('linhas')} className={`flex items-center space-x-2 pb-4 pt-2 border-b-4 transition-all ${leftPanelTab === 'linhas' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-slate-400'}`}><Smartphone size={16} /><span className="text-[10px] font-black uppercase tracking-widest">Linhas & Planos</span></button>
             </div>

             <div className="flex-1 overflow-y-auto p-10 space-y-10 custom-scrollbar">
                {leftPanelTab === 'cadastro' ? (
                  <div className="space-y-10 animate-in fade-in slide-in-from-left-4 duration-300">
                    <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm space-y-6">
                        <div className="flex items-center space-x-3 text-slate-800 font-black text-[10px] uppercase tracking-widest"><Building size={16} className="text-blue-500" /> <span>Identificação Corporativa</span></div>
                        <div className="grid grid-cols-2 gap-6">
                          <div className="col-span-2"><EditableField label="RAZÃO SOCIAL" field="razaoSocial" value={editableLead.razaoSocial} onChange={handleInputChange} /></div>
                          <EditableField label="ESTADO (UF)" field="estado" value={editableLead.estado} onChange={handleInputChange} />
                          <EditableField label="CNPJ / CPF" field="CNPJ" value={editableLead.CNPJ} onChange={handleInputChange} />
                          <EditableField 
                            label="TELEFONE PRINCIPAL (REF. COLUNA)" 
                            field="Telefone_Principal" 
                            value={editableLead.Telefone_Principal} 
                            disabled 
                            onChange={handleInputChange}
                            action={
                              editableLead.Telefone_Principal ? (
                                <button
                                  type="button"
                                  onClick={() => handleLaunchWhatsApp(editableLead.Telefone_Principal, editableLead.razaoSocial)}
                                  className="text-[9px] font-black text-emerald-600 hover:text-emerald-700 flex items-center space-x-1 uppercase"
                                  title="Iniciar conversa no WhatsApp CRM"
                                >
                                  <img src="https://i.imgur.com/Y1YwAp2.png" alt="WhatsApp" className="w-3 h-3 object-contain" referrerPolicy="no-referrer" />
                                  <span>Abrir no WhatsApp</span>
                                </button>
                              ) : null
                            }
                          />
                          <EditableField label="OPERADORA ATUAL" field="operadora" value={editableLead.operadora} onChange={handleInputChange} />
                          <EditableField label="QUANTIDADE ATIVOS" field="ATIVOS" value={editableLead.ATIVOS} onChange={handleInputChange} />
                          <EditableField label="DATA CONSULTA" field="DATA_Consulta" value={editableLead.DATA_Consulta} onChange={handleInputChange} />
                        </div>
                    </div>

                    <div className={`${isClosedClient ? 'bg-blue-50 border-blue-100' : 'bg-purple-50 border-purple-100'} border p-8 rounded-[2rem] shadow-sm space-y-8`}>
                        <div className={`flex items-center space-x-3 ${isClosedClient ? 'text-blue-700' : 'text-purple-700'} font-black text-[10px] uppercase tracking-widest`}>
                          <CreditCard size={18} /> 
                          <span>{isClosedClient ? 'DADOS DO PEDIDO / CLIENTE ATIVADO' : 'INFORMAÇÕES DA VIVO (OPERADORA ATUAL)'}</span>
                        </div>
                        {isClosedClient ? (
                          <div className="grid grid-cols-2 gap-6">
                            <EditableField label="CUST CODE" field="custCode" value={editableLead.custCode} onChange={handleInputChange} />
                            <EditableField label="RADAR (PROTOCOLO)" field="radar" value={editableLead.radar} onChange={handleInputChange} />
                            <EditableField label="LOGIN VIVO" field="login" value={editableLead.login} onChange={handleInputChange} />
                            <EditableField label="SENHA VIVO" field="senha" value={editableLead.senha} onChange={handleInputChange} />
                            <EditableField label="TOKEN CADASTRO" field="tokenCadastro" value={editableLead.tokenCadastro} onChange={handleInputChange} />
                            <EditableField label="DATA RENOVAÇÃO" field="dataRenovacao" type="date" value={editableLead.dataRenovacao} onChange={handleInputChange} />
                          </div>
                        ) : (
                          <div className="grid grid-cols-3 gap-8">
                            <EditableField label="RETORNO CRÉDITO VIVO" field="RETORNO_CREDITO_VIVO" value={editableLead.RETORNO_CREDITO_VIVO} onChange={handleInputChange} />
                            <EditableField label="VALOR EM ABERTO VIVO" field="VALOR_EM_ABERTO_VIVO" value={editableLead.VALOR_EM_ABERTO_VIVO} onChange={handleInputChange} />
                            <EditableField label="VALOR TOTAL DÉBITO VIVO" field="VALOR_TOTAL_DEBITO_VIVO" value={editableLead.VALOR_TOTAL_DEBITO_VIVO} onChange={handleInputChange} />
                            <EditableField label="N° ULTIMO PEDIDO NA VIVO" field="N_ULTIMO_PEDIDO_NA_VIVO" value={editableLead.N_ULTIMO_PEDIDO_NA_VIVO} onChange={handleInputChange} />
                            <EditableField label="DATA ÚLTIMO PEDIDO NA VIVO" field="DATA_ULTIMO_PEDIDO_NA_VIVO" value={editableLead.DATA_ULTIMO_PEDIDO_NA_VIVO} onChange={handleInputChange} />
                            <EditableField label="STATUS PEDIDO VIVO" field="STATUS_PEDIDO_VIVO" value={editableLead.STATUS_PEDIDO_VIVO} onChange={handleInputChange} />
                          </div>
                        )}
                    </div>

                    <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm space-y-6">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3 text-slate-800 font-black text-[10px] uppercase tracking-widest"><UserPlus size={16} className="text-emerald-500" /> <span>Contatos / Responsáveis</span></div>
                          <div className="flex bg-slate-100 p-1 rounded-xl items-center space-x-1">
                              {[1,2,3,4,5].map(i => (
                                <button key={i} onClick={() => setActiveContact(i)} className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase transition-all flex items-center space-x-1 ${activeContact === i ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>
                                    <span>C{i}</span>
                                    {editableLead.primaryContactIndex === i && <Star size={8} className="fill-amber-400 text-amber-400" />}
                                </button>
                              ))}
                          </div>
                        </div>

                        <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100 space-y-6 relative overflow-hidden">
                          <div className="flex items-center justify-between">
                              <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic">Editando Contato {activeContact}</h4>
                              <button onClick={() => setPrimaryContact(activeContact)} className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${editableLead.primaryContactIndex === activeContact ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-white text-slate-400 border border-slate-200 hover:text-amber-500'}`}>
                                <Star size={14} className={editableLead.primaryContactIndex === activeContact ? "fill-amber-500 text-amber-500" : ""} />
                                <span>{editableLead.primaryContactIndex === activeContact ? 'Contato Principal Ativo' : 'Marcar como Principal'}</span>
                              </button>
                          </div>

                          <div className="grid grid-cols-2 gap-6 animate-in fade-in duration-300">
                              {activeContact === 1 && (
                                <>
                                  <div className="col-span-2"><EditableField label="NOME COMPLETO" field="NOME" value={editableLead.NOME} onChange={handleInputChange} /></div>
                                  <EditableField label="CPF" field="CPF" value={editableLead.CPF} onChange={handleInputChange} />
                                  <EditableField 
                                    label="CELULAR / WHATSAPP" 
                                    field="CELULAR" 
                                    value={editableLead.CELULAR} 
                                    onChange={handleInputChange}
                                    action={
                                      editableLead.CELULAR ? (
                                        <button
                                          type="button"
                                          onClick={() => handleLaunchWhatsApp(editableLead.CELULAR, editableLead.NOME)}
                                          className="text-[9px] font-black text-emerald-600 hover:text-emerald-700 flex items-center space-x-1 uppercase"
                                          title="Iniciar conversa no WhatsApp CRM"
                                        >
                                          <img src="https://i.imgur.com/Y1YwAp2.png" alt="WhatsApp" className="w-3 h-3 object-contain" referrerPolicy="no-referrer" />
                                          <span>WhatsApp</span>
                                        </button>
                                      ) : null
                                    }
                                  />
                                  <div className="col-span-2"><EditableField label="E-MAIL" field="EMAIL" value={editableLead.EMAIL} onChange={handleInputChange} /></div>
                                </>
                              )}
                              {activeContact === 2 && (
                                <>
                                  <div className="col-span-2"><EditableField label="NOME COMPLETO 02" field="NOME_02" value={editableLead.NOME_02} onChange={handleInputChange} /></div>
                                  <EditableField label="CPF 02" field="CPF_02" value={editableLead.CPF_02} onChange={handleInputChange} />
                                  <EditableField 
                                    label="CELULAR 02" 
                                    field="CELULAR_02" 
                                    value={editableLead.CELULAR_02} 
                                    onChange={handleInputChange}
                                    action={
                                      editableLead.CELULAR_02 ? (
                                        <button
                                          type="button"
                                          onClick={() => handleLaunchWhatsApp(editableLead.CELULAR_02, editableLead.NOME_02)}
                                          className="text-[9px] font-black text-emerald-600 hover:text-emerald-700 flex items-center space-x-1 uppercase"
                                        >
                                          <img src="https://i.imgur.com/Y1YwAp2.png" alt="WhatsApp" className="w-3 h-3 object-contain" referrerPolicy="no-referrer" />
                                          <span>WhatsApp</span>
                                        </button>
                                      ) : null
                                    }
                                  />
                                  <div className="col-span-2"><EditableField label="E-MAIL 02" field="EMAIL_02" value={editableLead.EMAIL_02} onChange={handleInputChange} /></div>
                                </>
                              )}
                              {activeContact === 3 && (
                                <>
                                  <div className="col-span-2"><EditableField label="NOME COMPLETO 03" field="NOME_03" value={editableLead.NOME_03} onChange={handleInputChange} /></div>
                                  <EditableField label="CPF 03" field="CPF_03" value={editableLead.CPF_03} onChange={handleInputChange} />
                                  <EditableField 
                                    label="CELULAR 03" 
                                    field="CELULAR_03" 
                                    value={editableLead.CELULAR_03} 
                                    onChange={handleInputChange}
                                    action={
                                      editableLead.CELULAR_03 ? (
                                        <button
                                          type="button"
                                          onClick={() => handleLaunchWhatsApp(editableLead.CELULAR_03, editableLead.NOME_03)}
                                          className="text-[9px] font-black text-emerald-600 hover:text-emerald-700 flex items-center space-x-1 uppercase"
                                        >
                                          <img src="https://i.imgur.com/Y1YwAp2.png" alt="WhatsApp" className="w-3 h-3 object-contain" referrerPolicy="no-referrer" />
                                          <span>WhatsApp</span>
                                        </button>
                                      ) : null
                                    }
                                  />
                                  <div className="col-span-2"><EditableField label="E-MAIL 03" field="EMAIL_03" value={editableLead.EMAIL_03} onChange={handleInputChange} /></div>
                                </>
                              )}
                              {activeContact === 4 && (
                                <>
                                  <div className="col-span-2"><EditableField label="NOME COMPLETO 04" field="NOME_04" value={editableLead.NOME_04} onChange={handleInputChange} /></div>
                                  <EditableField label="CPF 04" field="CPF_04" value={editableLead.CPF_04} onChange={handleInputChange} />
                                  <EditableField 
                                    label="CELULAR 04" 
                                    field="CELULAR_04" 
                                    value={editableLead.CELULAR_04} 
                                    onChange={handleInputChange}
                                    action={
                                      editableLead.CELULAR_04 ? (
                                        <button
                                          type="button"
                                          onClick={() => handleLaunchWhatsApp(editableLead.CELULAR_04, editableLead.NOME_04)}
                                          className="text-[9px] font-black text-emerald-600 hover:text-emerald-700 flex items-center space-x-1 uppercase"
                                        >
                                          <img src="https://i.imgur.com/Y1YwAp2.png" alt="WhatsApp" className="w-3 h-3 object-contain" referrerPolicy="no-referrer" />
                                          <span>WhatsApp</span>
                                        </button>
                                      ) : null
                                    }
                                  />
                                  <div className="col-span-2"><EditableField label="E-MAIL 04" field="EMAIL_04" value={editableLead.EMAIL_04} onChange={handleInputChange} /></div>
                                </>
                              )}
                              {activeContact === 5 && (
                                <>
                                  <div className="col-span-2"><EditableField label="NOME COMPLETO 05" field="NOME_05" value={editableLead.NOME_05} onChange={handleInputChange} /></div>
                                  <EditableField label="CPF 05" field="CPF_05" value={editableLead.CPF_05} onChange={handleInputChange} />
                                  <EditableField 
                                    label="CELULAR 05" 
                                    field="CELULAR_05" 
                                    value={editableLead.CELULAR_05} 
                                    onChange={handleInputChange}
                                    action={
                                      editableLead.CELULAR_05 ? (
                                        <button
                                          type="button"
                                          onClick={() => handleLaunchWhatsApp(editableLead.CELULAR_05, editableLead.NOME_05)}
                                          className="text-[9px] font-black text-emerald-600 hover:text-emerald-700 flex items-center space-x-1 uppercase"
                                        >
                                          <img src="https://i.imgur.com/Y1YwAp2.png" alt="WhatsApp" className="w-3 h-3 object-contain" referrerPolicy="no-referrer" />
                                          <span>WhatsApp</span>
                                        </button>
                                      ) : null
                                    }
                                  />
                                  <div className="col-span-2"><EditableField label="E-MAIL 05" field="EMAIL_05" value={editableLead.EMAIL_05} onChange={handleInputChange} /></div>
                                </>
                              )}
                          </div>
                          <p className="text-[9px] text-slate-400 font-bold uppercase mt-4 italic"><AlertTriangle size={10} className="inline mr-1" /> Ao marcar como principal, o número do celular deste contato será vinculado à coluna de busca da tabela principal.</p>
                        </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="flex items-center justify-between bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
                       <div className="flex items-center space-x-4">
                          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center"><Smartphone size={24} /></div>
                          <div>
                             <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Edição de Linhas Ativas</h3>
                             <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Ajuste planos e valores contratados</p>
                          </div>
                       </div>
                       <div className="flex items-center space-x-3">
                          <div className="text-right mr-4">
                             <p className="text-[8px] font-black text-emerald-600 uppercase tracking-widest">Total Receita</p>
                             <p className="text-xl font-black text-slate-900">{(editableLead.valorTotalReceita || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                          </div>
                          <button onClick={replicateFirstRow} className="flex items-center space-x-2 bg-indigo-50 text-indigo-600 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase border border-indigo-100 hover:bg-indigo-100 transition-all"><Copy size={16} /> <span>Replicar 1ª</span></button>
                          <button onClick={addLine} className="flex items-center space-x-2 bg-slate-900 text-white px-6 py-2.5 rounded-xl text-[10px] font-black uppercase hover:bg-black transition-all shadow-xl"><PlusCircle size={16} /> <span>Nova Linha</span></button>
                       </div>
                    </div>

                    <div className="bg-white rounded-[2rem] border border-slate-100 overflow-x-auto shadow-inner custom-scrollbar">
                      <table className="w-full text-left">
                        <thead className="bg-slate-900 text-white">
                            <tr>
                              <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest w-44">Telefone</th>
                              <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest min-w-[350px]">Plano / SKU</th>
                              <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-right w-32">Valor R$</th>
                              <th className="px-4 py-4 text-center w-16"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {(editableLead.linhasDetalhas || []).map((linha, idx) => (
                              <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                <td className="px-4 py-3"><input type="text" value={linha.telefone} onChange={(e) => handleLineChange(idx, 'telefone', e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-lg px-2 py-1.5 font-mono text-[11px] font-black text-slate-700 outline-none" /></td>
                                <td className="px-4 py-3"><input type="text" value={linha.plano} onChange={(e) => handleLineChange(idx, 'plano', e.target.value.toUpperCase())} className="w-full bg-slate-50 border border-slate-100 rounded-lg px-2 py-1.5 text-[10px] font-black text-blue-600 outline-none" /></td>
                                <td className="px-4 py-3"><input type="number" value={linha.valor} onChange={(e) => handleLineChange(idx, 'valor', e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-lg px-2 py-1.5 text-right font-black text-emerald-600 text-[11px] outline-none" /></td>
                                <td className="px-4 py-3 text-center"><button onClick={() => removeLine(idx)} className="p-2 text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={14} /></button></td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
             </div>
          </div>

          <div className="w-[40%] flex flex-col bg-white">
             <div className="px-8 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between shrink-0">
                <div className="flex bg-slate-200/50 p-1 rounded-xl shadow-inner">
                   <button onClick={() => setRightPanelTab('notas')} className={`px-6 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all flex items-center space-x-2 ${rightPanelTab === 'notas' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}><MessageSquare size={14}/><span>Notas</span></button>
                   <button onClick={() => setRightPanelTab('arquivos')} className={`px-6 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all flex items-center space-x-2 ${rightPanelTab === 'arquivos' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}><FolderOpen size={14}/><span>Arquivos</span></button>
                </div>
             </div>

             <div className="flex-1 overflow-hidden flex flex-col">
                {rightPanelTab === 'notas' ? (
                  <div className="flex-1 flex flex-col overflow-hidden p-8 animate-in slide-in-from-right-10 duration-300">
                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-5 pr-2 mb-6">
                      {loadingTickets ? (
                        <div className="flex flex-col items-center justify-center py-10 space-y-3">
                          <Loader2 size={24} className="animate-spin text-blue-500" />
                          <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Sincronizando Histórico...</span>
                        </div>
                      ) : unifiedTimeline.length === 0 ? (
                        <div className="text-center py-12 px-6 flex flex-col items-center justify-center text-slate-400">
                          <MessageSquare size={36} className="mb-2 stroke-1 opacity-60" />
                          <span className="text-[10px] font-black uppercase tracking-widest">Nenhuma nota ou chamado registrado</span>
                        </div>
                      ) : (
                        unifiedTimeline.map((item) => {
                          const isSelf = item.userName === user.name;
                          
                          let bubbleStyles = "";
                          let textStyles = "";
                          let badge = null;
                          
                          if (item.type === 'lead_note') {
                            bubbleStyles = isSelf ? 'bg-blue-600 text-white border-blue-500 rounded-tr-none' : 'bg-slate-50 text-slate-700 border-slate-100 rounded-tl-none';
                            textStyles = isSelf ? 'text-white' : 'text-slate-700';
                          } else if (item.type === 'ticket_creation') {
                            bubbleStyles = 'bg-amber-50/75 text-slate-800 border-amber-200 border-2 rounded-tl-none';
                            textStyles = 'text-slate-800';
                            badge = (
                              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-lg bg-amber-100 text-amber-850 text-[8px] font-black uppercase mb-1.5 border border-amber-200/50">
                                <span>🎫 CHAMADO ABERTO</span>
                              </span>
                            );
                          } else if (item.type === 'ticket_note') {
                            bubbleStyles = 'bg-indigo-50/70 text-slate-800 border-indigo-200 border rounded-tl-none';
                            textStyles = 'text-slate-800';
                            badge = (
                              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-lg bg-indigo-100 text-indigo-850 text-[8px] font-black uppercase mb-1.5 border border-indigo-200/40">
                                <span>💬 ATUALIZAÇÃO CARREGADA DO CHAMADO</span>
                              </span>
                            );
                          }
                          
                          return (
                            <div key={item.id} className={`flex flex-col ${isSelf && item.type === 'lead_note' ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-1`}>
                               <div className={`max-w-[92%] p-5 rounded-[1.5rem] border shadow-sm transition-all duration-300 hover:shadow-md ${bubbleStyles}`}>
                                 {badge}
                                 <p className="text-xs font-bold whitespace-pre-wrap leading-relaxed">{item.content}</p>
                                 
                                 {item.attachments && item.attachments.length > 0 && (
                                   <div className="mt-3 pt-3 border-t border-slate-200/40 space-y-1.5">
                                     <div className="text-[8px] font-black uppercase tracking-wider text-slate-400">Anexos do Chamado:</div>
                                     {item.attachments.map((file) => (
                                       <a 
                                         key={file.id} 
                                         href={file.url} 
                                         target="_blank" 
                                         rel="noreferrer"
                                         className="flex items-center space-x-2 p-2 bg-white/90 hover:bg-white rounded-lg border border-slate-100 transition-all text-slate-600 hover:text-blue-600 text-left cursor-pointer inline-flex"
                                       >
                                         <Paperclip size={10} className="text-slate-400 shrink-0" />
                                         <span className="text-[10px] font-black truncate max-w-[200px]">{file.name}</span>
                                         <span className="text-[8px] font-bold text-slate-400 uppercase">({file.size || 'N/A'})</span>
                                       </a>
                                     ))}
                                   </div>
                                 )}
                               </div>
                               <div className="mt-1.5 px-2 flex items-center space-x-1.5">
                                 <span className="text-[8px] font-black text-slate-400 uppercase">
                                   {item.userName} • {item.createdAt}
                                 </span>
                               </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                    <div className="relative pt-4 border-t border-slate-100">
                      <textarea value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="Acompanhamento..." className="w-full bg-slate-50 border border-slate-200 rounded-[1.5rem] px-6 py-4 text-sm font-bold focus:bg-white transition-all outline-none resize-none h-32" />
                      <button onClick={handleAddNote} className="absolute bottom-6 right-6 bg-slate-900 text-white p-3.5 rounded-2xl hover:bg-black transition-all shadow-xl active:scale-95"><Send size={20} /></button>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                    {(editableLead.attachments || []).map((file) => (
                      <div key={file.id} className="bg-white border border-slate-100 p-5 rounded-2xl flex items-center space-x-4 group mb-3">
                         <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-500"><FileText size={24} /></div>
                         <div className="flex-1 overflow-hidden"><h4 className="text-[10px] font-black uppercase truncate">{file.name}</h4><p className="text-[8px] font-bold text-slate-400 uppercase">{file.size} • {file.createdAt}</p></div>
                         <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity"><button className="p-2 text-slate-400 hover:text-blue-600"><Download size={16} /></button><button onClick={async () => { const updated = { ...editableLead, attachments: editableLead.attachments?.filter(a => a.id !== file.id) }; setEditableLead(updated); await onUpdate(updated); }} className="p-2 text-slate-400 hover:text-red-500" ><Trash2 size={16} /></button></div>
                      </div>
                    ))}
                  </div>
                )}
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeadDetailsModal;
