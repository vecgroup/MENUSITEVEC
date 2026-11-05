
import React, { useState, useMemo } from 'react';
import { 
  ArrowLeft, 
  Calculator, 
  TrendingUp, 
  DollarSign, 
  Trophy, 
  Info,
  Layers,
  Percent
} from 'lucide-react';

interface CommissionCalculatorProps {
  onBack: () => void;
}

const CommissionCalculator: React.FC<CommissionCalculatorProps> = ({ onBack }) => {
  const [totalLines, setTotalLines] = useState<number>(0);
  const [portedValue, setPortedValue] = useState<number>(0);

  const levels = [
    { label: 'Nível 1', min: 0, max: 9, percentage: 0, color: 'bg-slate-100 text-slate-500' },
    { label: 'Nível 2', min: 10, max: 29, percentage: 25, color: 'bg-amber-100 text-amber-600' },
    { label: 'Nível 3', min: 30, max: 49, percentage: 50, color: 'bg-emerald-100 text-emerald-600' },
    { label: 'Nível 4', min: 50, max: 64, percentage: 80, color: 'bg-teal-100 text-teal-600' },
    { label: 'Nível 5', min: 65, max: 74, percentage: 100, color: 'bg-blue-100 text-blue-600' },
    { label: 'Nível 6', min: 75, max: 99, percentage: 110, color: 'bg-indigo-100 text-indigo-600' },
    { label: 'Nível 7', min: 100, max: Infinity, percentage: 120, color: 'bg-rose-100 text-rose-600' },
  ];

  const currentLevel = useMemo(() => {
    return levels.find(l => totalLines >= l.min && totalLines <= l.max) || levels[0];
  }, [totalLines]);

  const estimatedCommission = useMemo(() => {
    return portedValue * (currentLevel.percentage / 100);
  }, [portedValue, currentLevel]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-24 max-w-6xl mx-auto">
      <div className="flex flex-col">
        <button onClick={onBack} className="flex items-center space-x-2 text-slate-400 hover:text-slate-900 transition-colors mb-4 group w-fit">
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
          <span className="text-[10px] font-black uppercase tracking-widest">Voltar para Ferramentas</span>
        </button>
        <div className="flex items-center space-x-4">
           <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center border border-blue-100 shadow-sm"><Calculator size={24} /></div>
           <div>
              <h1 className="text-3xl font-black text-white tracking-tighter uppercase leading-none">Calculadora de Comissão</h1>
              <p className="text-white/60 text-sm font-medium mt-1">Simule seus ganhos com base nos níveis de produção.</p>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
        {/* Lado Esquerdo - Inputs */}
        <div className="bg-white rounded-[3rem] shadow-sm border border-slate-100 p-10 space-y-10">
          <div className="flex items-center space-x-3 text-slate-800">
             <Calculator size={20} className="text-blue-500" />
             <h3 className="text-sm font-black uppercase tracking-widest">Informe os dados da simulação</h3>
          </div>

          <div className="space-y-8">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center">
                <Layers size={12} className="mr-1" /> Total de Linhas Fechadas
              </label>
              <input 
                type="number" 
                placeholder="Ex: 45"
                value={totalLines || ''}
                onChange={(e) => setTotalLines(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-xl font-black text-slate-700 focus:bg-white focus:border-blue-300 transition-all outline-none"
              />
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter mt-1">Este valor define seu nível e porcentagem de premiação.</p>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center">
                <TrendingUp size={12} className="mr-1" /> Valor Portado & Finalizado (R$)
              </label>
              <div className="relative">
                <span className="absolute left-6 top-1/2 -translate-y-1/2 text-xl font-black text-slate-300">R$</span>
                <input 
                  type="number" 
                  placeholder="Ex: 15000.00"
                  value={portedValue || ''}
                  onChange={(e) => setPortedValue(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl pl-16 pr-6 py-4 text-xl font-black text-slate-700 focus:bg-white focus:border-blue-300 transition-all outline-none"
                />
              </div>
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter mt-1">Valor sobre o qual a porcentagem de premiação será aplicada.</p>
            </div>
          </div>
        </div>

        {/* Lado Direito - Resultado */}
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[3rem] shadow-2xl p-10 flex flex-col justify-between text-white relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-20 translate-x-20 blur-3xl"></div>
          
          <div className="relative z-10 flex items-center space-x-3 mb-10">
             <Trophy size={20} className="text-white/60" />
             <h3 className="text-sm font-black uppercase tracking-widest">Resultado da Simulação</h3>
          </div>

          <div className="relative z-10 space-y-6">
            <div className="bg-white/10 backdrop-blur-md rounded-3xl p-6 border border-white/10 flex items-center justify-between">
               <div className="flex items-center space-x-3">
                 <Trophy size={24} className="text-amber-400" />
                 <span className="text-xs font-black uppercase tracking-widest">Nível Atingido</span>
               </div>
               <span className="bg-white text-blue-600 px-6 py-2 rounded-2xl font-black text-sm uppercase">{currentLevel.label}</span>
            </div>

            <div className="bg-white/10 backdrop-blur-md rounded-3xl p-6 border border-white/10 flex items-center justify-between">
               <div className="flex items-center space-x-3">
                 <Percent size={24} className="text-blue-300" />
                 <span className="text-xs font-black uppercase tracking-widest">% de Premiação</span>
               </div>
               <span className="text-4xl font-black">{currentLevel.percentage}%</span>
            </div>

            <div className="bg-white rounded-[2rem] p-10 border border-white/10 text-center space-y-2 shadow-2xl transform transition-transform group-hover:scale-[1.02]">
               <div className="flex items-center justify-center space-x-2 text-slate-400">
                 <DollarSign size={20} />
                 <span className="text-[10px] font-black uppercase tracking-widest">Premiação Real Estimada</span>
               </div>
               <h4 className="text-6xl font-black text-slate-900 tracking-tighter">
                 {estimatedCommission.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
               </h4>
            </div>
          </div>
        </div>
      </div>

      {/* Tabela de Níveis */}
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-8 border-b border-slate-50 flex items-center space-x-3">
          <Layers size={18} className="text-blue-500" />
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">Tabela de Níveis e Premiações</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50">
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Nível</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Mínimo de Linhas</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Máximo de Linhas</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">% Premiação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {levels.map((lvl, idx) => (
                <tr key={idx} className={`hover:bg-slate-50/50 transition-colors ${currentLevel.label === lvl.label ? 'bg-blue-50/50' : ''}`}>
                  <td className="px-8 py-4">
                    <span className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase ${lvl.color}`}>
                      {lvl.label}
                    </span>
                  </td>
                  <td className="px-8 py-4 text-sm font-black text-slate-700">{lvl.min}</td>
                  <td className="px-8 py-4 text-sm font-black text-slate-700">{lvl.max === Infinity ? 'Acima' : lvl.max}</td>
                  <td className="px-8 py-4 text-center">
                    <span className="text-lg font-black text-slate-900">{lvl.percentage}%</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center space-x-3 p-6 bg-blue-50 border border-blue-100 rounded-3xl">
        <Info size={20} className="text-blue-500 shrink-0" />
        <p className="text-[10px] font-black text-blue-700 uppercase leading-tight">
          Cálculo baseado na política vigente da VEC GROUP. Os valores simulados podem variar de acordo com estornos ou cancelamentos posteriores à ativação das linhas.
        </p>
      </div>
    </div>
  );
};

export default CommissionCalculator;
