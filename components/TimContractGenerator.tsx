
import React, { useState, useRef, useEffect } from 'react';
import { 
  ArrowLeft, 
  Building, 
  User as UserIcon, 
  Plus, 
  Trash2, 
  Printer, 
  Upload,
  Loader2,
  Check,
  Briefcase,
  FileText,
  Calendar,
  DollarSign
} from 'lucide-react';
import { User, ContractItem } from '../types';
import { supabase } from '../lib/supabase';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

interface TimContractGeneratorProps {
  user: User;
  allUsers: User[];
  onBack: () => void;
}

const TimContractGenerator: React.FC<TimContractGeneratorProps> = ({ user, allUsers, onBack }) => {
  const [isExporting, setIsExporting] = useState(false);
  const [logo, setLogo] = useState<string | null>(null);
  const logoRef = useRef<HTMLInputElement>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const getLocalDate = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  };

  // Estado dos dados da empresa - Inicialmente vazio para preenchimento manual
  const [companyData, setCompanyData] = useState({
    razaoSocial: '',
    cnpj: ''
  });

  // Estado dos dados do gestor
  const [managerData, setManagerData] = useState({
    name: '', 
    cpf: '', 
    email: '', 
    phone: '', 
    contractDate: getLocalDate(), 
    vencimento: '20'
  });

  // Itens padrão do contrato
  const [items, setItems] = useState<ContractItem[]>([
    { id: '1', type: 'Apar', description: 'IPHONE 15 PROMAX 256G em VF', qty: 1, monthlyPrice: 145.83, devicePrice: 3499.92 },
    { id: '2', type: 'Pacc', description: 'TIM Black Empresa', qty: 1, monthlyPrice: 59.90, devicePrice: 0 }
  ]);

  useEffect(() => {
    loadSavedLogo();
  }, []);

  const loadSavedLogo = async () => {
    const { data } = await supabase.proposals.getContractLogo();
    if (data) setLogo(data);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        setLogo(base64);
        await supabase.proposals.saveContractLogo(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGeneratePDF = async () => {
    if (!printRef.current) return;
    setIsExporting(true);
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pages = printRef.current.children;
      for (let i = 0; i < pages.length; i++) {
        const page = pages[i] as HTMLElement;
        const canvas = await html2canvas(page, { scale: 2, useCORS: true, logging: false });
        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        if (i > 0) pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297);
      }
      pdf.save(`Contrato_TIM_${companyData.razaoSocial.replace(/\s+/g, '_') || 'Gerado'}.pdf`);
    } catch (error) {
      alert("Erro ao gerar PDF.");
    } finally {
      setIsExporting(false);
    }
  };

  const PDFHeader = () => (
    <div className="h-[18mm] bg-[#003399] flex flex-col items-center justify-center relative mb-10 shrink-0">
      <div className="relative z-10 flex items-center justify-center">
        {logo ? (
          <img src={logo} className="max-h-[12mm] max-w-[60mm] object-contain bg-white rounded p-1" />
        ) : (
          <div className="bg-white rounded px-6 py-1 shadow-md"><span className="text-[#003399] text-xl font-black italic">TIM</span></div>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-24">
      {/* Top Header com Botões de Ação */}
      <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
        <div>
          <button onClick={onBack} className="flex items-center space-x-2 text-slate-400 hover:text-slate-900 transition-colors mb-4 group w-fit">
            <ArrowLeft size={16} />
            <span className="text-[10px] font-black uppercase tracking-widest">Ferramentas</span>
          </button>
          <h1 className="text-3xl font-black text-white tracking-tighter uppercase leading-none">TIM Ap. Contrato</h1>
          <p className="text-white/60 text-sm font-medium mt-2">Geração de Termo de Contratação Versão 5.10</p>
        </div>
        <div className="flex items-center space-x-3">
          <input type="file" ref={logoRef} onChange={handleLogoUpload} className="hidden" accept="image/*" />
          <button 
            onClick={() => logoRef.current?.click()}
            className={`flex items-center space-x-2 px-6 py-3 bg-white border rounded-xl text-[10px] font-black uppercase transition-all shadow-sm ${logo ? 'border-emerald-200 text-emerald-600' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
          >
            <Upload size={16} />
            <span>Logotipo do Contrato</span>
            {logo && <Check size={14} className="ml-1" />}
          </button>
          <button 
            disabled={!companyData.razaoSocial || isExporting}
            onClick={handleGeneratePDF}
            className="flex items-center space-x-2 px-8 py-3 bg-blue-700 text-white rounded-xl text-[10px] font-black uppercase hover:bg-blue-800 shadow-xl disabled:opacity-30 active:scale-95 transition-all"
          >
            {isExporting ? <Loader2 size={16} className="animate-spin" /> : <Printer size={16} />}
            <span>Gerar e Visualizar PDF</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Lado Esquerdo - Cadastro Manual */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100 space-y-8 animate-in slide-in-from-left-4">
            {/* Seção Empresa */}
            <div className="space-y-6">
              <div className="flex items-center space-x-3 text-blue-600">
                <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center"><Briefcase size={20} /></div>
                <h3 className="text-sm font-black uppercase tracking-widest">Cadastro da Empresa</h3>
              </div>
              <div className="space-y-5">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Razão Social</label>
                  <input 
                    type="text" 
                    value={companyData.razaoSocial} 
                    onChange={(e) => setCompanyData({...companyData, razaoSocial: e.target.value.toUpperCase()})}
                    placeholder="DIGITE O NOME EMPRESARIAL"
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-xs font-black text-slate-700 focus:bg-white focus:ring-4 focus:ring-blue-50 outline-none transition-all shadow-inner"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">CNPJ do Cliente</label>
                  <input 
                    type="text" 
                    value={companyData.cnpj} 
                    onChange={(e) => setCompanyData({...companyData, cnpj: e.target.value})}
                    placeholder="00.000.000/0000-00"
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-xs font-black text-slate-700 focus:bg-white focus:ring-4 focus:ring-blue-50 outline-none transition-all shadow-inner"
                  />
                </div>
              </div>
            </div>

            <div className="h-px bg-slate-50 w-full"></div>

            {/* Seção Gestor */}
            <div className="space-y-6">
              <div className="flex items-center space-x-3 text-indigo-600">
                <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center"><UserIcon size={20} /></div>
                <h3 className="text-sm font-black uppercase tracking-widest">Informações do Gestor</h3>
              </div>
              <div className="space-y-5">
                <div>
                   <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Nome Completo</label>
                   <input type="text" value={managerData.name} onChange={(e)=>setManagerData({...managerData, name: e.target.value.toUpperCase()})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3 text-xs font-bold text-slate-700 outline-none focus:bg-white transition-all shadow-inner" />
                </div>
                <div>
                   <label className="text-[10px] font-black text-slate-400 uppercase ml-1">CPF do Gestor</label>
                   <input type="text" value={managerData.cpf} onChange={(e)=>setManagerData({...managerData, cpf: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3 text-xs font-bold text-slate-700 outline-none focus:bg-white transition-all shadow-inner" />
                </div>
                <div>
                   <label className="text-[10px] font-black text-slate-400 uppercase ml-1">E-mail para Assinatura</label>
                   <input type="email" value={managerData.email} onChange={(e)=>setManagerData({...managerData, email: e.target.value.toLowerCase()})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3 text-xs font-bold text-slate-700 outline-none focus:bg-white transition-all shadow-inner" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Data</label><input type="date" value={managerData.contractDate} onChange={(e)=>setManagerData({...managerData, contractDate: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold" /></div>
                  <div><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Vencimento</label><input type="text" value={managerData.vencimento} onChange={(e)=>setManagerData({...managerData, vencimento: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold" /></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Lado Direito - Tabela de Itens */}
        <div className="lg:col-span-8">
          <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden animate-in slide-in-from-right-4">
            <div className="p-8 pb-4 border-b border-slate-50 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center shadow-lg"><FileText size={20} /></div>
                <h3 className="text-sm font-black uppercase text-slate-800 tracking-widest">Composição da Oferta</h3>
              </div>
              <button 
                onClick={()=>{setItems([...items, { id: Date.now().toString(), type: 'Pacc', description: '', qty: 1, monthlyPrice: 0, devicePrice: 0 }])}} 
                className="flex items-center space-x-2 bg-blue-50 text-blue-600 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase hover:bg-blue-100 transition-all active:scale-95"
              >
                <Plus size={14} /> <span>Adicionar Item</span>
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50/50">
                    <th className="px-8 py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest w-32">Tipo</th>
                    <th className="px-6 py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Descrição do Serviço/Aparelho</th>
                    <th className="px-4 py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center w-24">Qtd</th>
                    <th className="px-4 py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right w-36">Valor Unitário</th>
                    <th className="w-20"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {items.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50/30 transition-colors">
                      <td className="px-8 py-4">
                        <select 
                          value={item.type} 
                          onChange={(e)=>{setItems(items.map(i=>i.id===item.id?{...i, type:e.target.value as any}:i))}} 
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-[10px] font-black uppercase text-blue-600 focus:ring-2 focus:ring-blue-100 outline-none"
                        >
                          <option value="Apar">Aparelho</option>
                          <option value="Pacc">Plano</option>
                        </select>
                      </td>
                      <td className="px-6 py-4">
                        <input 
                          type="text" 
                          value={item.description} 
                          onChange={(e)=>{setItems(items.map(i=>i.id===item.id?{...i, description:e.target.value}:i))}} 
                          placeholder="Ex: TIM BLACK EMPRESA 30GB"
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs font-black text-slate-700 uppercase outline-none focus:ring-2 focus:ring-blue-100" 
                        />
                      </td>
                      <td className="px-4 py-4">
                        <input 
                          type="number" 
                          value={item.qty} 
                          onChange={(e)=>{setItems(items.map(i=>i.id===item.id?{...i, qty:parseInt(e.target.value)||0}:i))}} 
                          className="w-16 bg-white border border-slate-200 rounded-xl px-2 py-2 text-xs font-black text-center text-slate-900 outline-none" 
                        />
                      </td>
                      <td className="px-4 py-4">
                        <div className="relative">
                           <DollarSign size={10} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                           <input 
                              type="number" 
                              value={item.monthlyPrice} 
                              onChange={(e)=>{setItems(items.map(i=>i.id===item.id?{...i, monthlyPrice:parseFloat(e.target.value)||0}:i))}} 
                              className="w-full bg-white border border-slate-200 rounded-xl pl-6 pr-2 py-2 text-xs font-black text-right text-emerald-600 outline-none" 
                           />
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <button onClick={()=>{setItems(items.filter(i=>i.id!==item.id))}} className="p-2 text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
                      </td>
                    </tr>
                  ))}
                  {items.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-20 text-center text-slate-300 font-bold uppercase text-[10px] tracking-widest">Nenhum item na lista</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* ÁREA OCULTA PARA PDF (GERAÇÃO) */}
      <div className="fixed top-[-9999px] left-[-9999px]">
        <div ref={printRef} className="flex flex-col">
          <div className="w-[210mm] h-[297mm] bg-white p-[20mm] flex flex-col border border-slate-100">
            <PDFHeader />
            <h1 className="text-center text-xl font-black mb-8 uppercase tracking-widest text-[#003399]">Termo de Contratação - Versão 5.10</h1>
            
            <div className="border border-slate-900 p-6 space-y-4 text-xs mb-8 rounded">
              <p className="font-black uppercase text-sm border-b border-slate-900 pb-2 mb-2">1. Identificação da Empresa Contratante</p>
              <div className="grid grid-cols-2 gap-y-4 gap-x-8">
                <p><span className="font-black">RAZÃO SOCIAL:</span> {companyData.razaoSocial || '---'}</p>
                <p><span className="font-black">CNPJ:</span> {companyData.cnpj || '---'}</p>
                <p><span className="font-black">GESTOR RESPONSÁVEL:</span> {managerData.name || '---'}</p>
                <p><span className="font-black">CPF:</span> {managerData.cpf || '---'}</p>
                <p><span className="font-black">EMAIL:</span> {managerData.email || '---'}</p>
                <p><span className="font-black">DATA DE EMISSÃO:</span> {managerData.contractDate}</p>
              </div>
            </div>

            <div className="space-y-1">
              <p className="font-black uppercase text-xs mb-3">2. Itens e Planos Contratados</p>
              <table className="w-full border-collapse border border-slate-900 text-[10px]">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="border border-slate-900 p-3 text-left">TIPO</th>
                    <th className="border border-slate-900 p-3 text-left">DESCRIÇÃO DETALHADA</th>
                    <th className="border border-slate-900 p-3 text-center w-20">QTD</th>
                    <th className="border border-slate-900 p-3 text-right w-32">VALOR</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={idx} className="uppercase">
                      <td className="border border-slate-900 p-3 font-black">{item.type}</td>
                      <td className="border border-slate-900 p-3">{item.description}</td>
                      <td className="border border-slate-900 p-3 text-center">{item.qty}</td>
                      <td className="border border-slate-900 p-3 text-right font-black">R$ {item.monthlyPrice.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-auto pt-20">
              <div className="flex justify-between items-end">
                <div className="space-y-4">
                  <div className="w-80 h-px bg-slate-900 mb-2"></div>
                  <p className="text-[10px] font-black uppercase">{managerData.name || 'ASSINATURA DO CLIENTE'}</p>
                  <p className="text-[8px] text-slate-500">Documento assinado eletronicamente via VEC GROUP CRM</p>
                </div>
                <div className="text-right border-l border-slate-100 pl-8">
                  <p className="text-[10px] font-black text-[#003399]">Consultor Responsável: {user.name.toUpperCase()}</p>
                  <p className="text-[8px] text-slate-400 mt-1">Identificador Único: {Math.random().toString(36).substr(2, 9).toUpperCase()}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimContractGenerator;
