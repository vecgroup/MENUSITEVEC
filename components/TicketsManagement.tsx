
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  ArrowLeft, Search, Building, Plus, History, Clock, CheckCircle2, LifeBuoy,
  MessageSquare, User, Key, Smartphone, AlertTriangle, ChevronRight, X, Send,
  Hash, ClipboardList, UserCheck, Check, FileText, ShieldCheck, Paperclip, Trash2, Download, Eye, ExternalLink, Image as ImageIcon, Loader2,
  Building2,
  Lock,
  Handshake
} from 'lucide-react';
import { Ticket, TicketStatus, Lead, LeadStatus, User as AppUser, TicketNote, Attachment, UserRole } from '../types';
import { supabase, supabaseClient, leadsClient, buildSSOUrl } from '../lib/supabase';

const parseTicketDescription = (desc: string) => {
  let endereco = '';
  let representantes = '';
  let cleanDescription = desc || '';

  if (desc && desc.includes('🏢 DADOS DA EMPRESA')) {
    const endMatch = desc.match(/📍 Endereço:\s*(.*?)\n/);
    const repMatch = desc.match(/👤 Sócios\/Representantes:\s*(.*?)\n/);
    const descParts = desc.split('\n📝 DESCRIÇÃO DA SOLICITAÇÃO:\n');
    
    if (endMatch) endereco = endMatch[1];
    if (repMatch) representantes = repMatch[1];
    if (descParts.length > 1) {
      cleanDescription = descParts[1];
    } else {
      cleanDescription = desc.replace(/🏢 DADOS DA EMPRESA[\s\S]*?📝 DESCRIÇÃO DA SOLICITAÇÃO:\n/, '');
    }
  }

  return { endereco, representantes, cleanDescription };
};

interface TicketsManagementProps {
  user: AppUser;
  tickets: Ticket[];
  leads: Lead[];
  onBack: () => void;
  onUpdateTicket: (ticket: Ticket) => Promise<void>;
  onDeleteTicket?: (id: string) => Promise<void>;
  onOpenWhatsApp?: (options: { phone?: string; cnpj?: string; leadName?: string; company?: string; leadId?: string }) => void;
}

const TicketsManagement: React.FC<TicketsManagementProps> = ({ user, tickets, leads, onBack, onUpdateTicket, onDeleteTicket, onOpenWhatsApp }) => {
  const [activeTab, setActiveTab] = useState<'ABERTO' | 'FINALIZADO'>('ABERTO');
  const [isCreating, setIsCreating] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  
  // New States for search and linking
  const [searchTerm, setSearchTerm] = useState('');
  const [closedLeadSearch, setClosedLeadSearch] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedLinkedLead, setSelectedLinkedLead] = useState<Lead | null>(null);
  
  const [newTicketData, setNewTicketData] = useState({
    razaoSocial: '',
    cnpj: '',
    login: '', 
    password: '', 
    selectedLines: [] as string[], 
    description: '', 
    attachments: [] as Attachment[],
    endereco: '',
    representantes: ''
  });

  const [isFetchingCnpj, setIsFetchingCnpj] = useState(false);
  const [cnpjError, setCnpjError] = useState<string | null>(null);
  const [createdTicketResult, setCreatedTicketResult] = useState<{ ticket: Ticket; linkedLead: Lead | null } | null>(null);
  const [activeLinkedLead, setActiveLinkedLead] = useState<Lead | null>(null);

  const findClosedLeadByCnpj = async (cnpjValue: string): Promise<Lead | null> => {
    const rawDigits = cnpjValue.replace(/\D/g, '');
    if (rawDigits.length !== 14) return null;

    // 1. Search in local memory first
    const memoryMatch = leads.find(l => {
      const isClosed = l.isFromClosedTable || l.Status === LeadStatus.FECHADO;
      return isClosed && l.CNPJ && l.CNPJ.replace(/\D/g, '') === rawDigits;
    });
    if (memoryMatch) return memoryMatch;

    // 2. Query the live database 'leads_fechados' table directly via leadsClient
    try {
      const { data, error } = await leadsClient
        .from('leads_fechados')
        .select('*')
        .or(`cnpj.eq.${rawDigits},cnpj.ilike.%${rawDigits.substring(0, 2)}.%`);

      if (error) {
        console.error("Erro ao consultar leads_fechados por CNPJ:", error);
      }

      if (data && data.length > 0) {
        const dbMatch = data.find((row: any) => {
          const rowCnpj = row.cnpj || row.CNPJ || '';
          return rowCnpj.replace(/\D/g, '') === rawDigits;
        });
        if (dbMatch) {
          return {
            ...dbMatch,
            id: dbMatch.id,
            ELEMENTO: dbMatch.elemento || dbMatch.ELEMENTO || '--',
            CNPJ: dbMatch.cnpj || dbMatch.CNPJ || '--',
            razaoSocial: dbMatch.razao_social || dbMatch.razaoSocial || dbMatch.razaosocial || 'EMPRESA SEM NOME',
            DATA_Consulta: dbMatch.data_consulta || dbMatch.DATA_Consulta || '',
            Status: LeadStatus.FECHADO,
            Vendedor: dbMatch.vendedor || dbMatch.Vendedor || 'SISTEMA',
            Telefone_Principal: dbMatch.telefone_principal || dbMatch.Telefone_Principal || '',
            ATIVOS: String(dbMatch.ativos || dbMatch.ATIVOS || '0'),
            valorTotalReceita: Number(dbMatch.valor_total_receita || dbMatch.valorTotalReceita || 0),
            login: dbMatch.login,
            senha: dbMatch.senha || dbMatch.password || '',
            NOME: dbMatch.nome || dbMatch.NOME || '',
            isFromClosedTable: true
          } as Lead;
        }
      }
    } catch (err) {
      console.error("Erro ao pesquisar cliente de forma direta em leads_fechados:", err);
    }
    return null;
  };

  useEffect(() => {
    if (!selectedTicket) {
      setActiveLinkedLead(null);
      return;
    }
    const localLead = leads.find(l => {
      const isClosed = l.isFromClosedTable || l.Status === LeadStatus.FECHADO;
      if (!isClosed) return false;
      const isSameId = l.id === selectedTicket.leadId;
      const isSameCnpj = l.CNPJ && selectedTicket.cnpj && l.CNPJ.replace(/\D/g, '') === selectedTicket.cnpj.replace(/\D/g, '');
      return isSameId || isSameCnpj;
    });

    if (localLead) {
      setActiveLinkedLead(localLead);
    } else if (selectedTicket.cnpj) {
      findClosedLeadByCnpj(selectedTicket.cnpj).then(dbLead => {
        if (dbLead) {
          setActiveLinkedLead(dbLead);
        }
      });
    }
  }, [selectedTicket, leads]);

  const fetchCnpjData = async (cnpjStr: string) => {
    const cleaned = cnpjStr.replace(/\D/g, '');
    if (cleaned.length !== 14) return;
    
    setIsFetchingCnpj(true);
    setCnpjError(null);
    try {
      const matchedClosedLead = await findClosedLeadByCnpj(cleaned);

      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleaned}`);
      if (!res.ok) throw new Error('Não foi possível buscar os dados do CNPJ');
      const data = await res.json();
      
      const reps = data.qsa?.map((socio: any) => `${socio.nome_socio} (${socio.qualificacao_socio || 'Sócio'})`).join(', ') || 'NÃO INFORMADO';
      const end = `${data.logradouro || ''}, ${data.numero || ''}${data.complemento ? ` - ${data.complemento}` : ''}, ${data.bairro || ''}, ${data.municipio || ''} - ${data.uf || ''}, CEP ${data.cep || ''}`;
      
      setNewTicketData(prev => {
        const finalLogin = matchedClosedLead?.login || prev.login || '';
        const finalPassword = matchedClosedLead?.senha || prev.password || '';
        const finalReps = matchedClosedLead?.NOME || prev.representantes || reps.toUpperCase();

        return {
          ...prev,
          razaoSocial: (data.razao_social || matchedClosedLead?.razaoSocial || prev.razaoSocial || '').toUpperCase(),
          endereco: end.toUpperCase(),
          representantes: finalReps.toUpperCase(),
          login: finalLogin,
          password: finalPassword
        };
      });

      if (matchedClosedLead) {
        setSelectedLinkedLead(matchedClosedLead);
      }
    } catch (err: any) {
      console.error(err);
      setCnpjError('Erro ao buscar CNPJ de forma externa. Usando dados cadastrais disponíveis.');
      
      const matchedClosedLead = await findClosedLeadByCnpj(cleaned);
      if (matchedClosedLead) {
        setSelectedLinkedLead(matchedClosedLead);
        setNewTicketData(prev => ({
          ...prev,
          razaoSocial: (matchedClosedLead.razaoSocial || '').toUpperCase(),
          login: matchedClosedLead.login || prev.login || '',
          password: matchedClosedLead.senha || prev.password || '',
          representantes: matchedClosedLead.NOME || prev.representantes || ''
        }));
      }
    } finally {
      setIsFetchingCnpj(false);
    }
  };

  const handleCnpjChange = async (val: string) => {
    const rawDigits = val.replace(/\D/g, '').substring(0, 14);
    
    setNewTicketData(prev => ({ ...prev, cnpj: rawDigits }));
    
    if (rawDigits.length === 14) {
      setIsFetchingCnpj(true);
      const matchedClosedLead = await findClosedLeadByCnpj(rawDigits);
      
      if (matchedClosedLead) {
        setSelectedLinkedLead(matchedClosedLead);
        setClosedLeadSearch(matchedClosedLead.razaoSocial);
        setNewTicketData(prev => ({
          ...prev,
          razaoSocial: matchedClosedLead.razaoSocial.toUpperCase(),
          login: matchedClosedLead.login || prev.login || '',
          password: matchedClosedLead.senha || prev.password || '',
          representantes: matchedClosedLead.NOME || prev.representantes || ''
        }));
      } else {
        setSelectedLinkedLead(null);
      }
      setIsFetchingCnpj(false);
      
      fetchCnpjData(rawDigits);
    } else {
      if (selectedLinkedLead) {
        setSelectedLinkedLead(null);
      }
    }
  };

  const handleCloseModal = () => {
    setIsCreating(false);
    setCreatedTicketResult(null);
    setNewTicketData({
      razaoSocial: '',
      cnpj: '',
      login: '', 
      password: '', 
      selectedLines: [], 
      description: '', 
      attachments: [],
      endereco: '',
      representantes: ''
    });
    setSelectedLinkedLead(null);
    setClosedLeadSearch('');
    setCnpjError(null);
  };

  const handleOpenModal = () => {
    setCreatedTicketResult(null);
    setNewTicketData({
      razaoSocial: '',
      cnpj: '',
      login: '', 
      password: '', 
      selectedLines: [], 
      description: '', 
      attachments: [],
      endereco: '',
      representantes: ''
    });
    setSelectedLinkedLead(null);
    setClosedLeadSearch('');
    setCnpjError(null);
    setIsCreating(true);
  };

  const [newNote, setNewNote] = useState('');
  const [noteAttachments, setNoteAttachments] = useState<Attachment[]>([]);
  const [isSendingNote, setIsSendingNote] = useState(false);
  
  const [showFinalizeForm, setShowFinalizeForm] = useState(false);
  const [finalResolutionNote, setFinalResolutionNote] = useState('');

  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const creationFileRef = useRef<HTMLInputElement>(null);
  const noteFileRef = useRef<HTMLInputElement>(null);

  const isPrivileged = useMemo(() => {
    const role = String(user.role || '').toUpperCase();
    return ['OWNER', 'SUPERVISOR', 'ADMINISTRATIVO', 'ADMINISTRADOR'].includes(role);
  }, [user.role]);

  const filteredTickets = useMemo(() => {
    return tickets.filter(t => {
      const matchesTab = activeTab === 'ABERTO' ? t.status !== TicketStatus.FINALIZADO : t.status === TicketStatus.FINALIZADO;
      if (!matchesTab) return false;
      
      const isMyTicket = isPrivileged || t.requesterId === user.id;
      if (!isMyTicket) return false;

      if (searchTerm.trim() !== '') {
        const term = searchTerm.toLowerCase();
        const matchesRazao = (t.razaoSocial || '').toLowerCase().includes(term);
        const matchesCnpj = (t.cnpj || '').replace(/\D/g, '').includes(term.replace(/\D/g, '')) || (t.cnpj || '').toLowerCase().includes(term);
        const matchesDesc = (t.description || '').toLowerCase().includes(term);
        const matchesRequester = (t.requesterName || '').toLowerCase().includes(term);
        const matchesLogin = (t.login || '').toLowerCase().includes(term);
        const matchesId = (t.id || '').toLowerCase().includes(term);
        
        return matchesRazao || matchesCnpj || matchesDesc || matchesRequester || matchesLogin || matchesId;
      }

      return true;
    });
  }, [tickets, activeTab, isPrivileged, user.id, searchTerm]);

  const linkedLead = useMemo(() => {
    if (!selectedTicket) return null;
    return leads.find(l => {
      const isClosed = l.isFromClosedTable || l.Status === LeadStatus.FECHADO;
      if (!isClosed) return false;
      const isSameId = l.id === selectedTicket.leadId;
      const isSameCnpj = l.CNPJ && selectedTicket.cnpj && l.CNPJ.replace(/\D/g, '') === selectedTicket.cnpj.replace(/\D/g, '');
      return isSameId || isSameCnpj;
    });
  }, [selectedTicket, leads]);

  const handleRedirectToClosedLead = async (lead: Lead) => {
    try {
      const rawCnpj = lead.CNPJ ? lead.CNPJ.replace(/\D/g, '') : '';
      const closedBase = 'https://clientesfechados.vecgroup.com.br';

      const handoverUrl = await buildSSOUrl(closedBase, {
        cnpj: rawCnpj,
        CNPJ: rawCnpj,
        search: rawCnpj,
        q: rawCnpj,
        user_email: user?.email
      });
      window.open(handoverUrl, '_blank');
    } catch (err) {
      console.error(err);
      const rawCnpj = lead.CNPJ ? lead.CNPJ.replace(/\D/g, '') : '';
      const cleanCnpj = encodeURIComponent(rawCnpj);
      const closedBase = 'https://clientesfechados.vecgroup.com.br';
      window.open(`${closedBase}/?cnpj=${cleanCnpj}&CNPJ=${cleanCnpj}&search=${cleanCnpj}&q=${cleanCnpj}`, '_blank');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, target: 'creation' | 'note') => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsUploading(true);
    const newFiles: Attachment[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > 5 * 1024 * 1024) {
        alert(`O arquivo ${file.name} é muito grande. O limite recomendado é 5MB.`);
        continue;
      }
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      newFiles.push({ id: `att-${Date.now()}-${Math.random()}`, name: file.name.toUpperCase(), url: base64, type: file.type, size: (file.size / 1024).toFixed(1) + ' KB', createdAt: new Date().toLocaleString('pt-BR') });
    }
    if (target === 'creation') setNewTicketData(prev => ({ ...prev, attachments: [...prev.attachments, ...newFiles] }));
    else setNoteAttachments(prev => [...prev, ...newFiles]);
    setIsUploading(false);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const ticket = tickets.find(t => t.id === id);
    if (!ticket) return;

    const isTicketOpen = ticket.status !== TicketStatus.FINALIZADO;
    if (isTicketOpen && user.role !== UserRole.OWNER) {
      alert("Apenas o proprietário (Owner) pode excluir um chamado em aberto.");
      return;
    }

    if (confirm("Deseja realmente EXCLUIR este chamado permanentemente? Esta ação não pode ser desfeita.")) {
      if (onDeleteTicket) {
        await onDeleteTicket(id);
        if (selectedTicket?.id === id) setSelectedTicket(null);
      }
    }
  };

  const handleCreateTicket = async () => {
    if (!newTicketData.razaoSocial.trim() || !newTicketData.description.trim()) {
      alert("Por favor, preencha a Razão Social e a Descrição.");
      return;
    }
    const now = new Date();
    const deadline = new Date(); deadline.setDate(now.getDate() + 5);

    let fullDescription = newTicketData.description;
    let detailsHeader = `🏢 DADOS DA EMPRESA (Puxados do CNPJ):\n`;
    if (newTicketData.endereco) {
      detailsHeader += `📍 Endereço: ${newTicketData.endereco}\n`;
    }
    if (newTicketData.representantes) {
      detailsHeader += `👤 Sócios/Representantes: ${newTicketData.representantes}\n`;
    }
    
    if (newTicketData.endereco || newTicketData.representantes) {
      fullDescription = `${detailsHeader}\n📝 DESCRIÇÃO DA SOLICITAÇÃO:\n${newTicketData.description}`;
    }

    const ticket: Ticket = {
      id: `tk-${Date.now()}`, 
      leadId: selectedLinkedLead ? selectedLinkedLead.id : `manual-${Date.now()}`, 
      razaoSocial: newTicketData.razaoSocial.toUpperCase(), 
      cnpj: newTicketData.cnpj, 
      requesterId: user.id, 
      requesterName: user.name, 
      login: newTicketData.login, 
      password: newTicketData.password, 
      description: fullDescription, 
      selectedLines: newTicketData.selectedLines, 
      status: TicketStatus.ABERTO, 
      createdAt: now.toISOString(), 
      deadlineAt: deadline.toISOString(), 
      attachments: newTicketData.attachments,
      notes: [{ 
        id: `note-init-${Date.now()}`, 
        userName: user.name, 
        content: `🚩 CHAMADO ABERTO:\n\n${fullDescription}`, 
        createdAt: now.toLocaleString('pt-BR'), 
        attachments: newTicketData.attachments.length > 0 ? newTicketData.attachments : undefined 
      }]
    };
    await onUpdateTicket(ticket);
    setCreatedTicketResult({ ticket, linkedLead: selectedLinkedLead });
  };

  const handleAddNote = async () => {
    if (!selectedTicket || (!newNote.trim() && noteAttachments.length === 0)) return;
    setIsSendingNote(true);
    const note: TicketNote = { id: `note-${Date.now()}`, userName: user.name, content: newNote, createdAt: new Date().toLocaleString('pt-BR'), attachments: noteAttachments.length > 0 ? noteAttachments : undefined };
    const updated = { ...selectedTicket, notes: [note, ...(selectedTicket.notes || [])] };
    await onUpdateTicket(updated);
    setSelectedTicket(updated);
    setNewNote('');
    setNoteAttachments([]);
    setIsSendingNote(false);
  };

  const handleFinalizeTicket = async () => {
    if (!selectedTicket || !finalResolutionNote.trim()) return;
    const resolutionNote: TicketNote = { id: `note-res-${Date.now()}`, userName: user.name, content: `✅ RESOLVIDO: ${finalResolutionNote}`, createdAt: new Date().toLocaleString('pt-BR') };
    const updated: Ticket = { ...selectedTicket, status: TicketStatus.FINALIZADO, notes: [resolutionNote, ...(selectedTicket.notes || [])] };
    await onUpdateTicket(updated);
    setSelectedTicket(null);
    setShowFinalizeForm(false);
  };

  const handleNewDeadline = async () => {
    if (!selectedTicket) return;
    const newDeadline = new Date(); newDeadline.setDate(newDeadline.getDate() + 5);
    const logNote: TicketNote = { id: `note-dl-${Date.now()}`, userName: user.name, content: `🕒 PRAZO ESTENDIDO: Novo prazo para ${newDeadline.toLocaleDateString('pt-BR')}`, createdAt: new Date().toLocaleString('pt-BR') };
    const updated = { ...selectedTicket, status: TicketStatus.REABERTO, deadlineAt: newDeadline.toISOString(), notes: [logNote, ...(selectedTicket.notes || [])] };
    await onUpdateTicket(updated);
    setSelectedTicket(updated);
  };

  const AttachmentList = ({ attachments, onRemove }: { attachments: Attachment[], onRemove?: (id: string) => void }) => {
    if (!attachments || attachments.length === 0) return null;
    return (
      <div className="flex flex-wrap gap-2 mt-3">
        {attachments.map((file) => {
          const isImg = file.type.startsWith('image/');
          return (
            <div key={file.id} className="relative group bg-white border border-slate-200 rounded-xl p-2 pr-8 shadow-sm max-w-[200px]">
              <div className="flex items-center space-x-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isImg ? 'bg-blue-50 text-blue-500' : 'bg-slate-50 text-slate-500'}`}><ImageIcon size={16} /></div>
                <div className="overflow-hidden"><p className="text-[9px] font-black text-slate-700 truncate uppercase leading-tight">{file.name}</p><p className="text-[7px] font-bold text-slate-400">{file.size}</p></div>
              </div>
              <div className="absolute right-1 top-1/2 -translate-y-1/2 flex flex-col space-y-1">
                {onRemove ? (<button onClick={() => onRemove(file.id)} className="p-1 text-slate-300 hover:text-red-500"><X size={12} /></button>) : (
                  <div className="flex flex-col space-y-1"><button onClick={(e) => { e.stopPropagation(); isImg ? setPreviewImage(file.url) : window.open(file.url); }} className="p-1 text-slate-300 hover:text-blue-500"><Eye size={12} /></button></div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const groupedTickets = useMemo(() => {
    const groups: Record<string, Ticket[]> = {};
    filteredTickets.forEach(t => {
      const date = new Date(t.createdAt).toLocaleDateString('pt-BR');
      if (!groups[date]) groups[date] = [];
      groups[date].push(t);
    });
    return Object.entries(groups).sort((a, b) => {
      const dateA = new Date(a[0].split('/').reverse().join('-'));
      const dateB = new Date(b[0].split('/').reverse().join('-'));
      return dateB.getTime() - dateA.getTime();
    });
  }, [filteredTickets]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-24 relative">
      {previewImage && (<div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/90 backdrop-blur-md p-4" onClick={() => setPreviewImage(null)}><button className="absolute top-10 right-10 p-4 bg-white/10 text-white rounded-full hover:bg-white/20"><X size={32} /></button><img src={previewImage} className="max-w-full max-h-full rounded-2xl shadow-2xl object-contain" /></div>)}

      <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
        <div>
          <button onClick={onBack} className="flex items-center space-x-2 text-white/40 hover:text-white transition-colors mb-4 group w-fit"><ArrowLeft size={16} /><span className="text-[10px] font-black uppercase tracking-widest">Voltar</span></button>
          <div className="flex items-center space-x-4"><div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center shadow-sm"><LifeBuoy size={24} /></div><div><h1 className="text-3xl font-black text-white tracking-tighter uppercase leading-none">Chamados Administrativos</h1><p className="text-white/60 text-sm font-medium mt-1">Gestão de pendências e correções operacionais.</p></div></div>
        </div>
        <div className="flex items-center space-x-3">
          <div className="bg-white/5 p-1.5 rounded-2xl flex border border-white/10 shadow-inner"><button onClick={() => { setActiveTab('ABERTO'); setSelectedTicket(null); }} className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'ABERTO' ? 'bg-white text-blue-600 shadow-md' : 'text-white/40'}`}>Em Aberto</button><button onClick={() => { setActiveTab('FINALIZADO'); setSelectedTicket(null); }} className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'FINALIZADO' ? 'bg-white text-emerald-600 shadow-md' : 'text-white/40'}`}>Finalizados</button></div>
          <button onClick={handleOpenModal} className="flex items-center space-x-2 px-8 py-4 bg-[#00A1E4] text-white rounded-2xl font-black text-[10px] uppercase hover:bg-[#003399] shadow-xl transition-all">
            <Plus size={18} /><span>Novo Chamado</span>
          </button>
        </div>
      </div>

      {/* Balão de Pesquisa */}
      <div className="bg-white/5 p-6 rounded-[2.5rem] border border-white/10 shadow-sm flex flex-col md:flex-row items-center gap-4">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-white/40" size={18} />
          <input 
            type="text" 
            placeholder="Pesquisar chamados por Razão Social, CNPJ, Solicitante, Login, Descrição ou Código..." 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
            className="w-full bg-white/5 border border-white/10 rounded-2xl pl-16 pr-6 py-4 text-xs font-bold text-white placeholder-white/30 outline-none focus:ring-4 focus:ring-[#00A1E4]/20 focus:border-[#00A1E4] transition-all shadow-inner" 
          />
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm('')} 
              className="absolute right-6 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="space-y-12">
        {groupedTickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-white/20">
            <LifeBuoy size={64} className="mb-4 opacity-20" />
            <p className="text-sm font-black uppercase tracking-widest">Nenhum chamado encontrado</p>
          </div>
        ) : (
          groupedTickets.map(([date, groupTickets]) => (
            <div key={date} className="space-y-6">
              <div className="flex items-center space-x-4">
                <div className="h-px flex-1 bg-white/10"></div>
                <h2 className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em] bg-[#000d26] px-4">{date}</h2>
                <div className="h-px flex-1 bg-white/10"></div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {groupTickets.map(ticket => {
                  const isOverdue = new Date(ticket.deadlineAt) < new Date() && ticket.status !== TicketStatus.FINALIZADO;
                  const currentCardLead = leads.find(l => {
                    const isClosed = l.isFromClosedTable || l.Status === LeadStatus.FECHADO;
                    if (!isClosed) return false;
                    return l.id === ticket.leadId || (l.CNPJ && ticket.cnpj && l.CNPJ.replace(/\D/g, '') === ticket.cnpj.replace(/\D/g, ''));
                  });

                  return (
                    <div key={ticket.id} onClick={() => { setSelectedTicket(ticket); setShowFinalizeForm(false); }} className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group relative overflow-hidden flex flex-col justify-between min-h-[340px]">
                       <div>
                          <div className={`absolute top-0 left-0 right-0 h-1.5 ${isOverdue ? 'bg-red-500 animate-pulse' : ticket.status === TicketStatus.FINALIZADO ? 'bg-emerald-500' : 'bg-blue-500'}`}></div>
                          <div className="flex justify-between items-start mb-6">
                             <div className="flex flex-col">
                               <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Empresa</span>
                               <h3 className="text-sm font-black text-slate-800 uppercase line-clamp-1">{ticket.razaoSocial}</h3>
                               <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">{(ticket.cnpj || '').replace(/\D/g, '')}</span>
                             </div>
                             <div className="flex items-center space-x-1">
                               {((ticket.status !== TicketStatus.FINALIZADO && user.role === UserRole.OWNER) || (ticket.status === TicketStatus.FINALIZADO && isPrivileged)) && (<button onClick={(e) => handleDelete(e, ticket.id)} className="p-2 text-slate-200 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>)}
                               <div className={`p-2 rounded-lg ${isOverdue ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>{isOverdue ? <AlertTriangle size={18} /> : <LifeBuoy size={18} />}</div>
                             </div>
                          </div>
                          <p className="text-[10px] font-bold text-slate-500 line-clamp-2 mb-6 italic">"{parseTicketDescription(ticket.description).cleanDescription}"</p>
                          <div className="space-y-4">
                             <div className="flex items-center justify-between text-[11px] font-bold"><span className="text-slate-400 uppercase">Solicitante</span><span className="text-slate-700 uppercase">{ticket.requesterName}</span></div>
                             <div className="flex items-center justify-between text-[11px] font-bold"><span className="text-slate-400 uppercase">Status</span><span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${ticket.status === TicketStatus.FINALIZADO ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>{ticket.status}</span></div>
                          </div>
                       </div>
                       
                       <div className="mt-6 pt-4 border-t border-slate-50 space-y-4">
                          {currentCardLead && (
                             <button
                               onClick={(e) => {
                                 e.stopPropagation();
                                 handleRedirectToClosedLead(currentCardLead);
                               }}
                               className="w-full flex items-center justify-center space-x-2 bg-[#00A1E4] hover:bg-blue-600 text-white py-3 px-4 rounded-xl text-[9px] font-black uppercase transition-all shadow-sm"
                             >
                               <ExternalLink size={12} />
                               <span>Ir Direto Para o Pedido</span>
                             </button>
                          )}
                          <div className="flex items-center justify-between">
                             <div className="flex items-center space-x-2"><MessageSquare size={14} className="text-slate-300" /><span className="text-[10px] font-black text-slate-400 uppercase">{(ticket.notes || []).length} Notas</span></div>
                             <div className="flex items-center space-x-1 text-blue-600 group-hover:translate-x-1 transition-transform"><span className="text-[10px] font-black uppercase">Detalhes</span><ChevronRight size={14} /></div>
                          </div>
                       </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {isCreating && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95">
            {createdTicketResult ? (
              <div className="p-10 text-center space-y-6 flex flex-col items-center justify-center min-h-[500px]">
                <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center shadow-lg border border-emerald-100 animate-bounce">
                  <CheckCircle2 size={44} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-black uppercase text-slate-800 tracking-tight">Chamado Aberto com Sucesso!</h3>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Código do chamado: {createdTicketResult.ticket.id}</p>
                </div>
                
                <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 w-full max-w-md text-left space-y-3">
                  <div className="flex justify-between text-[11px] font-bold">
                    <span className="text-slate-400 uppercase">Empresa:</span>
                    <span className="text-slate-800 uppercase text-right font-black">{createdTicketResult.ticket.razaoSocial}</span>
                  </div>
                  <div className="flex justify-between text-[11px] font-bold">
                    <span className="text-slate-400 uppercase">CNPJ:</span>
                    <span className="text-slate-800 uppercase font-black">{createdTicketResult.ticket.cnpj}</span>
                  </div>
                </div>

                {createdTicketResult.linkedLead ? (
                  <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-[2rem] w-full max-w-md space-y-4">
                    <div className="flex items-center space-x-3 text-left">
                      <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                        <Building2 size={20} />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-emerald-800 uppercase leading-none">Cliente Cadastrado</p>
                        <p className="text-xs font-bold text-slate-700 normal-case mt-1">Este cliente já possui cadastro na base de Clientes Fechados.</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRedirectToClosedLead(createdTicketResult.linkedLead!)}
                      className="w-full flex items-center justify-center space-x-2 bg-[#00A1E4] hover:bg-blue-600 text-white py-4 px-6 rounded-2xl font-black text-xs uppercase transition-all shadow-md"
                    >
                      <ExternalLink size={16} />
                      <span>Ir Direto Para o Pedido</span>
                    </button>
                  </div>
                ) : (
                  <div className="bg-slate-50 border border-slate-200/60 p-6 rounded-[2rem] w-full max-w-md">
                    <p className="text-xs font-bold text-slate-500 normal-case">Este CNPJ não possui cadastro anterior no banco de Clientes Fechados.</p>
                  </div>
                )}

                <div className="flex space-x-4 w-full max-w-md pt-4">
                  <button 
                    onClick={handleCloseModal} 
                    className="flex-1 py-4 bg-[#050a18] hover:bg-black text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all"
                  >
                    Voltar aos Chamados
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="p-10 border-b border-slate-100 flex items-center justify-between bg-[#050a18] text-white">
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center"><Plus size={20} /></div>
                    <h2 className="text-xl font-black uppercase tracking-tighter">Novo Chamado Manual</h2>
                  </div>
                  <button onClick={handleCloseModal} className="p-2.5 bg-white/10 rounded-xl hover:bg-white/20"><X size={20} /></button>
                </div>
                
                <div className="p-10 space-y-6 overflow-y-auto max-h-[70vh] custom-scrollbar bg-white">
                  {/* CNPJ - Digitado Primeiro */}
                  <div className="space-y-2 bg-slate-50 p-6 rounded-[2rem] border border-slate-100 animate-in fade-in duration-300">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-black text-[#050a18] uppercase tracking-widest ml-1 flex items-center space-x-2">
                        <Building size={14} className="text-blue-500" />
                        <span>CNPJ do Cliente</span>
                      </label>
                      {isFetchingCnpj && (
                        <div className="flex items-center space-x-2 text-[10px] font-black uppercase text-blue-600 animate-pulse">
                          <Loader2 size={12} className="animate-spin" />
                          <span>Buscando Brasil API...</span>
                        </div>
                      )}
                    </div>
                    <div className="relative flex items-center">
                      <input 
                        id="cnpj-input"
                        type="text" 
                        value={newTicketData.cnpj} 
                        onChange={(e) => handleCnpjChange(e.target.value)} 
                        placeholder="00000000000000" 
                        className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 pr-24 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-blue-50 transition-all shadow-sm" 
                      />
                      <button 
                        type="button"
                        disabled={isFetchingCnpj || newTicketData.cnpj.replace(/\D/g, '').length !== 14}
                        onClick={() => fetchCnpjData(newTicketData.cnpj)} 
                        className="absolute right-4 p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-all font-black text-[9px] uppercase flex items-center space-x-1 disabled:opacity-40"
                      >
                        <Search size={12} />
                        <span>Buscar</span>
                      </button>
                    </div>
                    {selectedLinkedLead && (
                      <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-emerald-50 text-emerald-850 px-5 py-3.5 rounded-xl border border-emerald-100 uppercase animate-in fade-in duration-300">
                        <div className="flex items-center space-x-2.5">
                          <div className="p-1 px-2 bg-emerald-100 text-emerald-800 rounded-lg text-[9px] font-black">CADASTRADO</div>
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black text-emerald-700">Cliente localizado no banco de dados</span>
                            <span className="text-[11px] font-bold text-slate-700 normal-case mt-0.5">{selectedLinkedLead.razaoSocial}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRedirectToClosedLead(selectedLinkedLead)}
                          className="flex items-center justify-center space-x-1.5 bg-[#00A1E4] hover:bg-blue-600 text-white rounded-lg px-3 py-1.5 text-[9px] font-black uppercase tracking-wider transition-all shadow-sm shrink-0 self-start sm:self-center"
                        >
                          <ExternalLink size={12} />
                          <span>Ir Para Pedido</span>
                        </button>
                      </div>
                    )}
                    {newTicketData.cnpj.replace(/\D/g, '').length === 14 && !isFetchingCnpj && !selectedLinkedLead && (
                      <div className="mt-3 bg-slate-200 text-slate-700 px-5 py-3.5 rounded-xl border border-slate-300 uppercase animate-in fade-in duration-300 animate-in">
                        <div className="flex items-center space-x-2.5">
                          <div className="p-1 px-2 bg-slate-300 text-slate-850 rounded-lg text-[9px] font-black">NÃO CADASTRADO</div>
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black text-slate-500">Cliente NÃO localizado no banco de dados</span>
                            <span className="text-[11px] font-bold text-slate-700 normal-case mt-0.5">Informe os dados cadastrais manualmente ou busque externamente via Brasil API.</span>
                          </div>
                        </div>
                      </div>
                    )}
                    {cnpjError && (
                      <p className="text-[10px] font-bold text-red-500 ml-1">{cnpjError}</p>
                    )}
                  </div>

              {/* Dados Cadastrais Puxados */}
              <div className="space-y-6">
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Razão Social da Empresa</label>
                    {selectedLinkedLead && (
                      <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 border border-emerald-100 px-2.5 py-0.5 rounded-md uppercase">Cliente já possui cadastro</span>
                    )}
                  </div>
                  <div className="relative flex items-center">
                    <input 
                      type="text" 
                      value={newTicketData.razaoSocial} 
                      onChange={(e) => setNewTicketData({...newTicketData, razaoSocial: e.target.value.toUpperCase()})} 
                      placeholder="NOME EMPRESARIAL" 
                      className={`w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-bold text-slate-700 outline-none focus:bg-white focus:ring-4 focus:ring-blue-50 transition-all shadow-inner ${selectedLinkedLead ? 'pr-36' : ''}`} 
                    />
                    {selectedLinkedLead && (
                      <button
                        type="button"
                        onClick={() => handleRedirectToClosedLead(selectedLinkedLead)}
                        className="absolute right-4 px-3 py-2 bg-[#00A1E4] hover:bg-blue-600 text-white rounded-xl transition-all font-black text-[9px] uppercase flex items-center space-x-1 shadow"
                        title="Ir direto para o pedido em Clientes Fechados"
                      >
                        <ExternalLink size={12} />
                        <span>Ir p/ Pedido</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Endereço (Puxado do CNPJ)</label>
                    <textarea 
                      rows={2}
                      value={newTicketData.endereco} 
                      onChange={(e) => setNewTicketData({...newTicketData, endereco: e.target.value})} 
                      placeholder="Rua, Número, Bairro, Município - UF" 
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-xs font-bold text-slate-700 outline-none focus:bg-white focus:ring-4 focus:ring-blue-50 transition-all shadow-inner resize-none animate-in fade-in" 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Sócios / Representantes (Puxado do CNPJ)</label>
                    <textarea 
                      rows={2}
                      value={newTicketData.representantes} 
                      onChange={(e) => setNewTicketData({...newTicketData, representantes: e.target.value})} 
                      placeholder="Nome dos representantes de QSA" 
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-xs font-bold text-slate-700 outline-none focus:bg-white focus:ring-4 focus:ring-blue-50 transition-all shadow-inner resize-none animate-in fade-in" 
                    />
                  </div>
                </div>
              </div>

              {/* Novos campos: Login e Senha */}
              <div className="grid grid-cols-2 gap-6 bg-blue-50/30 p-6 rounded-[2rem] border border-blue-100/50">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest ml-1 flex items-center space-x-2">
                    <User size={12} /> <span>Login de Acesso</span>
                  </label>
                  <input 
                    type="text" 
                    value={newTicketData.login} 
                    onChange={(e) => setNewTicketData({...newTicketData, login: e.target.value})} 
                    placeholder="USUÁRIO/LOGIN" 
                    className="w-full bg-white border border-blue-100 rounded-2xl px-6 py-4 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-blue-200/20 transition-all shadow-sm" 
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest ml-1 flex items-center space-x-2">
                    <Lock size={12} /> <span>Senha de Acesso</span>
                  </label>
                  <input 
                    type="text" 
                    value={newTicketData.password} 
                    onChange={(e) => setNewTicketData({...newTicketData, password: e.target.value})} 
                    placeholder="SENHA EM TEXTO" 
                    className="w-full bg-white border border-blue-100 rounded-2xl px-6 py-4 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-blue-200/20 transition-all shadow-sm" 
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center space-x-2">
                  <FileText size={14} className="text-blue-500" />
                  <span>Descrição da Solicitação / Problema</span>
                </label>
                <textarea 
                  value={newTicketData.description} 
                  onChange={(e) => setNewTicketData({...newTicketData, description: e.target.value})} 
                  placeholder="Descreva detalhadamente a falha ou a correção solicitada..." 
                  className="w-full bg-slate-50 border border-slate-200 rounded-[2.5rem] px-8 py-6 text-sm font-bold text-slate-700 outline-none resize-none h-40 shadow-inner focus:bg-white transition-all" 
                />
              </div>

              <div className="flex items-center justify-between bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-400 shadow-sm"><Paperclip size={20} /></div>
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest leading-tight">Anexe evidências,<br/>prints ou documentos</p>
                </div>
                <button 
                  onClick={() => creationFileRef.current?.click()} 
                  className="bg-white border border-slate-200 px-6 py-3 rounded-xl text-[10px] font-black uppercase text-slate-600 hover:bg-slate-100 transition-all"
                >
                  <input type="file" ref={creationFileRef} onChange={(e) => handleFileUpload(e, 'creation')} className="hidden" multiple />
                  Escolher Arquivos
                </button>
              </div>

              {newTicketData.attachments.length > 0 && (
                <div className="animate-in fade-in zoom-in-95">
                  <AttachmentList 
                    attachments={newTicketData.attachments} 
                    onRemove={(id) => setNewTicketData(prev => ({...prev, attachments: prev.attachments.filter(a => a.id !== id)}))} 
                  />
                </div>
              )}
            </div>
            
            <div className="p-10 border-t border-slate-100 bg-slate-50/50 flex justify-end space-x-4">
              <button type="button" onClick={handleCloseModal} className="px-8 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Cancelar</button>
              <button 
                type="button"
                disabled={!newTicketData.razaoSocial.trim() || !newTicketData.description.trim()} 
                onClick={handleCreateTicket} 
                className="bg-[#050a18] text-white px-12 py-4 rounded-2xl font-black text-[10px] uppercase shadow-xl hover:bg-black transition-all disabled:opacity-30 flex items-center space-x-2"
              >
                <Send size={16} />
                <span>Abrir Chamado Agora</span>
              </button>
            </div>
              </>
            )}
          </div>
        </div>
      )}

      {selectedTicket && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-[1100px] h-full max-h-[92vh] rounded-[3rem] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95">
              <div className="p-10 border-b border-slate-100 flex items-center justify-between bg-[#0f172a] text-white shrink-0">
                 <div className="flex items-center space-x-6">
                    <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg"><LifeBuoy size={28} /></div>
                    <div>
                       <div className="flex items-center space-x-3 flex-wrap gap-2">
                          <h2 className="text-xl font-black uppercase tracking-tighter text-white">{selectedTicket.razaoSocial}</h2>
                          {activeLinkedLead && (
                             <button 
                                onClick={() => handleRedirectToClosedLead(activeLinkedLead)}
                                className="bg-[#00A1E4] hover:bg-blue-600 text-white rounded-xl px-3 py-1.5 text-[9px] font-black uppercase tracking-wider transition-all h-7 flex items-center space-x-1 shadow-md hover:scale-105"
                                title="Ir direto para o pedido em Clientes Fechados"
                             >
                                <ExternalLink size={11} />
                                <span>Ir direto para pedido</span>
                             </button>
                          )}
                          {onOpenWhatsApp && (
                             <button 
                                onClick={() => {
                                  const targetPhone = activeLinkedLead?.Telefone_Principal || activeLinkedLead?.CELULAR || activeLinkedLead?.CELULAR_02;
                                  onOpenWhatsApp({
                                    phone: targetPhone,
                                    cnpj: selectedTicket.cnpj || activeLinkedLead?.CNPJ,
                                    leadName: selectedTicket.razaoSocial || activeLinkedLead?.razaoSocial,
                                    leadId: selectedTicket.leadId || activeLinkedLead?.id
                                  });
                                  setSelectedTicket(null);
                                }}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl px-3 py-1.5 text-[9px] font-black uppercase tracking-wider transition-all h-7 flex items-center space-x-1 shadow-md hover:scale-105"
                                title="Abrir no WhatsApp CRM"
                             >
                                <MessageSquare size={11} />
                                <span>Abrir no WhatsApp</span>
                             </button>
                          )}
                       </div>
                       <div className="flex items-center space-x-3 mt-1">
                          <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${selectedTicket.status === TicketStatus.FINALIZADO ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'}`}>{selectedTicket.status}</span>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{(selectedTicket.cnpj || '').replace(/\D/g, '')}</span>
                          <span className="text-slate-600">•</span>
                          <span className="text-[9px] font-black text-slate-400 uppercase">Aberto em {new Date(selectedTicket.createdAt).toLocaleString('pt-BR')}</span>
                       </div>
                    </div>
                 </div>
                 <button onClick={() => setSelectedTicket(null)} className="p-3 bg-white/10 rounded-2xl hover:bg-white/20 transition-all"><X size={24} /></button>
              </div>

              <div className="flex-1 flex overflow-hidden">
                 <div className="w-1/2 p-10 overflow-y-auto custom-scrollbar space-y-10 border-r border-slate-100 bg-white">
                    <div className="space-y-6">
                       <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2 flex items-center space-x-2"><UserCheck size={14} className="text-blue-500" /><span>Responsabilidades</span></h4>
                       <div className="grid grid-cols-2 gap-4">
                          <div className="bg-slate-50 p-6 rounded-2xl"><p className="text-[8px] font-black text-slate-400 uppercase mb-2 tracking-widest">Solicitante</p><p className="text-xs font-black text-slate-700 uppercase">{selectedTicket.requesterName}</p></div>
                          <div className="bg-slate-50 p-6 rounded-2xl"><p className="text-[8px] font-black text-slate-400 uppercase mb-2 tracking-widest">Prazo Final</p><p className={`text-xs font-black ${new Date(selectedTicket.deadlineAt) < new Date() ? 'text-red-600' : 'text-slate-700'}`}>{new Date(selectedTicket.deadlineAt).toLocaleDateString('pt-BR')}</p></div>
                       </div>
                    </div>

                    {/* Vínculo de Clientes Fechados */}
                     {activeLinkedLead && (
                        <div className="bg-gradient-to-br from-blue-500/10 to-indigo-500/10 p-6 rounded-[2rem] border border-blue-500/20 space-y-4 animate-in fade-in zoom-in-95">
                           <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                 <div className="w-10 h-10 bg-blue-500 text-white rounded-xl flex items-center justify-center shadow-md">
                                    <Handshake size={20} />
                                 </div>
                                 <div>
                                    <p className="text-[8px] font-black text-blue-500 uppercase tracking-widest leading-none">Vínculo de Cliente</p>
                                    <h5 className="text-xs font-black text-slate-800 uppercase mt-1 leading-none">Conta de Cliente Ativa</h5>
                                 </div>
                              </div>
                              <span className="px-2.5 py-0.5 rounded-full text-[8px] font-black bg-blue-500/20 text-blue-600 uppercase">Clientes Fechados</span>
                           </div>
                           
                           <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-1">
                              <div className="space-y-1">
                                 <p className="text-[10px] font-bold text-slate-400 uppercase">Empresa Vinculada</p>
                                 <p className="text-xs font-black text-slate-700 uppercase leading-none">{activeLinkedLead.razaoSocial}</p>
                                 <p className="text-[9px] font-black text-slate-400">{(activeLinkedLead.CNPJ || '').replace(/\D/g, '')}</p>
                              </div>
                              <button 
                                 onClick={() => handleRedirectToClosedLead(activeLinkedLead)}
                                 className="flex items-center justify-center space-x-2 bg-[#00A1E4] text-white px-6 py-3.5 rounded-2xl font-black text-[10px] uppercase shadow-md hover:bg-blue-600 transition-all group shrink-0"
                              >
                                 <ExternalLink size={14} className="group-hover:scale-110 transition-transform" />
                                 <span>Ir Direto para o Pedido</span>
                              </button>
                           </div>
                        </div>
                     )}

                     {/* Exibição de Login/Senha se existirem */}
                    {(selectedTicket.login || selectedTicket.password) && (
                      <div className="space-y-6">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2 flex items-center space-x-2"><Lock size={14} className="text-blue-500" /><span>Dados de Acesso Informados</span></h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-blue-50 p-6 rounded-2xl">
                             <p className="text-[8px] font-black text-blue-400 uppercase mb-2 tracking-widest">Login</p>
                             <p className="text-xs font-black text-slate-700 uppercase">{selectedTicket.login || '---'}</p>
                          </div>
                          <div className="bg-blue-50 p-6 rounded-2xl">
                             <p className="text-[8px] font-black text-blue-400 uppercase mb-2 tracking-widest">Senha</p>
                             <p className="text-xs font-black text-slate-700">{selectedTicket.password || '---'}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="space-y-6">
                      {(() => {
                        const parsed = parseTicketDescription(selectedTicket.description);
                        if (!parsed.endereco && !parsed.representantes) return null;
                        return (
                          <div className="space-y-6">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2 flex items-center space-x-2">
                              <Building2 size={14} className="text-blue-500" />
                              <span>Dados Cadastrais (Brasil API)</span>
                            </h4>
                            <div className="space-y-4">
                              {parsed.endereco && (
                                <div className="bg-slate-50 p-6 rounded-2xl">
                                   <p className="text-[8px] font-black text-slate-400 uppercase mb-2 tracking-widest">Endereço Registrado</p>
                                   <p className="text-xs font-bold text-slate-700 uppercase leading-relaxed">{parsed.endereco}</p>
                                </div>
                              )}
                              {parsed.representantes && (
                                <div className="bg-slate-50 p-6 rounded-2xl">
                                   <p className="text-[8px] font-black text-slate-400 uppercase mb-2 tracking-widest">Sócios / Representantes (QSA)</p>
                                   <p className="text-xs font-bold text-slate-700 uppercase leading-relaxed">{parsed.representantes}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })()}

                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2 flex items-center space-x-2"><Paperclip size={14} className="text-emerald-500" /><span>Anexos Iniciais</span></h4>
                       <AttachmentList attachments={selectedTicket.attachments || []} />
                    </div>

                    <div className="space-y-6 pt-6">
                       <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Ações Administrativas</h4>
                       {isPrivileged && selectedTicket.status !== TicketStatus.FINALIZADO ? (
                         <div className="space-y-4">
                            {!showFinalizeForm ? (
                              <div className={`grid grid-cols-1 ${user.role === UserRole.OWNER ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} gap-4`}>
                                <button onClick={() => setShowFinalizeForm(true)} className="flex items-center justify-center space-x-2 bg-emerald-600 text-white py-4 rounded-2xl font-black text-[9px] uppercase shadow-lg hover:bg-emerald-700 transition-all"><CheckCircle2 size={16} /><span>Finalizar</span></button>
                                <button onClick={handleNewDeadline} className="flex items-center justify-center space-x-2 bg-blue-600 text-white py-4 rounded-2xl font-black text-[9px] uppercase shadow-lg hover:bg-blue-700 transition-all"><History size={16} /><span>Novo Prazo</span></button>
                                {user.role === UserRole.OWNER && (
                                  <button onClick={(e) => handleDelete(e, selectedTicket.id)} className="flex items-center justify-center space-x-2 bg-red-600 text-white py-4 rounded-2xl font-black text-[9px] uppercase shadow-lg hover:bg-red-700 transition-all"><Trash2 size={16} /><span>Excluir</span></button>
                                )}
                              </div>
                            ) : (
                              <div className="bg-emerald-50 p-8 rounded-[2rem] border border-emerald-100 space-y-4 animate-in slide-in-from-bottom-2">
                                 <textarea autoFocus value={finalResolutionNote} onChange={(e) => setFinalResolutionNote(e.target.value)} placeholder="O que foi feito para resolver?" className="w-full bg-white border border-emerald-200 rounded-2xl px-5 py-4 text-xs font-bold text-slate-700 outline-none resize-none h-24" />
                                 <div className="flex space-x-2"><button onClick={() => setShowFinalizeForm(false)} className="flex-1 py-3 text-[10px] font-black uppercase text-slate-400">Cancelar</button><button disabled={!finalResolutionNote.trim()} onClick={handleFinalizeTicket} className="flex-[2] bg-emerald-600 text-white py-3 rounded-xl font-black text-[10px] uppercase flex items-center justify-center space-x-2"><ShieldCheck size={14} /><span>Confirmar</span></button></div>
                              </div>
                            )}
                         </div>
                       ) : isPrivileged ? (
                          <button onClick={(e) => handleDelete(e, selectedTicket.id)} className="w-full flex items-center justify-center space-x-2 bg-red-600 text-white py-4 rounded-2xl font-black text-[9px] uppercase shadow-lg"><Trash2 size={16} /><span>Excluir Chamado Permanentemente</span></button>
                       ) : null}
                    </div>
                 </div>

                 <div className="w-1/2 flex flex-col bg-slate-50/50">
                    <div className="p-10 border-b border-slate-100 bg-white flex items-center justify-between shrink-0 shadow-sm">
                        <div className="flex items-center space-x-3">
                           <div className="w-8 h-8 bg-blue-50 text-blue-500 rounded-lg flex items-center justify-center"><MessageSquare size={16} /></div>
                           <h3 id="chat-timeline-header-title" className="text-sm font-black uppercase text-slate-800 tracking-widest italic leading-none">Linha do Tempo</h3>
                        </div>
                        <div className="flex items-center space-x-3">
                           {activeLinkedLead && (
                              <button 
                                 type="button"
                                 onClick={() => handleRedirectToClosedLead(activeLinkedLead)}
                                 className="bg-[#00A1E4] hover:bg-blue-600 text-white rounded-xl px-3 py-1.5 text-[9px] font-black uppercase tracking-wider transition-all h-7 flex items-center space-x-1 shadow-sm hover:scale-105"
                                 title="Ir direto para o pedido em Clientes Fechados"
                              >
                                 <ExternalLink size={11} />
                                 <span>Ir direto para pedido</span>
                              </button>
                           )}
                           <span className="text-[9px] font-black text-slate-400 uppercase">{(selectedTicket.notes || []).length} Mensagens</span>
                        </div></div>
                    <div className="flex-1 overflow-y-auto p-10 space-y-6 custom-scrollbar">
                       {(selectedTicket.notes || []).map(note => (
                          <div key={note.id} className={`flex flex-col ${note.userName === user.name ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-2`}>
                             <div className={`max-w-[92%] p-6 rounded-[2rem] shadow-sm border ${note.userName === user.name ? 'bg-blue-600 text-white border-blue-500 rounded-tr-none' : 'bg-white text-slate-700 border-slate-200 rounded-tl-none'}`}><p className="text-xs font-bold leading-relaxed whitespace-pre-wrap">{note.content}</p><AttachmentList attachments={note.attachments || []} /></div>
                             <div className="mt-2 px-1 flex items-center space-x-2 text-[8px] font-black uppercase"><span className={note.userName === user.name ? 'text-blue-500' : 'text-slate-400'}>{note.userName}</span><span className="text-slate-300">•</span><span className="text-slate-400">{note.createdAt}</span></div>
                          </div>
                       ))}
                    </div>
                    {selectedTicket.status !== TicketStatus.FINALIZADO && (
                      <div className="p-10 bg-white border-t border-slate-100 shrink-0"><div className="space-y-4"><AttachmentList attachments={noteAttachments} onRemove={(id) => setNoteAttachments(prev => prev.filter(a=>a.id!==id))} /><div className="relative"><textarea value={newNote} onChange={(e) => setNewNote(e.target.value)} disabled={isSendingNote} placeholder="Escreva sua atualização aqui..." className="w-full bg-slate-50 border border-slate-200 rounded-[2.5rem] px-8 py-6 pr-32 text-sm font-bold text-slate-700 focus:bg-white focus:border-blue-300 transition-all outline-none resize-none h-28 shadow-inner" /><div className="absolute bottom-6 right-6 flex items-center space-x-3"><button onClick={() => noteFileRef.current?.click()} className="p-3 bg-white border border-slate-200 text-slate-400 rounded-2xl hover:text-blue-600 transition-all shadow-sm"><input type="file" ref={noteFileRef} onChange={(e) => handleFileUpload(e, 'note')} className="hidden" multiple /><Paperclip size={20} /></button><button disabled={(!newNote.trim() && noteAttachments.length === 0) || isSendingNote} onClick={handleAddNote} className="bg-[#050a18] text-white p-3.5 rounded-2xl hover:bg-black shadow-xl transition-all flex items-center justify-center min-w-[50px]">{isSendingNote ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}</button></div></div></div></div>
                    )}
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default TicketsManagement;
