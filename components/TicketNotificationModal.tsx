import React from 'react';
import { LifeBuoy, X, AlertTriangle, Clock, ChevronRight, Building } from 'lucide-react';
import { Ticket } from '../types';

interface TicketNotificationModalProps {
  ticket: Ticket;
  isUrgent: boolean;
  onClose: () => void;
}

const TicketNotificationModal: React.FC<TicketNotificationModalProps> = ({ ticket, isUrgent, onClose }) => {
  // Função para calcular a diferença de dias
  const getDaysStatus = () => {
    const deadline = new Date(ticket.deadlineAt);
    const today = new Date();
    
    // Zeramos as horas para comparar apenas os dias calendários
    const d1 = new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate());
    const d2 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    const diffTime = d1.getTime() - d2.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays > 0) {
      return `FALTAM ${diffDays} ${diffDays === 1 ? 'DIA' : 'DIAS'}`;
    } else if (diffDays < 0) {
      return `ATRASADO HÁ ${Math.abs(diffDays)} ${Math.abs(diffDays) === 1 ? 'DIA' : 'DIAS'}`;
    } else {
      return "VENCE HOJE";
    }
  };

  const daysMessage = getDaysStatus();

  return (
    <div className={`fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-slate-900/90 backdrop-blur-xl animate-in fade-in duration-500`}>
      <div className={`bg-white w-full max-w-xl rounded-[4rem] shadow-[0_50px_100px_rgba(0,0,0,0.5)] overflow-hidden relative border-8 ${isUrgent ? 'border-red-500/20' : 'border-blue-500/20'} animate-in zoom-in-95`}>
        
        <div className={`p-12 flex flex-col items-center text-center space-y-8`}>
           <div className={`w-24 h-24 rounded-[2.5rem] flex items-center justify-center shadow-2xl animate-bounce ${isUrgent ? 'bg-red-500 text-white' : 'bg-blue-600 text-white'}`}>
              {isUrgent ? <AlertTriangle size={48} /> : <LifeBuoy size={48} />}
           </div>

           <div className="space-y-3">
              <h2 className={`text-4xl font-black uppercase tracking-tighter leading-none ${isUrgent ? 'text-red-600' : 'text-slate-900'}`}>
                {isUrgent ? 'Tratamento Urgente!' : 'Novo Chamado em Aberto'}
              </h2>
              <p className="text-slate-500 font-bold text-sm uppercase tracking-[0.2em]">O administrativo precisa tratar esta solicitação</p>
           </div>

           <div className="bg-slate-50 w-full rounded-[3rem] p-10 border border-slate-100 space-y-6">
              <div className="flex items-center space-x-5 text-left">
                 <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm text-slate-400"><Building size={24} /></div>
                 <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Empresa / Lead</p>
                    <h4 className="text-lg font-black text-slate-800 uppercase tracking-tight">{ticket.razaoSocial}</h4>
                 </div>
              </div>

              <div className="grid grid-cols-2 gap-8 text-left border-t border-slate-100 pt-6">
                 <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Solicitado por</p>
                    <div className="flex items-center space-x-2">
                       <span className="text-sm font-black text-slate-700 uppercase">{ticket.requesterName}</span>
                    </div>
                 </div>
                 <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Status do Prazo</p>
                    <div className={`flex items-center space-x-2 text-sm font-black ${isUrgent ? 'text-red-600' : 'text-emerald-600'}`}>
                       <Clock size={16} />
                       <span>{daysMessage}</span>
                    </div>
                 </div>
              </div>
           </div>

           <div className="w-full space-y-4">
              <button 
                onClick={onClose}
                className={`w-full py-6 rounded-3xl font-black text-xs uppercase tracking-[0.3em] shadow-2xl transition-all active:scale-95 flex items-center justify-center space-x-3 ${isUrgent ? 'bg-red-600 text-white' : 'bg-slate-900 text-white hover:bg-black'}`}
              >
                <span>Ciente e Atuando</span>
                <ChevronRight size={18} />
              </button>
              {isUrgent && (
                <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest animate-pulse">Este modal continuará aparecendo até a resolução</p>
              )}
           </div>
        </div>

        <button onClick={onClose} className="absolute top-10 right-10 p-3 text-slate-300 hover:text-slate-900 transition-colors">
          <X size={24} />
        </button>
      </div>
    </div>
  );
};

export default TicketNotificationModal;