
import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Plus, 
  Smartphone, 
  Pencil, 
  Trash2, 
  AlertTriangle, 
  Ban, 
  CheckCircle2, 
  XCircle, 
  ChevronDown,
  User as UserIcon,
  Phone,
  RefreshCw
} from 'lucide-react';
import { User, ChipDevice, ChipLine, ChipStatus } from '../types';
// Removed incorrect MOCK_USERS import
import { supabase } from '../lib/supabase';

interface ChipControlProps {
  user: User;
  // Added allUsers to props
  allUsers: User[];
  onBack: () => void;
}

const STATUS_CONFIG: Record<ChipStatus, { bg: string, text: string, icon: React.ReactNode, border: string }> = {
  [ChipStatus.MATURANDO]: { 
    bg: 'bg-yellow-50', 
    text: 'text-yellow-700', 
    border: 'border-yellow-200',
    icon: <AlertTriangle size={14} className="text-yellow-600" /> 
  },
  [ChipStatus.BANIDO]: { 
    bg: 'bg-red-50', 
    text: 'text-red-700', 
    border: 'border-red-200',
    icon: <Ban size={14} className="text-red-600" /> 
  },
  [ChipStatus.ATIVO]: { 
    bg: 'bg-emerald-50', 
    text: 'text-emerald-700', 
    border: 'border-emerald-200',
    icon: <CheckCircle2 size={14} className="text-emerald-600" /> 
  },
  [ChipStatus.CANCELADO]: { 
    bg: 'bg-slate-50', 
    text: 'text-slate-500', 
    border: 'border-slate-200',
    icon: <XCircle size={14} className="text-slate-400" /> 
  },
};

const ChipControl: React.FC<ChipControlProps> = ({ user, allUsers, onBack }) => {
  const [devices, setDevices] = useState<ChipDevice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('ChipControl rendered');
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      console.log('Fetching chip devices...');
      const { data, error } = await supabase.chips.getDevices();
      if (error) {
        console.error('Error fetching chip devices:', error);
        alert(`Erro ao buscar dispositivos: ${error.message}`);
      } else {
        console.log('Fetched chip devices:', data);
        if (data) setDevices(data);
      }
    } catch (err: any) {
      console.error('Unexpected error in loadData:', err);
      alert(`Erro inesperado: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const saveToSupabase = async (updatedDevices: ChipDevice[]) => {
    setDevices(updatedDevices);
    await supabase.chips.saveDevices(updatedDevices);
  };

  const handleAddDevice = () => {
    const newDevice: ChipDevice = {
      id: `dev-${Date.now()}`,
      name: `Aparelho ${devices.length + 1}`,
      lines: []
    };
    saveToSupabase([...devices, newDevice]);
  };

  const handleDeleteDevice = (id: string) => {
    if (confirm("Deseja excluir este aparelho e todas as suas linhas?")) {
      saveToSupabase(devices.filter(d => d.id !== id));
    }
  };

  const handleRenameDevice = (id: string) => {
    const device = devices.find(d => d.id === id);
    if (!device) return;
    const newName = prompt("Digite o novo nome do aparelho:", device.name);
    if (newName && newName.trim()) {
      saveToSupabase(devices.map(d => d.id === id ? { ...d, name: newName.trim() } : d));
    }
  };

  const handleAddLine = (deviceId: string) => {
    const newLine: ChipLine = {
      id: `line-${Date.now()}`,
      status: ChipStatus.MATURANDO,
      number: '',
      name: '',
      vendedor: ''
    };
    saveToSupabase(devices.map(d => d.id === deviceId ? { ...d, lines: [...d.lines, newLine] } : d));
  };

  const handleUpdateLine = (deviceId: string, lineId: string, updates: Partial<ChipLine>) => {
    saveToSupabase(devices.map(d => {
      if (d.id === deviceId) {
        return {
          ...d,
          lines: d.lines.map(l => l.id === lineId ? { ...l, ...updates } : l)
        };
      }
      return d;
    }));
  };

  const handleDeleteLine = (deviceId: string, lineId: string) => {
    if (confirm("Deseja excluir esta linha?")) {
      saveToSupabase(devices.map(d => {
        if (d.id === deviceId) {
          return { ...d, lines: d.lines.filter(l => l.id !== lineId) };
        }
        return d;
      }));
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-24">
      <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
        <div className="flex flex-col">
          <button onClick={onBack} className="flex items-center space-x-2 text-slate-400 hover:text-slate-900 transition-colors mb-4 group w-fit">
            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
            <span className="text-[10px] font-black uppercase tracking-widest">Voltar para Ferramentas</span>
          </button>
          <div className="flex items-center space-x-4">
             <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center border border-blue-100 shadow-sm"><Smartphone size={24} /></div>
             <div>
                <h1 className="text-3xl font-black text-white tracking-tighter uppercase leading-none">Controle de Chip</h1>
                <p className="text-white/60 text-sm font-medium mt-1">Gerencie chips, status de aquecimento e atribuições por aparelho.</p>
             </div>
          </div>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center space-x-2 px-6 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-[10px] uppercase hover:bg-slate-200 transition-all active:scale-95 disabled:opacity-50"
          >
            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
            <span>Atualizar</span>
          </button>
          <button 
            onClick={handleAddDevice}
            className="flex items-center space-x-2 px-8 py-4 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase hover:bg-blue-700 shadow-xl transition-all active:scale-95"
          >
            <Plus size={18} />
            <span>Novo Aparelho</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {devices.map((device) => (
          <div key={device.id} className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden flex flex-col h-fit">
             <div className="p-8 pb-4 flex items-center justify-between border-b border-slate-50">
                <div className="flex items-center space-x-3">
                   <Smartphone size={18} className="text-slate-400" />
                   <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">{device.name}</h3>
                </div>
                <div className="flex items-center space-x-1">
                   <button onClick={() => handleRenameDevice(device.id)} className="p-2 text-slate-300 hover:text-blue-500 transition-colors"><Pencil size={14} /></button>
                   <button onClick={() => handleDeleteDevice(device.id)} className="p-2 text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
                </div>
             </div>

             <div className="p-6 space-y-6 flex-1">
                {device.lines.map((line) => {
                  const cfg = STATUS_CONFIG[line.status];
                  return (
                    <div key={line.id} className="bg-slate-50/50 rounded-[2rem] border border-slate-100 p-6 space-y-5 relative group/line">
                       <button 
                        onClick={() => handleDeleteLine(device.id, line.id)}
                        className="absolute -top-2 -right-2 w-8 h-8 bg-white border border-slate-100 text-slate-300 hover:text-red-500 rounded-full shadow-sm flex items-center justify-center opacity-0 group-hover/line:opacity-100 transition-all"
                       >
                         <XCircle size={16} />
                       </button>

                       <div className="space-y-1.5">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Status</label>
                          <div className="relative group/status">
                             <div className={`w-full ${cfg.bg} ${cfg.text} ${cfg.border} border rounded-xl px-4 py-2.5 text-[10px] font-black uppercase flex items-center justify-between cursor-pointer transition-all`}>
                                <div className="flex items-center space-x-2">
                                   {cfg.icon}
                                   <span>{line.status}</span>
                                </div>
                                <ChevronDown size={14} className="opacity-40" />
                             </div>
                             
                             <div className="absolute top-full left-0 right-0 mt-1 hidden group-hover/status:block z-20 bg-white rounded-xl shadow-2xl border border-slate-100 overflow-hidden py-1">
                                {Object.values(ChipStatus).map((s) => (
                                  <button 
                                    key={s}
                                    onClick={() => handleUpdateLine(device.id, line.id, { status: s })}
                                    className={`w-full text-left px-4 py-2 text-[10px] font-black uppercase flex items-center space-x-2 hover:bg-slate-50 transition-colors ${line.status === s ? 'text-blue-600 bg-blue-50/50' : 'text-slate-600'}`}
                                  >
                                    {STATUS_CONFIG[s].icon}
                                    <span>{s}</span>
                                  </button>
                                ))}
                             </div>
                          </div>
                       </div>

                       <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                             <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center space-x-1">
                               <Phone size={10} /> <span>Número</span>
                             </label>
                             <input 
                                type="text" 
                                value={line.number} 
                                placeholder="(XX) 9..."
                                onChange={(e) => handleUpdateLine(device.id, line.id, { number: e.target.value })}
                                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100"
                             />
                          </div>
                          <div className="space-y-1.5">
                             <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center space-x-1">
                               <UserIcon size={10} /> <span>Nome</span>
                             </label>
                             <input 
                                type="text" 
                                value={line.name} 
                                placeholder="Apelido/Nome"
                                onChange={(e) => handleUpdateLine(device.id, line.id, { name: e.target.value })}
                                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100"
                             />
                          </div>
                       </div>

                       <div className="space-y-1.5">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Vendedor</label>
                          <div className="relative">
                             <select 
                                value={line.vendedor}
                                onChange={(e) => handleUpdateLine(device.id, line.id, { vendedor: e.target.value })}
                                className="w-full appearance-none bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100"
                             >
                                <option value="">Selecionar Vendedor</option>
                                {/* Replaced MOCK_USERS with allUsers */}
                                {allUsers.map((u, idx) => (
                                  <option key={`${u.id || u.name}-${idx}`} value={u.name}>{u.name}</option>
                                ))}
                             </select>
                             <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
                          </div>
                       </div>
                    </div>
                  );
                })}

                {device.lines.length === 0 && (
                   <div className="py-12 flex flex-col items-center justify-center opacity-20">
                      <Smartphone size={40} className="mb-2" />
                      <p className="text-[10px] font-black uppercase tracking-widest">Nenhuma linha neste aparelho</p>
                   </div>
                )}
             </div>

             <div className="p-6 pt-0">
                <button 
                  onClick={() => handleAddLine(device.id)}
                  className="w-full py-4 border-2 border-dashed border-slate-200 rounded-2xl flex items-center justify-center space-x-2 text-[10px] font-black uppercase text-slate-400 hover:border-blue-300 hover:text-blue-500 hover:bg-blue-50/50 transition-all group"
                >
                   <Plus size={16} className="group-hover:scale-110 transition-transform" />
                   <span>Adicionar Linha</span>
                </button>
             </div>
          </div>
        ))}

        {devices.length === 0 && !loading && (
          <div className="col-span-full py-32 flex flex-col items-center justify-center text-center">
             <div className="w-24 h-24 bg-slate-50 rounded-[2.5rem] flex items-center justify-center mb-6 shadow-inner">
                <Smartphone size={48} className="text-slate-200" />
             </div>
             <h3 className="text-xl font-black text-slate-400 uppercase tracking-tighter">Nenhum Aparelho Cadastrado</h3>
             <p className="text-slate-300 text-sm font-medium mt-2">Clique no botão "Novo Aparelho" para iniciar o controle.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChipControl;
