
import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  Building, 
  RefreshCw,
  Save,
  Loader2,
  Building2,
  CheckCircle2,
  User as UserIcon,
  CreditCard,
  ShieldAlert,
  PlusCircle
} from 'lucide-react';
import { Lead, LeadStatus, User as AppUser } from '../types';

interface NewLeadModalProps {
  onClose: () => void;
  onSave: (lead: Lead) => void;
  user: AppUser;
  allUsers: AppUser[];
  existingLeads: Lead[];
}

const InputField = ({ label, value, onChange, placeholder, disabled, required, type = "text" }: { label: string, value: string, onChange: (val: string) => void, placeholder?: string, disabled?: boolean, required?: boolean, type?: string }) => (
  <div className="space-y-1.5">
    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block flex items-center">
      {label} {required && <span className="text-red-500 ml-1">*</span>}
    </label>
    <input 
      type={type} 
      value={value || ''} 
      placeholder={placeholder || '-'}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full text-[13px] font-bold text-slate-700 bg-slate-50 border rounded-xl px-4 py-3 focus:bg-white focus:border-blue-300 focus:outline-none transition-all disabled:opacity-50 ${required && !value ? 'border-red-100' : 'border-slate-100'}`}
    />
  </div>
);

const NewLeadModal: React.FC<NewLeadModalProps> = ({ onClose, onSave, user, allUsers, existingLeads }) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [errors, setErrors] = useState<string[]>([]);
  
  const [formData, setFormData] = useState<Partial<Lead>>({
    ELEMENTO: `E${Math.floor(Math.random() * 9000) + 1000}`,
    CNPJ: '',
    razaoSocial: '',
    estado: '',
    DATA_Consulta: new Date().toLocaleDateString('pt-BR'),
    Status: LeadStatus.ENTRAR_CONTATO,
    Vendedor: user.name.toUpperCase(),
    Telefone_Principal: '',
    operadora: 'VIVO',
    ATIVOS: '0',
    DATA_ULTIMO_PEDIDO_NA_VIVO: '',
    NOME: '',
    CELULAR: '',
    EMAIL: '',
    RETORNO_CREDITO_VIVO: '0',
    VALOR_EM_ABERTO_VIVO: '0',
    VALOR_TOTAL_DEBITO_VIVO: '0',
    STATUS_PEDIDO_VIVO: 'Pendente',
    N_ULTIMO_PEDIDO_NA_VIVO: '',
    primaryContactIndex: 1
  });

  const fetchBrasilAPI = async () => {
    const cnpjClean = formData.CNPJ?.replace(/\D/g, '');
    if (!cnpjClean || cnpjClean.length !== 14) {
      alert("Por favor, insira um CNPJ válido de 14 dígitos.");
      return;
    }
    setIsSyncing(true);
    try {
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjClean}`);
      if (!response.ok) throw new Error("CNPJ não encontrado");
      const data = await response.json();
      const telefone = data.ddd_telefone_1 || '';
      setFormData(prev => ({
        ...prev,
        razaoSocial: data.razao_social?.toUpperCase() || prev.razaoSocial,
        estado: data.uf?.toUpperCase().trim() || prev.estado,
        Telefone_Principal: telefone || prev.Telefone_Principal,
        NOME: data.qsa?.[0]?.name?.toUpperCase() || data.razao_social?.toUpperCase() || prev.NOME,
        EMAIL: data.email?.toLowerCase() || prev.EMAIL,
        CELULAR: telefone || prev.CELULAR,
      }));
      alert("Dados sincronizados com sucesso!");
    } catch (error) {
      alert("Erro na sincronização ou CNPJ inexistente.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSave = () => {
    const requiredErrors: string[] = [];
    const cnpjInput = String(formData.CNPJ || '').replace(/\D/g, '');
    const duplicate = existingLeads.find(l => String(l.CNPJ || '').replace(/\D/g, '') === cnpjInput);
    
    if (duplicate) requiredErrors.push(`CLIENTE JÁ CADASTRADO: CNPJ pertence à empresa ${duplicate.razaoSocial}.`);
    if (!formData.razaoSocial) requiredErrors.push("Razão Social é obrigatória.");
    if (!formData.CNPJ) requiredErrors.push("CNPJ/CPF é obrigatório.");
    if (!formData.NOME) requiredErrors.push("Nome do Representante é obrigatório.");
    if (!formData.estado) requiredErrors.push("O Estado (UF) é obrigatório.");

    if (requiredErrors.length > 0) {
      setErrors(requiredErrors);
      return;
    }
    setSaveStatus('saving');
    setTimeout(() => {
      onSave({ ...formData, id: `new-${Date.now()}` } as Lead);
      setSaveStatus('saved');
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 lg:p-8 animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={onClose}></div>
      <div className="bg-white w-full max-w-[1100px] h-full max-h-[92vh] rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col relative z-10 animate-in zoom-in-95">
        <div className="px-10 py-8 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center space-x-5">
            <div className="w-14 h-14 bg-slate-900 text-white rounded-[1.2rem] flex items-center justify-center shadow-xl"><Building2 size={28} /></div>
            <div>
              <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Cadastrar Empresa</h2>
              <p className="text-slate-400 text-xs font-bold mt-0.5 uppercase tracking-widest italic">VEC GROUP API Sincronizada</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
             <button onClick={handleSave} disabled={saveStatus !== 'idle'} className={`flex items-center space-x-3 px-8 py-3.5 rounded-2xl text-[11px] font-black uppercase shadow-xl transition-all ${saveStatus === 'saved' ? 'bg-emerald-500 text-white' : saveStatus === 'saving' ? 'bg-slate-400 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
              {saveStatus === 'saving' ? <Loader2 size={18} className="animate-spin" /> : saveStatus === 'saved' ? <CheckCircle2 size={18} /> : <Save size={18} />}
              <span>{saveStatus === 'saved' ? 'Salvo!' : 'Finalizar Cadastro'}</span>
            </button>
            <button onClick={onClose} className="p-3 bg-slate-50 text-slate-400 hover:text-slate-900 rounded-2xl border border-slate-100"><X size={24} /></button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-10 custom-scrollbar bg-white">
          {errors.length > 0 && (
            <div className="mb-8 bg-red-50 border border-red-200 p-6 rounded-3xl animate-in slide-in-from-top-4">
               {errors.map((err, i) => <p key={i} className="text-xs font-black text-red-600 uppercase leading-tight flex items-center"><ShieldAlert size={12} className="mr-2" /> {err}</p>)}
            </div>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            <div className="lg:col-span-8 space-y-10">
              <div className="bg-emerald-50/30 p-8 rounded-[2rem] border border-emerald-100">
                <div className="flex items-center justify-between mb-8">
                   <div className="flex items-center space-x-3"><div className="w-10 h-10 bg-emerald-500 text-white rounded-xl flex items-center justify-center"><Building size={20} /></div><h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Dados da Empresa</h3></div>
                   <button onClick={fetchBrasilAPI} disabled={isSyncing} className="flex items-center space-x-2 bg-emerald-600 text-white px-5 py-2 rounded-xl text-[10px] font-black uppercase shadow-lg transition-all active:scale-95">
                     {isSyncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                     <span>Sincronizar Brasil API</span>
                   </button>
                </div>
                <div className="grid grid-cols-3 gap-6">
                  <div className="col-span-1"><InputField label="CNPJ / CPF" value={formData.CNPJ || ''} onChange={(v)=>setFormData({...formData, CNPJ: v})} placeholder="Cnpj aqui..." required /></div>
                  <div className="col-span-2"><InputField label="RAZÃO SOCIAL" value={formData.razaoSocial || ''} onChange={(v)=>setFormData({...formData, razaoSocial: v.toUpperCase()})} placeholder="Razão aqui..." required /></div>
                  <InputField label="ESTADO (UF)" value={formData.estado || ''} onChange={(v)=>setFormData({...formData, estado: v.toUpperCase()})} placeholder="UF aqui..." required />
                  <InputField label="TELEFONE PRINCIPAL" value={formData.Telefone_Principal || ''} onChange={(v)=>setFormData({...formData, Telefone_Principal: v})} placeholder="Tel aqui..." />
                  <InputField label="OPERADORA ATUAL" value={formData.operadora || 'VIVO'} onChange={(v)=>setFormData({...formData, operadora: v})} />
                </div>
              </div>
              <div className="bg-blue-50/30 p-8 rounded-[2rem] border border-blue-100">
                 <div className="flex items-center space-x-3 mb-8"><div className="w-10 h-10 bg-blue-500 text-white rounded-xl flex items-center justify-center"><UserIcon size={20} /></div><h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Contato Principal</h3></div>
                 <div className="grid grid-cols-3 gap-6">
                    <InputField label="NOME DO SÓCIO" value={formData.NOME || ''} onChange={(v)=>setFormData({...formData, NOME: v.toUpperCase()})} required />
                    <InputField label="E-MAIL" value={formData.EMAIL || ''} onChange={(v)=>setFormData({...formData, EMAIL: v.toLowerCase()})} />
                    <InputField label="CELULAR" value={formData.CELULAR || ''} onChange={(v)=>setFormData({...formData, CELULAR: v})} />
                 </div>
              </div>
            </div>
            <div className="lg:col-span-4">
              <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white flex flex-col items-center text-center shadow-2xl relative overflow-hidden">
                <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mb-6"><PlusCircle className="text-blue-400" size={32} /></div>
                <h3 className="text-lg font-black uppercase tracking-tighter mb-2">Linhas Ativas</h3>
                <div className="w-full bg-white/5 p-6 rounded-2xl border border-white/10 mt-4">
                   <InputField label="QUANTIDADE" value={formData.ATIVOS || '0'} type="number" onChange={(v)=>setFormData({...formData, ATIVOS: v})} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewLeadModal;
