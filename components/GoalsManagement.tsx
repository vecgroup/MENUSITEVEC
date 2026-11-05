
import React, { useState } from 'react';
import { 
  ArrowLeft, 
  Plus, 
  Target, 
  Calendar, 
  Users, 
  Trash2, 
  TrendingUp, 
  ChevronDown,
  CircleDot,
  CheckCircle2,
  Trophy,
  Loader2,
  AlertCircle,
  Pencil,
  RefreshCw,
  FileText,
  Download
} from 'lucide-react';
import { User, Goal, GoalTargetType } from '../types';
import { supabase } from '../lib/supabase';
import GoalReportModal from './GoalReportModal';

interface GoalsManagementProps {
  user: User;
  allUsers: User[];
  onBack: () => void;
  onAddGoal: (goal: Goal) => Promise<void>;
  goals: Goal[];
  onDeleteGoal: (id: string) => Promise<void>;
  onSetGoalProgress: (id: string, total: number) => Promise<void>;
  onRefreshGoals?: () => Promise<void>;
  onCelebrate?: (goal: Goal) => void;
  systemLogo?: string | null;
}

const GoalsManagement: React.FC<GoalsManagementProps> = ({ 
  user, 
  allUsers,
  onBack, 
  onAddGoal, 
  goals, 
  onDeleteGoal,
  onUpdateGoalProgress,
  onSetGoalProgress,
  onRefreshGoals,
  onCelebrate,
  systemLogo
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [selectedReportMonth, setSelectedReportMonth] = useState<string | null>(null);
  const [goalDetails, setGoalDetails] = useState<Record<string, any[]>>({});
  const [viewingDetailsGoalId, setViewingDetailsGoalId] = useState<string | null>(null);

  const normalizeString = (str: string) => {
    return str
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[-_]/g, ' ') // Tratar hífens e underscores como espaços
      .replace(/[^a-z0-9\s]/g, "")
      .trim()
      .replace(/\s+/g, ' ');
  };

  const getLocalDateString = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [formData, setFormData] = useState<Partial<Goal>>({
    title: '',
    startDate: getLocalDateString(new Date()),
    endDate: '',
    targetType: GoalTargetType.QUANTIDADE,
    objective: 0,
    assignedTo: 'Toda a Equipe'
  });

  const handleCreate = async () => {
    if (!formData.title?.trim()) {
      alert("Por favor, insira um título para a meta.");
      return;
    }

    const objValue = Number(formData.objective);
    if (isNaN(objValue) || objValue <= 0) {
      alert("O objetivo da meta deve ser um valor maior que zero.");
      return;
    }

    try {
      setIsCreating(true);

      const newGoal: Goal = {
        id: editingGoalId || `goal-${Date.now()}`,
        title: formData.title.trim(),
        startDate: formData.startDate || getLocalDateString(new Date()),
        endDate: formData.endDate || '',
        targetType: formData.targetType as GoalTargetType,
        objective: objValue,
        assignedTo: formData.assignedTo || 'Toda a Equipe',
        currentProgress: editingGoalId ? (goals.find(g => g.id === editingGoalId)?.currentProgress || 0) : 0,
        isCompleted: false
      };

      await onAddGoal(newGoal);

      setFormData({
        title: '',
        startDate: getLocalDateString(new Date()),
        endDate: '',
        targetType: GoalTargetType.QUANTIDADE,
        objective: 0,
        assignedTo: 'Toda a Equipe'
      });
      setEditingGoalId(null);
      
    } catch (error) {
      console.error("Erro ao criar meta:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const parseToLocalDate = (dateStr: any) => {
    if (!dateStr) return null;
    if (dateStr instanceof Date) {
      const d = new Date(dateStr);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    
    let d: Date;
    if (typeof dateStr === 'string') {
      if (dateStr.includes('/')) {
        const [day, month, year] = dateStr.split('/').map(Number);
        d = new Date(year, month - 1, day);
      } else if (dateStr.includes('-')) {
        const parts = dateStr.split('T')[0].split('-').map(Number);
        if (parts.length === 3) {
          d = new Date(parts[0], parts[1] - 1, parts[2]);
        } else {
          d = new Date(dateStr);
        }
      } else {
        d = new Date(dateStr);
      }
    } else {
      d = new Date(dateStr);
    }
    
    if (isNaN(d.getTime())) return null;
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const handleSyncExternal = async (silent = false) => {
    try {
      setIsSyncing(true);
      
      const [
        { data: externalClosed, error: externalClosedError },
        { data: externalLeads, error: externalLeadsError },
        { data: internalLeads, error: internalError },
        { data: closedLeads, error: closedError }
      ] = await Promise.all([
        supabase.externalCrm.getClosedLeads(),
        supabase.externalCrm.getAllLeads(),
        supabase.leads.getAll(500),
        supabase.clientes_fechados.getAll(500)
      ]);
      
      if (externalClosedError && !silent) console.error("Erro ao buscar dados externos fechados:", externalClosedError);
      if (externalLeadsError && !silent) console.error("Erro ao buscar dados externos leads:", externalLeadsError);

      const uniqueLeadsMap = new Map();
      
      const processLeads = (leads: any[]) => {
        leads?.forEach((l) => {
          const cnpj = l.cnpj || l.CNPJ || l.Cnpj || '';
          
          // Extrair vendedor de forma robusta para a chave de de-duplicação
          let vName = '';
          let rawV = l.vendedor || l.Vendedor || l.VENDEDOR || 
                       l.vendedor_nome || l.vendedorNome || l.VENDEDOR_NOME || 
                       l.usuario || l.Usuario || l.USUARIO || 
                       l.consultor || l.Consultor || l.CONSULTOR || '';
          
          // Tentar parsear se for string JSON (comum em exportações)
          if (typeof rawV === 'string' && (rawV.startsWith('{') || rawV.startsWith('['))) {
            try {
              const parsed = JSON.parse(rawV);
              rawV = parsed;
            } catch (e) {}
          }

          if (typeof rawV === 'object' && rawV !== null) {
            vName = rawV.name || rawV.nome || rawV.userName || rawV.user_name || rawV.full_name || rawV.displayName || 'OBJ';
          } else if (typeof rawV === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawV)) {
            const foundUser = allUsers.find(u => u.id === rawV);
            vName = foundUser ? foundUser.name : rawV;
          } else {
            vName = String(rawV);
          }

          const data = l.data_fechamento || l.dataFechamento || l.DATA_FECHAMENTO || 
                       l.data || l.Data || l.DATA || 
                       l.data_consulta || l.dataConsulta || l.DATA_CONSULTA || 
                       l.created_at || l.CREATED_AT || '';
                       
          const id = l.id || l.ID || l._id || '';
          const ativos = l.ativos || l.ATIVOS || l.Ativos || l.linhas || l.LINHAS || l.Linhas || '0';
          
          // Chave de de-duplicação: se tem ID, usa ID. 
          // Se não, usa CNPJ + Vendedor + Data + Quantidade para ser único mas permitir de-duplicação entre tabelas
          const key = id ? `id-${id}` : `${cnpj}-${vName}-${data}-${ativos}`;
          
          // Prioridade: Se já existe, não sobrescreve (quem vem primeiro tem prioridade)
          if (!uniqueLeadsMap.has(key)) {
            uniqueLeadsMap.set(key, l);
          }
        });
      };

      // ORDEM DE PRIORIDADE: Dados internos (que o usuário edita) vêm primeiro
      processLeads(closedLeads || []);
      processLeads(internalLeads || []);
      processLeads(externalClosed || []);
      processLeads(externalLeads || []);

      const allSourceLeads = Array.from(uniqueLeadsMap.values());

      if (allSourceLeads.length === 0) {
        if (!silent) alert("Nenhum dado encontrado para sincronização.");
        return;
      }

      const newGoalDetails: Record<string, any[]> = {};

      for (const goal of goals) {
        let newProgress = 0;
        const contributingLeads: any[] = [];
        
        const start = parseToLocalDate(goal.startDate);
        const end = goal.endDate ? parseToLocalDate(goal.endDate) : new Date(2099, 11, 31);
        if (end) end.setHours(23, 59, 59, 999);

        // Status que indicam venda concluída ou ativa
        const allowedStatuses = [
          'Fechado', 
          'Coleta de Assinatura', 
          'Confirmacão Telefônica', 
          'Em Análise', 
          'Validando', 
          'Validando Portabilidade', 
          'Finalizado',
          'Ativo',
          'Ativos',
          'Ativa',
          'R- Fechado',
          'Venda',
          'Concluído',
          'Vendido',
          'Aprovado',
          'Pago',
          'Instalado',
          'Assinado',
          'Contrato Assinado',
          'Aguardando Ativação',
          'Aguardando Instalacao',
          'Em Implantação',
          'Em Implantacao'
        ].map(s => s.toLowerCase().trim());

        const filteredLeads = allSourceLeads.filter((l: any) => {
          // 1. Filtrar por Status
          const rawStatus = l.status || l.Status || l.STATUS || l.situacao || l.Situacao || l.SITUACAO || l.SITUAÇÃO || '';
          const leadStatus = String(rawStatus).toLowerCase().trim();
          
          const isAllowedStatus = allowedStatuses.some(s => 
            leadStatus === s || 
            (s.length > 3 && leadStatus.includes(s)) || 
            (leadStatus.length > 3 && s.includes(leadStatus))
          );
          if (!isAllowedStatus) return false;

          // 2. Filtrar por Data (RIGOROSO e Timezone-Safe)
          const leadDateStr = l.data_fechamento || l.dataFechamento || l.DATA_FECHAMENTO || 
                             l.data || l.Data || l.DATA || 
                             l.data_consulta || l.dataConsulta || l.DATA_CONSULTA || 
                             l.created_at || l.CREATED_AT;
          
          if (!leadDateStr) return false;
          
          const leadDate = parseToLocalDate(leadDateStr);
          if (!leadDate || !start || !end) return false;
          
          if (leadDate < start || leadDate > end) return false;

          // 3. Filtrar por Vendedor
          if (goal.assignedTo === 'Toda a Equipe') {
            contributingLeads.push(l);
            return true;
          }
          
          let rawVendedor = l.vendedor || l.Vendedor || l.VENDEDOR || 
                            l.vendedor_nome || l.vendedorNome || l.VENDEDOR_NOME || 
                            l.usuario || l.Usuario || l.USUARIO || 
                            l.consultor || l.Consultor || l.CONSULTOR || 
                            l.criado_por || l.CRIADO_POR || '';
          
          // Tentar parsear se for string JSON
          if (typeof rawVendedor === 'string' && (rawVendedor.startsWith('{') || rawVendedor.startsWith('['))) {
            try {
              const parsed = JSON.parse(rawVendedor);
              rawVendedor = parsed;
            } catch (e) {}
          }

          if (typeof rawVendedor === 'object' && rawVendedor !== null) {
            rawVendedor = rawVendedor.name || rawVendedor.nome || rawVendedor.userName || rawVendedor.user_name || rawVendedor.full_name || rawVendedor.displayName || '';
          } else if (typeof rawVendedor === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawVendedor)) {
            const foundUser = allUsers.find(u => u.id === rawVendedor);
            if (foundUser) rawVendedor = foundUser.name;
          }
          
          const leadVendedor = normalizeString(String(rawVendedor));
          const goalAssigned = normalizeString(goal.assignedTo);
          
          if (!leadVendedor || !goalAssigned) return false;

          // 1. Match Exato ou Contém (ex: "Ketelley" em "Ketelley Martins")
          if (leadVendedor === goalAssigned || 
              (leadVendedor.length > 3 && goalAssigned.includes(leadVendedor)) || 
              (goalAssigned.length > 3 && leadVendedor.includes(goalAssigned))) {
            contributingLeads.push(l);
            return true;
          }

          // 2. Match por palavras (evitando nomes comuns como "Martins")
          const leadWords = leadVendedor.split(' ').filter(w => w.length > 3);
          const goalWords = goalAssigned.split(' ').filter(w => w.length > 3);
          
          // Exigimos que pelo menos 2 palavras batam se forem nomes longos
          const matchingWords = leadWords.filter(lw => goalWords.includes(lw));
          if (matchingWords.length >= 2) {
            contributingLeads.push(l);
            return true;
          }

          return false;
        });

        newGoalDetails[goal.id] = contributingLeads;

        if (goal.targetType === GoalTargetType.VALOR) {
          newProgress = filteredLeads.reduce((sum: number, l: any) => {
            const valRaw = l.valor_total_receita || l.valorTotalReceita || l.VALOR_TOTAL_RECEITA || 
                           l.valor_mensal || l.valorMensal || l.VALOR_MENSAL || 
                           l.valor || l.Valor || l.VALOR || 0;
            const val = typeof valRaw === 'string' ? Number(valRaw.replace(/[^0-9.,]/g, '').replace(',', '.')) : Number(valRaw);
            return sum + (isNaN(val) ? 0 : val);
          }, 0);
        } else {
          newProgress = filteredLeads.reduce((sum: number, l: any) => {
            // Somar o campo de linhas/ativos
            const valRaw = l.ativos || l.ATIVOS || l.Ativos || l.linhas || l.LINHAS || l.Linhas || 0;
            const val = typeof valRaw === 'string' ? Number(valRaw.replace(/[^0-9]/g, '')) : Number(valRaw);
            return sum + (isNaN(val) ? 0 : val);
          }, 0);
        }

        if (Math.abs(newProgress - goal.currentProgress) > 0.01) {
          await onSetGoalProgress(goal.id, newProgress);
        }
      }

      setGoalDetails(newGoalDetails);

      if (onRefreshGoals) await onRefreshGoals();
      if (!silent) alert("Sincronização concluída com sucesso! Os dados foram filtrados rigorosamente por data.");

    } catch (err) {
      console.error("Erro na sincronização:", err);
      if (!silent) alert("Erro ao sincronizar metas.");
    } finally {
      setIsSyncing(false);
    }
  };

  // Sincronização automática ao carregar o componente ou quando as metas mudarem
  React.useEffect(() => {
    if (goals.length > 0) {
      handleSyncExternal(true);
    }
  }, [goals.length]);

  const handleEdit = (goal: Goal) => {
    setEditingGoalId(goal.id);
    setFormData({
      title: goal.title,
      startDate: goal.startDate,
      endDate: goal.endDate,
      targetType: goal.targetType,
      objective: goal.objective,
      assignedTo: goal.assignedTo
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Tem certeza que deseja excluir esta meta? Esta ação não pode ser desfeita.")) {
      try {
        await onDeleteGoal(id);
      } catch (error) {
        console.error("Erro ao excluir meta:", error);
        alert("Erro ao excluir meta. Tente novamente.");
      }
    }
  };

  const groupedGoals = React.useMemo<{ [key: string]: Goal[] }>(() => {
    const groups: { [key: string]: Goal[] } = {};
    // Ordenar metas por data de início (mais recentes primeiro)
    const sortedGoals = [...goals].sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
    
    sortedGoals.forEach(goal => {
      const date = new Date(goal.startDate + 'T00:00:00');
      const monthYear = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase();
      if (!groups[monthYear]) groups[monthYear] = [];
      groups[monthYear].push(goal);
    });
    return groups;
  }, [goals]);

  const getProgressColor = (goal: Goal) => {
    const percent = (goal.currentProgress / goal.objective) * 100;
    if (percent >= 100) return 'bg-emerald-500';
    if (percent >= 70) return 'bg-orange-500';
    return 'bg-blue-500';
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-500 max-w-[1400px] mx-auto pb-24">
      <button onClick={onBack} className="flex items-center space-x-2 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors group">
        <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
        <span className="text-[11px] font-black uppercase tracking-widest">Voltar para Ferramentas</span>
      </button>

      <div className="flex flex-col items-center text-center">
        <div className="flex items-center space-x-3 mb-2">
          <span className="text-3xl">🔥</span>
          <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter uppercase">Gestão de Metas</h1>
        </div>
        <p className="text-slate-500 dark:text-slate-400 font-medium max-w-md mb-6">Crie, edite e acompanhe os desafios da equipe de vendas da VEC GROUP.</p>
        
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button 
            onClick={handleSyncExternal}
            disabled={isSyncing}
            className={`flex items-center space-x-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl transition-all active:scale-95 ${isSyncing ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isSyncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar com CRM Externo'}</span>
          </button>

          <button 
            onClick={() => {
              const currentMonth = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase();
              setSelectedReportMonth(currentMonth);
              setIsReportModalOpen(true);
            }}
            className="flex items-center space-x-2 px-6 py-3 bg-slate-900 hover:bg-black text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl transition-all active:scale-95"
          >
            <FileText size={14} />
            <span>Gerar Relatório JPG</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Formulário - Lado Esquerdo */}
        <div className="lg:col-span-4">
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl border border-slate-100 dark:border-slate-800 p-10 space-y-8 sticky top-24">
            <div className="flex items-center space-x-3 text-blue-600 dark:text-blue-400">
              {editingGoalId ? <Pencil size={20} /> : <Plus size={20} />}
              <h3 className="text-lg font-black uppercase tracking-tighter">
                {editingGoalId ? 'Editar Meta' : 'Nova Meta'}
              </h3>
            </div>

            <div className="space-y-6">
              {editingGoalId && (
                <button 
                  onClick={() => {
                    setEditingGoalId(null);
                    setFormData({
                      title: '',
                      startDate: getLocalDateString(new Date()),
                      endDate: '',
                      targetType: GoalTargetType.VALOR,
                      objective: 0,
                      assignedTo: 'Toda a Equipe'
                    });
                  }}
                  className="text-[10px] font-black text-red-500 uppercase tracking-widest hover:underline"
                >
                  Cancelar Edição
                </button>
              )}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Título da Meta</label>
                <input 
                  type="text" 
                  placeholder="Ex: Arrancada Black Friday"
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-5 py-4 text-sm font-bold text-slate-700 dark:text-white focus:outline-none focus:ring-4 focus:ring-blue-50 dark:focus:ring-blue-900/20 transition-all shadow-inner"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Data Início</label>
                  <div className="relative group/date">
                    <Calendar className="absolute right-4 top-1/2 -translate-y-1/2 text-blue-500 pointer-events-none" size={16} />
                    <input 
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData({...formData, startDate: e.target.value})}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl pl-5 pr-10 py-4 text-sm font-bold text-slate-700 dark:text-white focus:outline-none focus:ring-4 focus:ring-blue-50 dark:focus:ring-blue-900/20 transition-all shadow-inner"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Data Fim</label>
                  <div className="relative group/date">
                    <Calendar className="absolute right-4 top-1/2 -translate-y-1/2 text-blue-500 pointer-events-none" size={16} />
                    <input 
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData({...formData, endDate: e.target.value})}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl pl-5 pr-10 py-4 text-sm font-bold text-slate-700 dark:text-white focus:outline-none focus:ring-4 focus:ring-blue-50 dark:focus:ring-blue-900/20 transition-all shadow-inner"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Tipo de Alvo</label>
                <div className="relative">
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" size={16} />
                  <select 
                    value={formData.targetType}
                    onChange={(e) => setFormData({...formData, targetType: e.target.value as GoalTargetType})}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-5 py-4 text-sm font-bold text-slate-700 dark:text-white focus:outline-none appearance-none cursor-pointer shadow-inner"
                  >
                    <option value={GoalTargetType.QUANTIDADE}>{GoalTargetType.QUANTIDADE}</option>
                    <option value={GoalTargetType.VALOR}>{GoalTargetType.VALOR}</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Objetivo ({formData.targetType === GoalTargetType.VALOR ? 'R$' : 'Nº'})</label>
                <input 
                  type="number"
                  placeholder="0"
                  value={formData.objective || ''}
                  onChange={(e) => setFormData({...formData, objective: Number(e.target.value)})}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-5 py-4 text-sm font-black text-slate-700 dark:text-white focus:outline-none shadow-inner"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Atribuir a</label>
                <div className="relative">
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" size={16} />
                  <select 
                    value={formData.assignedTo}
                    onChange={(e) => setFormData({...formData, assignedTo: e.target.value})}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-5 py-4 text-sm font-bold text-slate-700 dark:text-white focus:outline-none appearance-none cursor-pointer shadow-inner"
                  >
                    <option value="Toda a Equipe">Toda a Equipe</option>
                    {allUsers.map((u, idx) => <option key={`${u.id || u.name}-${idx}`} value={u.name}>{u.name}</option>)}
                  </select>
                </div>
              </div>

              <button 
                onClick={handleCreate}
                disabled={isCreating}
                className={`w-full bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-2xl transition-all flex items-center justify-center space-x-3 active:scale-95 ${isCreating ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isCreating ? <Loader2 size={18} className="animate-spin" /> : (editingGoalId ? <RefreshCw size={18} /> : <Plus size={18} />)}
                <span>{isCreating ? 'Sincronizando...' : (editingGoalId ? 'Salvar Alterações' : 'Criar Meta Agora')}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Listagem - Lado Direito */}
        <div className="lg:col-span-8 space-y-12">
          {goals.length === 0 ? (
            <div className="space-y-6">
              <div className="flex items-center space-x-3 text-slate-900 dark:text-white">
                <CircleDot className="text-blue-500" size={20} />
                <h3 className="text-xl font-black uppercase tracking-tight">Metas Ativas (0)</h3>
              </div>
              <div className="bg-white dark:bg-slate-900 rounded-[3rem] p-24 border-2 border-dashed border-slate-100 dark:border-slate-800 flex flex-col items-center justify-center text-center">
                 <div className="w-24 h-24 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center mb-6 shadow-sm border border-slate-50 dark:border-slate-700">
                   <Target size={48} className="text-slate-200 dark:text-slate-700" />
                 </div>
                 <p className="text-slate-400 dark:text-slate-600 font-bold uppercase text-[11px] tracking-[0.2em]">Nenhuma meta cadastrada no momento.</p>
              </div>
            </div>
          ) : (
            (Object.entries(groupedGoals) as [string, Goal[]][]).map(([monthYear, monthGoals]) => (
              <div key={monthYear} className="space-y-6">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                  <div className="flex items-center space-x-3 text-slate-900 dark:text-white">
                    <Calendar className="text-[#00A1E4]" size={20} />
                    <h3 className="text-xl font-black uppercase tracking-tight">{monthYear}</h3>
                  </div>
                  <div className="flex items-center space-x-3">
                    <button 
                      onClick={() => {
                        setSelectedReportMonth(monthYear);
                        setIsReportModalOpen(true);
                      }}
                      className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-all"
                      title="Gerar Relatório deste mês"
                    >
                      <Download size={18} />
                    </button>
                    <span className="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                      {monthGoals.length} {monthGoals.length === 1 ? 'Meta' : 'Metas'}
                    </span>
                  </div>
                </div>

                <div className="space-y-6">
                  {monthGoals.map((goal) => {
                    const percent = Math.min(100, Math.round((goal.currentProgress / goal.objective) * 100));
                    return (
                      <div key={goal.id} className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-10 shadow-xl border border-slate-100 dark:border-slate-800 hover:border-blue-200 dark:hover:border-blue-900/50 transition-all group overflow-hidden relative">
                        {percent >= 100 && (
                          <div className="absolute -top-4 -right-4 w-24 h-24 bg-emerald-500 text-white flex items-center justify-center rotate-12 shadow-lg">
                            <Trophy size={32} className="mt-4" />
                          </div>
                        )}
                        
                        <div className="flex justify-between items-start mb-8">
                            <div>
                              <div className="flex items-center space-x-2 mb-1">
                                 <span className="text-[10px] font-black text-blue-500 dark:text-blue-400 uppercase tracking-widest">{goal.assignedTo}</span>
                                 <span className="text-slate-300 dark:text-slate-700">•</span>
                                 <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                                   {new Date(goal.startDate + 'T00:00:00').toLocaleDateString('pt-BR')} até {goal.endDate ? new Date(goal.endDate + 'T00:00:00').toLocaleDateString('pt-BR') : 'Sem Prazo'}
                                 </span>
                                 {goal.endDate && new Date(goal.endDate + 'T23:59:59') < new Date() && (
                                   <>
                                     <span className="text-slate-300 dark:text-slate-700">•</span>
                                     <span className="bg-red-500/10 text-red-500 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border border-red-500/20">Expirada</span>
                                   </>
                                 )}
                              </div>
                              <h4 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">{goal.title}</h4>
                           </div>
                           <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-all">
                               <button 
                                 onClick={() => setViewingDetailsGoalId(goal.id)}
                                 className="p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-500 rounded-xl hover:bg-blue-500 hover:text-white shadow-sm"
                                 title="Ver Detalhes"
                               >
                                  <FileText size={18} />
                               </button>
                              <button onClick={() => handleEdit(goal)} className="p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-500 rounded-xl hover:bg-blue-500 hover:text-white shadow-sm">
                                 <Pencil size={18} />
                              </button>
                              <button onClick={() => handleDelete(goal.id)} className="p-3 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-xl hover:bg-red-500 hover:text-white shadow-sm">
                                 <Trash2 size={18} />
                              </button>
                           </div>
                        </div>

                        <div className="space-y-4">
                           <div className="flex justify-between items-end">
                              <div className="space-y-1">
                                 <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Acompanhamento de Resultados</p>
                                 <div className="flex items-baseline space-x-2">
                                    <span className="text-3xl font-black text-slate-900 dark:text-white">
                                       {goal.targetType === GoalTargetType.VALOR 
                                         ? goal.currentProgress.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) 
                                         : `${goal.currentProgress} Linhas`}
                                    </span>
                                    <span className="text-sm font-bold text-slate-300 dark:text-slate-700">
                                      / {goal.targetType === GoalTargetType.VALOR 
                                        ? goal.objective.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) 
                                        : goal.objective}
                                    </span>
                                 </div>
                              </div>
                              <div className="text-right">
                                 <span className={`text-4xl font-black tracking-tighter ${percent >= 100 ? 'text-emerald-500' : 'text-blue-600 dark:text-blue-400'}`}>{percent}%</span>
                              </div>
                           </div>

                           <div className="h-4 bg-white dark:bg-slate-800 rounded-full overflow-hidden border border-slate-100 dark:border-slate-700 p-0.5 shadow-inner">
                              <div 
                                className={`h-full rounded-full transition-all duration-1000 ${getProgressColor(goal)} shadow-lg shadow-blue-500/20`}
                                style={{ width: `${percent}%` }}
                              />
                           </div>
                        </div>

                         <div className="mt-8 pt-8 border-t border-slate-50 dark:border-slate-800 flex items-center justify-between">
                            <div className="flex items-center space-x-2 text-[10px] font-black uppercase text-slate-400 dark:text-slate-600 tracking-widest">
                               {percent >= 100 ? (
                                 <button 
                                   onClick={() => onCelebrate?.(goal)}
                                   className="flex items-center space-x-2 hover:text-emerald-500 transition-colors"
                                 >
                                   <CheckCircle2 size={14} className="text-emerald-500" />
                                   <span>Objetivo Alcançado (Ver Celebração)</span>
                                 </button>
                               ) : (
                                 <>
                                   <TrendingUp size={14} className="text-blue-500 dark:text-blue-400" />
                                   <span>Progresso em Tempo Real</span>
                                 </>
                               )}
                            </div>
                           <div className="flex items-center space-x-2">
                              <button 
                                onClick={() => onUpdateGoalProgress(goal.id, goal.targetType === GoalTargetType.VALOR ? 1000 : 1)}
                                className="bg-slate-900 dark:bg-blue-600 hover:bg-black dark:hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all shadow-lg active:scale-95"
                              >
                                 + Atualizar Progresso
                              </button>
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
      </div>

      {isReportModalOpen && selectedReportMonth && (
        <GoalReportModal 
          isOpen={isReportModalOpen}
          onClose={() => setIsReportModalOpen(false)}
          goals={goals}
          allUsers={allUsers}
          monthYear={selectedReportMonth}
          systemLogo={systemLogo}
        />
      )}
      {/* Modal de Detalhes da Meta */}
      {viewingDetailsGoalId && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[80vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  Detalhes da Meta: {goals.find(g => g.id === viewingDetailsGoalId)?.title}
                </h3>
                <p className="text-sm text-gray-500">
                  Lista de clientes e registros que compõem o resultado atual
                </p>
              </div>
              <button 
                onClick={() => setViewingDetailsGoalId(null)}
                className="p-2 hover:bg-gray-200 rounded-full transition-colors"
              >
                <ArrowLeft size={24} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              {!goalDetails[viewingDetailsGoalId] || goalDetails[viewingDetailsGoalId].length === 0 ? (
                <div className="text-center py-12">
                  <AlertCircle className="mx-auto text-gray-300 mb-4" size={48} />
                  <p className="text-gray-500">Nenhum registro encontrado para esta meta ainda.</p>
                  <p className="text-sm text-gray-400 mt-2">Clique em "Sincronizar" para atualizar os dados.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50 text-gray-600 text-sm uppercase tracking-wider">
                        <th className="px-4 py-3 font-semibold border-b">Data</th>
                        <th className="px-4 py-3 font-semibold border-b">Cliente / CNPJ</th>
                        <th className="px-4 py-3 font-semibold border-b">Vendedor</th>
                        <th className="px-4 py-3 font-semibold border-b">Status</th>
                        <th className="px-4 py-3 font-semibold border-b text-right">
                          {goals.find(g => g.id === viewingDetailsGoalId)?.targetType === GoalTargetType.VALOR ? 'Valor' : 'Linhas'}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {goalDetails[viewingDetailsGoalId].map((lead, idx) => {
                        const goal = goals.find(g => g.id === viewingDetailsGoalId);
                        const valRaw = goal?.targetType === GoalTargetType.VALOR 
                          ? (lead.valor_total_receita || lead.valorTotalReceita || lead.valor_mensal || lead.valor || 0)
                          : (lead.ativos || lead.ATIVOS || lead.linhas || lead.LINHAS || 0);
                        
                        const dateStr = lead.data_fechamento || lead.data || lead.created_at || '-';
                        const cliente = lead.nome_cliente || lead.cliente || lead.razao_social || lead.cnpj || lead.CNPJ || 'Cliente s/ Nome';
                        const vendedor = lead.vendedor || lead.Vendedor || lead.vendedor_nome || '-';
                        const status = lead.status || lead.Status || lead.situacao || '-';

                        return (
                          <tr key={idx} className="hover:bg-blue-50/30 transition-colors">
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {typeof dateStr === 'string' && dateStr.includes('T') ? dateStr.split('T')[0] : dateStr}
                            </td>
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">
                              {cliente}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {typeof vendedor === 'object' ? (vendedor.name || vendedor.nome || 'N/A') : vendedor}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                                {status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm font-bold text-gray-900 text-right">
                              {goal?.targetType === GoalTargetType.VALOR 
                                ? `R$ ${Number(valRaw).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                                : valRaw}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            
            <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-between items-center">
              <div className="text-sm text-gray-500">
                Total de registros: <strong>{goalDetails[viewingDetailsGoalId]?.length || 0}</strong>
              </div>
              <button 
                onClick={() => setViewingDetailsGoalId(null)}
                className="px-6 py-2 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 transition-all"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GoalsManagement;
