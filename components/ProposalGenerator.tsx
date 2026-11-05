
import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Download, 
  FileText, 
  Plus, 
  Trash2, 
  Building, 
  User as UserIcon, 
  Phone, 
  Globe, 
  Mail, 
  Image as ImageIcon,
  Upload,
  ChevronRight,
  FileSpreadsheet,
  CheckCircle2,
  Zap,
  Loader2,
  Save
} from 'lucide-react';
import { Lead, User, ProposalItem, ProposalSettings } from '../types';
import { supabase } from '../lib/supabase';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

interface ProposalGeneratorProps {
  lead: Lead;
  onClose: () => void;
  currentUser: User;
}

const ProposalGenerator: React.FC<ProposalGeneratorProps> = ({ lead, onClose, currentUser }) => {
  const [items, setItems] = useState<ProposalItem[]>([
    { id: '1', name: 'TIM BLACK EMPRESA 30GB', description: 'REDES SOCIAIS ILIMITADAS + APPS DE GESTÃO', qty: 6, unitValue: 49.90 },
    { id: '2', name: 'TIM Office', description: 'Voz Ilimitada + Internet Dedicada', qty: 0, unitValue: 0 },
    { id: '3', name: 'Dados Móveis/IOT', description: 'Gestão de frotas e telemetria', qty: 0, unitValue: 0 }
  ]);

  const [settings, setSettings] = useState<ProposalSettings>({
    prestadoraName: 'TIM S.A.',
    contatoEmail: 'NEGOCIOS@TIM.COM.BR',
    contatoSite: 'TIM.COM.BR',
    logo: ''
  });

  const [isExporting, setIsExporting] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const proposalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const { data } = await supabase.proposals.getSettings();
    if (data) setSettings(data);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1.5 * 1024 * 1024) {
        alert("A logo deve ter no máximo 1.5MB");
        return;
      }
      setIsSavingSettings(true);
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        const newSettings = { ...settings, logo: base64 };
        setSettings(newSettings);
        await supabase.proposals.saveSettings(newSettings);
        setIsSavingSettings(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const updateSettings = (field: keyof ProposalSettings, value: string) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  const saveSettings = async () => {
    setIsSavingSettings(true);
    try {
      await supabase.proposals.saveSettings(settings);
    } finally {
      setIsSavingSettings(false);
    }
  };

  const updateItem = (id: string, field: keyof ProposalItem, value: any) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const addNewItem = () => {
    const newItem: ProposalItem = {
      id: Date.now().toString(),
      name: 'NOVO ITEM',
      description: 'DESCRIÇÃO DO SERVIÇO',
      qty: 1,
      unitValue: 0
    };
    setItems(prev => [...prev, newItem]);
  };

  const removeItem = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const totalLines = items.reduce((acc, curr) => acc + (curr.qty || 0), 0);
  const totalMonthly = items.reduce((acc, curr) => acc + (curr.qty * curr.unitValue), 0);

  const handleDownloadJPG = async () => {
    if (!proposalRef.current) return;
    setIsExporting(true);
    try {
      const canvas = await html2canvas(proposalRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });
      const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
      const link = document.createElement('a');
      link.download = `proposta_${lead.razaoSocial.replace(/\s+/g, '_').toLowerCase()}.jpg`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      alert("Erro ao gerar imagem.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!proposalRef.current) return;
    setIsExporting(true);
    try {
      const canvas = await html2canvas(proposalRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`proposta_${lead.razaoSocial.replace(/\s+/g, '_').toLowerCase()}.pdf`);
    } catch (error) {
      alert("Erro ao gerar PDF.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4 lg:p-6 animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-[1450px] h-full max-h-[96vh] rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col relative animate-in zoom-in-95">
        
        {/* Top Header Bar */}
        <div className="px-10 py-5 bg-white border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
             <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shadow-sm">
                <FileText size={20} />
             </div>
             <div>
                <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">Gerador de Proposta</h2>
                {isSavingSettings && <p className="text-[8px] font-black text-emerald-500 uppercase animate-pulse">Salvando configurações no banco...</p>}
             </div>
          </div>
          <div className="flex items-center space-x-3">
             <button 
              disabled={isExporting}
              onClick={handleDownloadJPG}
              className="flex items-center space-x-2 px-5 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase transition-all border border-slate-100 disabled:opacity-50"
             >
                {isExporting ? <Loader2 size={14} className="animate-spin" /> : <ImageIcon size={14} />}
                <span>Baixar JPG</span>
             </button>
             <button 
              disabled={isExporting}
              onClick={handleDownloadPDF}
              className="flex items-center space-x-2 px-6 py-2.5 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-[10px] font-black uppercase shadow-lg shadow-blue-200 transition-all active:scale-95 disabled:opacity-50"
             >
                {isExporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                <span>Gerar PDF (A4)</span>
             </button>
             <button onClick={onClose} className="p-2.5 bg-slate-50 text-slate-400 hover:text-slate-900 rounded-xl transition-all border border-slate-100 ml-4"><X size={20} /></button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar - Configurações */}
          <div className="w-[380px] bg-[#fcfdfe] border-r border-slate-100 flex flex-col overflow-y-auto custom-scrollbar p-10 space-y-10">
            
            {/* Identidade Visual */}
            <div className="space-y-4">
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center space-x-2">
                 <ImageIcon size={12} /> <span>Logotipo da Proposta</span>
               </label>
               <input type="file" ref={logoInputRef} onChange={handleLogoUpload} className="hidden" accept="image/*" />
               <div 
                onClick={() => logoInputRef.current?.click()}
                className="w-full h-32 bg-white border-2 border-dashed border-slate-200 rounded-[1.5rem] flex items-center justify-center cursor-pointer hover:border-blue-300 hover:bg-blue-50/30 transition-all group overflow-hidden relative"
               >
                 {settings.logo ? (
                   <>
                    <img src={settings.logo} className="max-h-24 max-w-[85%] object-contain" alt="Logo" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                       <Upload size={20} />
                    </div>
                   </>
                 ) : (
                   <div className="flex flex-col items-center text-slate-300 group-hover:text-blue-400">
                     <Upload size={32} className="mb-2" />
                     <span className="text-[10px] font-black uppercase tracking-widest text-center px-4">Clique para salvar logo permanente</span>
                   </div>
                 )}
               </div>
            </div>

            {/* Configuração Prestadora */}
            <div className="space-y-6">
               <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Dados da Prestadora</label>
                  <button 
                    onClick={saveSettings}
                    disabled={isSavingSettings}
                    className="flex items-center space-x-1 text-[10px] font-black text-blue-600 hover:text-blue-700 uppercase tracking-widest transition-colors disabled:opacity-50"
                  >
                    {isSavingSettings ? <Loader2 size={10} className="animate-spin" /> : <Save size={10} />}
                    <span>{isSavingSettings ? 'Salvando...' : 'Salvar'}</span>
                  </button>
               </div>
               <div className="space-y-4">
                  <div className="space-y-1.5">
                     <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Nome Fantasia / Empresa</label>
                     <input 
                        type="text" 
                        value={settings.prestadoraName} 
                        onChange={(e) => updateSettings('prestadoraName', e.target.value.toUpperCase())}
                        className="w-full bg-white border border-slate-100 rounded-xl px-4 py-3 text-[11px] font-black text-slate-900 focus:ring-2 focus:ring-blue-100 outline-none" 
                     />
                  </div>
                  <div className="space-y-1.5">
                     <label className="text-[9px] font-black text-slate-400 uppercase ml-1">E-mail Comercial</label>
                     <input 
                        type="text" 
                        value={settings.contatoEmail} 
                        onChange={(e) => updateSettings('contatoEmail', e.target.value.toUpperCase())}
                        className="w-full bg-white border border-slate-100 rounded-xl px-4 py-3 text-[11px] font-black text-slate-900 focus:ring-2 focus:ring-blue-100 outline-none" 
                     />
                  </div>
                  <div className="space-y-1.5">
                     <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Site Institucional</label>
                     <input 
                        type="text" 
                        value={settings.contatoSite} 
                        onChange={(e) => updateSettings('contatoSite', e.target.value.toUpperCase())}
                        className="w-full bg-white border border-slate-100 rounded-xl px-4 py-3 text-[11px] font-black text-slate-900 focus:ring-2 focus:ring-blue-100 outline-none" 
                     />
                  </div>
               </div>
            </div>

            {/* Itens da Proposta */}
            <div className="space-y-6 flex-1">
               <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Soluções do Contrato</label>
                  <button onClick={addNewItem} className="p-2 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-all"><Plus size={14} /></button>
               </div>
               
               <div className="space-y-4">
                  {items.map((item) => (
                    <div key={item.id} className="bg-white border border-slate-100 p-5 rounded-2xl shadow-sm space-y-4 group">
                       <div className="flex justify-between items-start">
                          <input 
                            type="text" 
                            value={item.name} 
                            onChange={(e) => updateItem(item.id, 'name', e.target.value)}
                            className="text-[11px] font-black text-slate-900 uppercase w-full bg-transparent focus:outline-none" 
                          />
                          <button onClick={() => removeItem(item.id)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={12} /></button>
                       </div>
                       <input 
                          type="text" 
                          value={item.description} 
                          onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                          className="text-[9px] font-bold text-slate-400 uppercase w-full bg-transparent focus:outline-none -mt-2" 
                          placeholder="Descrição técnica..."
                       />
                       <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                             <p className="text-[8px] font-black text-slate-400 uppercase">QTD</p>
                             <input 
                                type="number" 
                                value={item.qty} 
                                onChange={(e) => updateItem(item.id, 'qty', parseInt(e.target.value) || 0)}
                                className="w-full bg-slate-50 border border-slate-100 rounded-lg px-3 py-1.5 text-[11px] font-black text-slate-700 focus:outline-none" 
                             />
                          </div>
                          <div className="space-y-1">
                             <p className="text-[8px] font-black text-slate-400 uppercase">Valor Unit.</p>
                             <input 
                                type="number" 
                                value={item.unitValue} 
                                onChange={(e) => updateItem(item.id, 'unitValue', parseFloat(e.target.value) || 0)}
                                className="w-full bg-slate-50 border border-slate-100 rounded-lg px-3 py-1.5 text-[11px] font-black text-slate-700 focus:outline-none" 
                             />
                          </div>
                       </div>
                    </div>
                  ))}
               </div>
            </div>
          </div>

          {/* Preview da Proposta (Folha A4) */}
          <div className="flex-1 bg-slate-100/50 flex flex-col items-center p-12 overflow-y-auto custom-scrollbar">
             <div ref={proposalRef} className="w-[850px] bg-white shadow-2xl rounded-sm flex flex-col min-h-[1150px] animate-in fade-in duration-700 origin-top shrink-0">
                
                {/* PDF Header */}
                <div className="h-32 bg-[#003399] flex items-center justify-between px-16 relative overflow-hidden shrink-0">
                   <div className="absolute top-0 right-0 w-[450px] h-full bg-[#002266] -skew-x-[25deg] translate-x-32"></div>
                   <div className="relative z-10 w-40 h-20 bg-white rounded-xl flex items-center justify-center p-3 shadow-xl">
                      {settings.logo ? (
                        <img src={settings.logo} className="max-h-full max-w-full object-contain" alt="Logo" />
                      ) : (
                        <div className="flex flex-col items-center opacity-20">
                           <ImageIcon size={24} />
                           <span className="text-[8px] font-black uppercase">VEC LOGO</span>
                        </div>
                      )}
                   </div>
                   <div className="relative z-10 text-right">
                      <h1 className="text-4xl font-black text-white tracking-tighter italic">PROPOSTA</h1>
                      <p className="text-sm font-bold text-blue-200 uppercase tracking-[0.3em] mt-1">COMERCIAL</p>
                   </div>
                </div>
                
                {/* Content */}
                <div className="flex-1 p-16 space-y-14">
                   <div className="grid grid-cols-2 gap-16 border-b border-slate-100 pb-12">
                      <div className="space-y-6">
                         <div className="flex items-center space-x-3 border-l-4 border-red-500 pl-4">
                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest italic">Dados do Cliente</h3>
                         </div>
                         <div className="space-y-3">
                            <div className="flex text-[11px] uppercase"><span className="w-24 font-black text-slate-400">Empresa</span><span className="font-black text-blue-900">{lead.razaoSocial}</span></div>
                            <div className="flex text-[11px] uppercase"><span className="w-24 font-black text-slate-400">CNPJ</span><span className="font-bold text-blue-900">{lead.CNPJ}</span></div>
                            <div className="flex text-[11px] uppercase"><span className="w-24 font-black text-slate-400">Gestor</span><span className="font-bold text-blue-900">{lead.NOME || 'A/C REPRESENTANTE'}</span></div>
                            <div className="flex text-[11px] uppercase"><span className="w-24 font-black text-slate-400">Telefone</span><span className="font-bold text-blue-900">{lead.Telefone_Principal || '--'}</span></div>
                         </div>
                      </div>
                      <div className="space-y-6">
                         <div className="flex items-center space-x-3 border-l-4 border-blue-600 pl-4">
                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest italic">Prestadora</h3>
                         </div>
                         <div className="space-y-3">
                            <div className="flex text-[11px] uppercase"><span className="w-24 font-black text-slate-400">Contratada</span><span className="font-black text-blue-900">{settings.prestadoraName}</span></div>
                            <div className="flex text-[11px] uppercase"><span className="w-24 font-black text-slate-400">Consultor</span><span className="font-bold text-blue-900">{currentUser.name}</span></div>
                            <div className="flex text-[11px] uppercase"><span className="w-24 font-black text-slate-400">Contato</span><span className="font-bold text-blue-900">{currentUser.phone || '11960824002'}</span></div>
                         </div>
                      </div>
                   </div>

                   <div className="space-y-8">
                      <div className="flex items-center justify-between">
                         <h3 className="text-base font-black text-slate-900 uppercase tracking-widest italic">Soluções Propostas</h3>
                      </div>
                      <div className="rounded-2xl overflow-hidden border border-slate-100 shadow-sm">
                         <table className="w-full text-left">
                            <thead className="bg-[#003399] text-white">
                               <tr>
                                  <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-center w-20">Qtd</th>
                                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest">Serviço & Benefícios</th>
                                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-right">Unitário</th>
                                  <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-right">Total Mês</th>
                               </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                               {items.filter(i => i.qty > 0).map((item) => (
                                 <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-8 py-6 text-center font-black text-blue-900 text-2xl">{item.qty.toString().padStart(2, '0')}</td>
                                    <td className="px-6 py-6">
                                       <p className="text-sm font-black text-slate-900 uppercase">{item.name}</p>
                                       <p className="text-[10px] font-bold text-slate-400 uppercase mt-1 flex items-center">
                                          <span className="w-2 h-2 rounded-full bg-red-500 mr-2" />
                                          {item.description}
                                       </p>
                                    </td>
                                    <td className="px-6 py-6 text-right text-[11px] font-black text-slate-400 uppercase">R$ {item.unitValue.toFixed(2)}</td>
                                    <td className="px-8 py-6 text-right font-black text-blue-900 text-lg">R$ {(item.qty * item.unitValue).toFixed(2)}</td>
                                 </tr>
                               ))}
                               {items.filter(i => i.qty > 0).length === 0 && (
                                 <tr><td colSpan={4} className="py-20 text-center text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">Adicione itens para visualizar</td></tr>
                               )}
                            </tbody>
                         </table>
                      </div>
                   </div>
                </div>

                {/* PDF Footer Info */}
                <div className="px-16 pb-16 space-y-12 shrink-0">
                   <div className="h-32 bg-gradient-to-r from-[#003399] to-[#002266] rounded-[2.5rem] flex items-center justify-between px-12 text-white shadow-2xl relative overflow-hidden group">
                      <div className="absolute top-0 right-0 w-64 h-full bg-white/5 skew-x-[35deg] translate-x-32 group-hover:translate-x-10 transition-all duration-700"></div>
                      <div className="space-y-1 relative z-10">
                         <p className="text-[10px] font-black uppercase text-blue-300 tracking-widest">Ativos Totais</p>
                         <h4 className="text-4xl font-black">{totalLines.toString().padStart(2, '0')} <span className="text-sm font-bold opacity-40 uppercase ml-1">Contas</span></h4>
                      </div>
                      <div className="text-right space-y-1 relative z-10">
                         <p className="text-[10px] font-black uppercase text-blue-300 tracking-widest">Investimento Mensal</p>
                         <h4 className="text-4xl font-black"><span className="text-lg font-bold opacity-30 mr-2">R$</span>{totalMonthly.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h4>
                      </div>
                   </div>

                   <div className="flex items-start justify-between">
                      <div className="max-w-[450px]">
                         <p className="text-[9px] text-slate-400 font-medium leading-relaxed uppercase italic">
                            Oferta sujeita a análise de crédito e disponibilidade técnica no endereço.<br />
                            Planos corporativos com tecnologia de ponta e suporte dedicado.
                         </p>
                      </div>
                      <div className="text-right">
                         <p className="text-[10px] font-black text-slate-900 uppercase italic">VEC GROUP COMERCIAL</p>
                         <div className="h-1 w-12 bg-red-600 ml-auto mt-2 rounded-full" />
                      </div>
                   </div>

                   <div className="pt-10 border-t border-slate-100 flex items-center justify-between">
                      <div className="flex items-center space-x-8">
                         <div className="flex items-center space-x-2">
                            <Globe size={12} className="text-blue-600" />
                            <span className="text-[9px] font-black text-slate-500 uppercase">{settings.contatoSite}</span>
                         </div>
                         <div className="flex items-center space-x-2">
                            <Mail size={12} className="text-blue-600" />
                            <span className="text-[9px] font-black text-slate-500 uppercase">{settings.contatoEmail}</span>
                         </div>
                      </div>
                      <div className="flex items-center space-x-6 text-[9px] font-black text-slate-400 uppercase">
                         <div className="flex flex-col"><span className="text-[7px] text-slate-300">EMISSÃO</span><span>{new Date().toLocaleDateString('pt-BR')}</span></div>
                         <div className="flex flex-col"><span className="text-[7px] text-slate-300">VALIDADE</span><span>7 DIAS</span></div>
                      </div>
                   </div>
                </div>

             </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ProposalGenerator;
