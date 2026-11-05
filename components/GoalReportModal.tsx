import React, { useRef, useState } from 'react';
import { X, Download, Target, Trophy, Calendar, Users, TrendingUp, Loader2 } from 'lucide-react';
import html2canvas from 'html2canvas';
import { Goal, GoalTargetType, User } from '../types';

interface GoalReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  goals: Goal[];
  allUsers: User[];
  monthYear: string;
  systemLogo?: string | null;
}

const GoalReportModal: React.FC<GoalReportModalProps> = ({ 
  isOpen, 
  onClose, 
  goals, 
  allUsers, 
  monthYear,
  systemLogo 
}) => {
  const reportRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  if (!isOpen) return null;

  const handleDownload = async () => {
    if (!reportRef.current) return;
    
    try {
      setIsGenerating(true);
      const canvas = await html2canvas(reportRef.current, {
        scale: 2, // Higher quality
        useCORS: true,
        backgroundColor: '#000d26',
        logging: false
      });
      
      const link = document.createElement('a');
      link.download = `Relatorio_Metas_${monthYear.replace(' ', '_')}.jpg`;
      link.href = canvas.toDataURL('image/jpeg', 0.9);
      link.click();
    } catch (error) {
      console.error("Erro ao gerar imagem:", error);
      alert("Erro ao gerar o relatório. Tente novamente.");
    } finally {
      setIsGenerating(false);
    }
  };

  // Filtrar metas do mês selecionado
  const monthGoals = goals.filter(goal => {
    const date = new Date(goal.startDate + 'T00:00:00');
    const goalMonthYear = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase();
    return goalMonthYear === monthYear;
  });

  const teamGoals = monthGoals.filter(g => g.assignedTo === 'Toda a Equipe');
  const individualGoals = monthGoals.filter(g => g.assignedTo !== 'Toda a Equipe');

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="absolute inset-0" onClick={onClose}></div>
      
      <div className="bg-white dark:bg-slate-900 w-full max-w-5xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col relative animate-in zoom-in-95 max-h-[90vh]">
        <div className="px-10 py-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-blue-600">
              <TrendingUp size={20} />
            </div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Gerador de Relatório</h2>
          </div>
          <div className="flex items-center space-x-4">
            <button 
              onClick={handleDownload}
              disabled={isGenerating}
              className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl transition-all active:scale-95 disabled:opacity-50"
            >
              {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              <span>{isGenerating ? 'Gerando...' : 'Baixar JPG'}</span>
            </button>
            <button onClick={onClose} className="p-2.5 text-slate-400 hover:text-slate-900 dark:hover:text-white"><X size={20} /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-10 bg-slate-50 dark:bg-slate-950/50">
          {/* Área que será capturada */}
          <div 
            ref={reportRef}
            className="w-full aspect-[16/9] bg-[#000d26] p-12 relative overflow-hidden shadow-2xl mx-auto"
            style={{ minWidth: '1080px' }}
          >
            {/* Background Elements */}
            <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-blue-600/10 to-transparent pointer-events-none" />
            <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-blue-600/20 rounded-full blur-[100px] pointer-events-none" />
            
            <div className="relative z-10 h-full flex flex-col">
              {/* Header do Relatório */}
              <div className="flex justify-between items-start mb-12">
                <div>
                  <div className="flex items-center space-x-3 mb-4">
                    {systemLogo ? (
                      <img src={systemLogo} alt="Logo" className="h-12 object-contain" />
                    ) : (
                      <div className="text-2xl font-black text-white tracking-tighter">VEC <span className="text-[#00A1E4]">GROUP</span></div>
                    )}
                  </div>
                  <h1 className="text-5xl font-black text-white uppercase tracking-tighter leading-none mb-2">Relatório de Performance</h1>
                  <div className="flex items-center space-x-3 text-[#00A1E4]">
                    <Calendar size={18} />
                    <span className="text-lg font-black uppercase tracking-[0.2em]">{monthYear}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-md">
                    <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">Status Geral</p>
                    <p className="text-2xl font-black text-emerald-500 uppercase tracking-tighter">Em Evolução</p>
                  </div>
                </div>
              </div>

              {/* Grid de Conteúdo */}
              <div className="grid grid-cols-12 gap-8 flex-1">
                {/* Metas da Equipe */}
                <div className="col-span-7 space-y-6">
                  <div className="flex items-center space-x-2 text-white/40 mb-4">
                    <Users size={16} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Metas Coletivas</span>
                  </div>
                  
                  {teamGoals.length > 0 ? teamGoals.map(goal => {
                    const percent = Math.min(100, Math.round((goal.currentProgress / goal.objective) * 100));
                    return (
                      <div key={goal.id} className="bg-white/5 border border-white/10 rounded-[2rem] p-8 backdrop-blur-sm">
                        <div className="flex justify-between items-end mb-6">
                          <div>
                            <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-1">{goal.title}</h3>
                            <p className="text-xs font-bold text-white/40 uppercase tracking-widest">Objetivo da Equipe</p>
                          </div>
                          <div className="text-right">
                            <span className={`text-5xl font-black tracking-tighter ${percent >= 100 ? 'text-emerald-500' : 'text-[#00A1E4]'}`}>{percent}%</span>
                          </div>
                        </div>
                        
                        <div className="space-y-4">
                          <div className="h-4 bg-white/5 rounded-full overflow-hidden border border-white/10 p-1">
                            <div 
                              className={`h-full rounded-full bg-gradient-to-r ${percent >= 100 ? 'from-emerald-500 to-emerald-700' : 'from-[#00A1E4] to-[#003399]'} shadow-lg`}
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                            <span className="text-white/40">Progresso Atual</span>
                            <span className="text-white">
                              {goal.targetType === GoalTargetType.VALOR 
                                ? goal.currentProgress.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) 
                                : `${goal.currentProgress} Linhas`}
                              <span className="text-white/20 ml-2">/ {goal.targetType === GoalTargetType.VALOR ? goal.objective.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : goal.objective}</span>
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  }) : (
                    <div className="h-40 flex items-center justify-center border border-white/5 rounded-[2rem] text-white/20 font-black uppercase text-xs">
                      Nenhuma meta coletiva este mês
                    </div>
                  )}
                </div>

                {/* Ranking Individual */}
                <div className="col-span-5 space-y-6">
                  <div className="flex items-center space-x-2 text-white/40 mb-4">
                    <Trophy size={16} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Top Performers</span>
                  </div>

                  <div className="bg-white/5 border border-white/10 rounded-[2rem] p-8 backdrop-blur-sm flex-1">
                    <div className="space-y-6">
                      {individualGoals
                        .sort((a, b) => (b.currentProgress / b.objective) - (a.currentProgress / a.objective))
                        .slice(0, 5)
                        .map((goal, index) => {
                          const percent = Math.min(100, Math.round((goal.currentProgress / goal.objective) * 100));
                          const userProfile = allUsers.find(u => u.name === goal.assignedTo);
                          
                          return (
                            <div key={goal.id} className="flex items-center space-x-4">
                              <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-[10px] font-black text-white/40 border border-white/10">
                                {index + 1}º
                              </div>
                              <div className="flex-1">
                                <div className="flex justify-between items-center mb-1">
                                  <div className="flex flex-col items-start">
                                    <span className="text-xs font-black text-white uppercase tracking-tight">{goal.assignedTo}</span>
                                    <span className="text-[8px] font-bold text-white/40 uppercase tracking-widest">
                                      {goal.targetType === GoalTargetType.VALOR 
                                        ? goal.currentProgress.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) 
                                        : `${goal.currentProgress} Linhas`} 
                                      / 
                                      {goal.targetType === GoalTargetType.VALOR 
                                        ? goal.objective.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) 
                                        : goal.objective}
                                    </span>
                                  </div>
                                  <span className={`text-xs font-black ${percent >= 100 ? 'text-emerald-500' : 'text-[#00A1E4]'}`}>{percent}%</span>
                                </div>
                                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full rounded-full ${percent >= 100 ? 'bg-emerald-500' : 'bg-[#00A1E4]'}`}
                                    style={{ width: `${percent}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      
                      {individualGoals.length === 0 && (
                        <div className="h-full flex items-center justify-center text-white/20 font-black uppercase text-[10px] text-center">
                          Nenhuma meta individual<br/>registrada neste período
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer do Relatório */}
              <div className="mt-12 pt-8 border-t border-white/5 flex justify-between items-center">
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 rounded-xl bg-[#00A1E4] flex items-center justify-center text-white shadow-lg">
                    <Target size={20} />
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-white/40 uppercase tracking-widest">Gerado em</p>
                    <p className="text-[10px] font-black text-white uppercase">{new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em]">VEC GROUP CRM - PERFORMANCE SYSTEM</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GoalReportModal;
