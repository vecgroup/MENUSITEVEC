
import React, { useState, useMemo } from 'react';
import { Target, X, Trophy, TrendingUp, ChevronRight } from 'lucide-react';
import { Goal, GoalTargetType, User } from '../types';

interface GoalFloatingWidgetProps {
  goals: Goal[];
  user: User;
}

const GoalFloatingWidget: React.FC<GoalFloatingWidgetProps> = ({ goals, user }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  const relevantGoals = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    // Filtrar apenas metas que ainda não expiraram
    const activeGoals = goals.filter(g => {
      if (!g.endDate) return true;
      const end = new Date(g.endDate);
      // Ajustar para o final do dia da data de término
      end.setHours(23, 59, 59, 999);
      return end >= now;
    });

    const role = (user.role || '').toUpperCase();
    const isPrivileged = ['OWNER', 'SUPERVISOR', 'ADMINISTRATIVO', 'ADMINISTRADOR', 'ADVOGADO'].includes(role);
    if (isPrivileged) return activeGoals;
    
    return activeGoals.filter(g => 
      g.assignedTo === 'Toda a Equipe' || 
      g.assignedTo.toLowerCase().trim() === user.name.toLowerCase().trim()
    );
  }, [goals, user.name, user.role]);

  const isPrivileged = useMemo(() => {
    const role = (user.role || '').toUpperCase();
    return ['OWNER', 'SUPERVISOR', 'ADMINISTRATIVO', 'ADMINISTRADOR', 'ADVOGADO'].includes(role);
  }, [user.role]);

  if (relevantGoals.length === 0) return null;

  // Se houver múltiplas metas, mostramos a soma ou a principal? 
  // O usuário pediu para aparecer junto. Vou mostrar uma lista.
  
  return (
    <div className="fixed bottom-10 right-10 z-[100]">
      {/* Mini Painel */}
      {isOpen && (
        <div className="absolute bottom-20 right-0 w-80 bg-[#001a4d] rounded-[2.5rem] shadow-2xl border border-white/10 overflow-hidden animate-in slide-in-from-bottom-10 fade-in duration-300">
           <div className="bg-gradient-to-b from-[#00A1E4]/20 to-transparent p-8 text-white">
              <div className="flex items-center justify-between mb-4">
                 <div className="flex items-center space-x-2">
                    <Target size={18} className="text-[#00A1E4]" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-[#00A1E4]">{isPrivileged ? 'Metas da Equipe' : 'Minhas Metas'}</span>
                 </div>
                 <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/10 rounded-xl transition-all">
                    <X size={16} />
                 </button>
              </div>
              <p className="text-[9px] font-bold text-white/40 uppercase tracking-[0.2em] mb-4">Acompanhamento em Tempo Real</p>
           </div>
           
           <div className="p-8 pt-0 space-y-8 bg-[#001a4d] max-h-[400px] overflow-y-auto custom-scrollbar">
              {relevantGoals.map((goal) => {
                const percent = Math.min(100, Math.round((goal.currentProgress / goal.objective) * 100));
                return (
                  <div key={goal.id} className="space-y-3 border-b border-white/5 pb-6 last:border-0 last:pb-0">
                    <div className="flex justify-between items-start">
                      <div className="flex-1 pr-4">
                        <h4 className="text-sm font-black uppercase tracking-tighter leading-tight text-white">{goal.title}</h4>
                        <span className="text-[9px] font-bold text-white/30 uppercase tracking-widest">{goal.assignedTo}</span>
                      </div>
                      <span className={`text-xl font-black ${percent >= 100 ? 'text-emerald-500' : 'text-[#00A1E4]'}`}>{percent}%</span>
                    </div>

                    <div className="space-y-2">
                       <div className="flex justify-between text-[8px] font-black uppercase tracking-widest">
                          <span className="text-white/40">Progresso</span>
                          <span className="text-white">
                            {goal.targetType === GoalTargetType.VALOR 
                              ? goal.currentProgress.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) 
                              : goal.currentProgress}
                            <span className="text-white/20 ml-1">/ {goal.targetType === GoalTargetType.VALOR ? goal.objective.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : goal.objective}</span>
                          </span>
                       </div>
                       <div className="h-2 bg-white/5 rounded-full overflow-hidden border border-white/10">
                          <div 
                            className={`h-full bg-gradient-to-r ${percent >= 100 ? 'from-emerald-500 to-emerald-700' : 'from-[#00A1E4] to-[#003399]'} transition-all duration-1000`}
                            style={{ width: `${percent}%` }}
                          />
                       </div>
                    </div>
                  </div>
                );
              })}

              <button className="w-full flex items-center justify-center space-x-2 py-4 bg-white/5 hover:bg-white/10 rounded-2xl text-[10px] font-black uppercase text-[#00A1E4] transition-all group">
                 <span>Ver Detalhes da Equipe</span>
                 <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
              </button>
           </div>
        </div>
      )}

      {/* Botão Flutuante (Chat Head) */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`w-16 h-16 rounded-full shadow-2xl flex items-center justify-center transition-all duration-500 transform hover:scale-110 active:scale-95 ${isOpen ? 'bg-[#00A1E4] text-white rotate-[360deg]' : 'bg-[#001a4d] border-2 border-[#00A1E4] text-[#00A1E4]'}`}
      >
        {isOpen ? <X size={28} /> : <Target size={32} className="drop-shadow-lg" />}
        {!isOpen && relevantGoals.some(g => (g.currentProgress / g.objective) >= 1) && (
          <div className="absolute -top-1 -right-1 w-6 h-6 bg-emerald-500 text-white rounded-full flex items-center justify-center border-2 border-[#001a4d] animate-bounce">
            <Trophy size={12} />
          </div>
        )}
      </button>
    </div>
  );
};

export default GoalFloatingWidget;
