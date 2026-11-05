
import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  Building, 
  FileCheck, 
  Upload, 
  Smartphone, 
  DollarSign, 
  CheckCircle2, 
  Save, 
  Loader2, 
  FileSpreadsheet,
  Paperclip,
  Trash2,
  AlertCircle,
  FileText,
  ShieldCheck,
  ChevronRight,
  PlusCircle,
  Copy,
  Zap,
  Calendar,
  RefreshCw,
  AlertTriangle,
  ShieldAlert
} from 'lucide-react';
import { Lead, LeadStatus, User, LineDetail, Attachment } from '../types';

declare const XLSX: any;

interface LeadClosingModalProps {
  lead: Lead;
  onClose: () => void;
  onConfirm: (finalLead: Lead) => void;
  user: User;
}

const OPERATORS = [
  { id: 'TIM', color: 'bg-[#003399] text-white border-[#003399]', label: 'TIM' },
  { id: 'VIVO', color: 'bg-[#660099] text-white border-[#660099]', label: 'VIVO' },
  { id: 'CLARO', color: 'bg-[#ee1d23] text-white border-[#ee1d23]', label: 'CLARO' },
  { id: 'OUTRA', color: 'bg-slate-500 text-white border-slate-500', label: 'OUTRA' }
];

const LeadClosingModal: React.FC<LeadClosingModalProps> = ({ lead, onClose, onConfirm, user }) => {
  const getAutoRenewalDate = () => {
    const d = new Date();
    d.setMonth(d.getMonth() + 18);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [editableLead, setEditableLead] = useState<Lead>({ 
    ...lead, 
    Status: LeadStatus.FECHADO,
    operadora: '', 
    dataFechamento: new Date().toLocaleDateString('pt-BR'),
    dataRenovacao: lead.dataRenovacao || getAutoRenewalDate()
  });

  const [checkoutAttachments, setCheckoutAttachments] = useState<Attachment[]>([]);
  const [isParsingExcel, setIsParsingExcel] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  const [errorModal, setErrorModal] = useState<{show: boolean, title: string, message: string}>({
    show: false,
    title: '',
    message: ''
  });

  const excelRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const showAlert = (title: string, message: string) => {
    setErrorModal({ show: true, title, message });
  };

  const handleInputChange = (field: keyof Lead, value: any) => {
    setEditableLead(prev => ({ ...prev, [field]: value }));
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsParsingExcel(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: "" });
        
        const parsePrice = (val: any) => {
          if (typeof val === 'number') return val;
          return parseFloat(String(val || '0').replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.')) || 0;
        };

        const existingLines = editableLead.linhasDetalhas || [];
        const uniqueIncomingLines: LineDetail[] = [];

        jsonData.forEach((row: any) => {
          const rawPhone = String(row['Telefone'] || row['TEL'] || "");
          if (!rawPhone) return;

          uniqueIncomingLines.push({
            telefone: rawPhone,
            plano: String(row['DescricaoPlano'] || row['PLANO'] || "PLANO FECHADO"),
            valor: parsePrice(row['ValorReceita'] || row['VALOR']),
            idLinha: String(row['IdLinha'] || ""),
            aging: String(row['AgingM'] || ""),
            conta: String(row['NRConta'] || "")
          });
        });

        const updatedLines = [...existingLines, ...uniqueIncomingLines];

        setEditableLead(prev => ({
          ...prev,
          linhasDetalhas: updatedLines,
          ATIVOS: updatedLines.length.toString(),
          valorTotalReceita: updatedLines.reduce((acc, curr) => acc + curr.valor, 0)
        }));
      } catch (err) {
        showAlert("ERRO NO ARQUIVO", "O formato do Excel não é suportado.");
      } finally {
        setIsParsingExcel(false);
        if (excelRef.current) excelRef.current.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setIsUploading(true);
      const newFiles: Attachment[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
        newFiles.push({
          id: Math.random().toString(36).substr(2, 9),
          name: file.name.toUpperCase(),
          url: base64,
          type: file.type,
          size: (file.size / 1024 / 1024).toFixed(2) + ' MB',
          createdAt: new Date().toLocaleString('pt-BR')
        });
      }
      setCheckoutAttachments(prev => [...prev, ...newFiles]);
      setIsUploading(false);
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  const addManualLine = () => {
    const newLine: LineDetail = { telefone: '', plano: 'NOVA LINHA FECHADA', valor: 0, idLinha: '', aging: '', conta: '' };
    setEditableLead(prev => ({
      ...prev,
      linhasDetalhas: [...(prev.linhasDetalhas || []), newLine]
    }));
  };

  const replicateFirstRow = () => {
    const lines = editableLead.linhasDetalhas || [];
    if (lines.length < 2) return;
    const firstLine = lines[0];
    const updatedLines = lines.map((line, idx) => idx === 0 ? line : { ...line, plano: firstLine.plano, valor: firstLine.valor });
    const totalValue = updatedLines.reduce((acc, curr) => acc + curr.valor, 0);
    setEditableLead(prev => ({ ...prev, linhasDetalhas: updatedLines, valorTotalReceita: totalValue }));
  };

  const handleFinalize = () => {
    if (!editableLead.operadora) {
      showAlert("CAMPO OBRIGATÓRIO", "Você deve selecionar a OPERADORA de destino.");
      return;
    }
    const totalAttachmentsCount = (lead.attachments?.length || 0) + checkoutAttachments.length;
    if (totalAttachmentsCount === 0) {
      showAlert("DOCUMENTAÇÃO AUSENTE", "Anexe pelo menos um documento para prosseguir.");
      return;
    }
    setIsFinalizing(true);
    const finalLinesCount = editableLead.linhasDetalhas?.length || 0;
    const finalLeadWithFiles: Lead = {
      ...editableLead,
      ATIVOS: finalLinesCount.toString(),
      attachments: [...(lead.attachments || []), ...checkoutAttachments]
    };
    setTimeout(() => { onConfirm(finalLeadWithFiles); }, 1200);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 lg:p-8 animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-xl" onClick={onClose}></div>
      <div className="bg-white w-full max-w-[1280px] h-full max-h-[95vh] rounded-[3rem] shadow-2xl overflow-hidden flex flex-col relative z-10 animate-in zoom-in-95">
        
        {errorModal.show && (
          <div className="absolute inset-0 z-[110] flex items-center justify-center p-6 animate-in fade-in zoom-in-95 duration-200">
             <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={()=>setErrorModal({...errorModal, show: false})}></div>
             <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden relative z-[120] border border-red-100">
                <div className="bg-red-600 p-8 flex flex-col items-center text-white">
                   <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mb-4"><ShieldAlert size={32} /></div>
                   <h4 className="text-lg font-black uppercase tracking-tighter text-center">{errorModal.title}</h4>
                </div>
                <div className="p-10">
                   <p className="text-sm font-bold text-slate-600 text-center leading-relaxed">{errorModal.message}</p>
                   <button onClick={()=>setErrorModal({...errorModal, show: false})} className="w-full mt-8 py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase shadow-xl">Entendido</button>
                </div>
             </div>
          </div>
        )}

        <div className="px-12 py-10 bg-[#0f172a] text-white shrink-0 flex items-center justify-between">
           <div className="flex items-center space-x-6">
              <div className="w-16 h-16 bg-blue-600 rounded-3xl flex items-center justify-center shadow-2xl"><FileCheck size={32} /></div>
              <div>
                 <h2 className="text-3xl font-black uppercase tracking-tighter italic">VEC CHECK-OUT</h2>
                 <p className="text-slate-400 font-bold text-sm mt-1 uppercase tracking-widest">Protocolo de Fechamento de Venda</p>
              </div>
           </div>
           <button onClick={onClose} className="p-4 bg-white/5 hover:bg-white/10 rounded-2xl transition-all border border-white/5"><X size={24} /></button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#f8fafc] p-12">
           <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
              <div className="lg:col-span-8 space-y-10">
                 <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm">
                    <div className="grid grid-cols-2 gap-6 mb-10">
                       <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Razão Social</label><input type="text" value={editableLead.razaoSocial} onChange={(e)=>handleInputChange('razaoSocial', e.target.value.toUpperCase())} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-black text-slate-800 focus:outline-none" /></div>
                       <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Consultor</label><input type="text" disabled value={editableLead.Vendedor} className="w-full bg-slate-100 border border-slate-100 rounded-xl px-4 py-3 text-sm font-black text-slate-400 cursor-not-allowed" /></div>
                    </div>
                    <div className="mt-6 pt-10 border-t border-slate-50">
                       <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6">Operadora de Destino</h3>
                       <div className="grid grid-cols-4 gap-4">
                          {OPERATORS.map((op) => (
                             <button key={op.id} onClick={() => handleInputChange('operadora', op.id)} className={`py-4 rounded-2xl font-black text-xs uppercase tracking-widest border-2 transition-all shadow-sm ${editableLead.operadora === op.id ? `${op.color} ring-4 ring-slate-100` : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'}`}>{op.label}</button>
                          ))}
                       </div>
                    </div>
                 </div>

                 <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
                    <div className="p-8 border-b border-slate-50 flex items-center justify-between">
                       <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center"><Smartphone size={20} /></div>
                          <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Resumo de Linhas Ativadas</h3>
                       </div>
                       <div className="flex items-center space-x-2">
                          <input type="file" ref={excelRef} onChange={handleExcelUpload} className="hidden" accept=".xlsx,.xls" />
                          <button onClick={()=>excelRef.current?.click()} className="bg-emerald-50 text-emerald-600 px-5 py-2.5 rounded-xl text-[9px] font-black uppercase border border-emerald-100 flex items-center space-x-2"><FileSpreadsheet size={14} /> <span>Excel</span></button>
                          <button onClick={replicateFirstRow} className="bg-indigo-50 text-indigo-600 px-5 py-2.5 rounded-xl text-[9px] font-black uppercase border border-indigo-100 flex items-center space-x-2"><Copy size={14} /> <span>Replicar 1ª Linha</span></button>
                          <button onClick={addManualLine} className="bg-slate-900 text-white px-5 py-2.5 rounded-xl text-[9px] font-black uppercase hover:bg-black shadow-xl flex items-center space-x-2"><PlusCircle size={14} /> <span>Manual</span></button>
                       </div>
                    </div>
                    <div className="p-0 overflow-x-auto">
                       <table className="w-full text-left">
                          <thead className="bg-slate-50"><tr><th className="px-8 py-4 text-[9px] font-black text-slate-400 uppercase">Telefone</th><th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase">Plano Ativado</th><th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase text-right">Valor Mensal</th><th className="w-20"></th></tr></thead>
                          <tbody className="divide-y divide-slate-50">
                             {editableLead.linhasDetalhas?.map((linha, idx) => (
                               <tr key={idx} className="hover:bg-slate-50/50">
                                  <td className="px-8 py-3"><input type="text" value={linha.telefone} onChange={(e)=>{const n = [...(editableLead.linhasDetalhas || [])]; n[idx].telefone = e.target.value; setEditableLead({...editableLead, linhasDetalhas: n})}} className="bg-transparent font-mono text-xs font-bold w-full focus:outline-none" /></td>
                                  <td className="px-6 py-3"><input type="text" value={linha.plano} onChange={(e)=>{const n = [...(editableLead.linhasDetalhas || [])]; n[idx].plano = e.target.value.toUpperCase(); setEditableLead({...editableLead, linhasDetalhas: n})}} className="bg-transparent text-xs font-black uppercase text-blue-600 w-full focus:outline-none" /></td>
                                  <td className="px-6 py-3 text-right"><input type="number" value={linha.valor} onChange={(e)=>{const n = [...(editableLead.linhasDetalhas || [])]; n[idx].valor = parseFloat(e.target.value); setEditableLead({...editableLead, linhasDetalhas: n, valorTotalReceita: n.reduce((acc, c)=>acc+c.valor, 0)})}} className="bg-transparent text-xs font-black text-emerald-600 text-right w-24 focus:outline-none" /></td>
                                  <td className="px-6 py-3 text-center"><button onClick={()=>{const n = (editableLead.linhasDetalhas || []).filter((_,i)=>i!==idx); setEditableLead({...editableLead, linhasDetalhas: n, valorTotalReceita: n.reduce((acc, c)=>acc+c.valor, 0)})}} className="text-slate-300 hover:text-red-500"><Trash2 size={14} /></button></td>
                               </tr>
                             ))}
                          </tbody>
                       </table>
                    </div>
                 </div>
              </div>

              <div className="lg:col-span-4 space-y-8">
                 <div className="bg-[#0f172a] rounded-[2.5rem] p-10 text-white shadow-2xl relative overflow-hidden">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Receita Total Fechada</p>
                    <h4 className="text-4xl font-black text-emerald-400">{editableLead.valorTotalReceita?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || 'R$ 0,00'}</h4>
                 </div>

                 <div className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-sm">
                    <input type="file" ref={fileRef} onChange={handleFileUpload} className="hidden" multiple />
                    <button onClick={()=>fileRef.current?.click()} disabled={isUploading} className="w-full py-10 border-2 border-dashed border-slate-200 rounded-[2rem] flex flex-col items-center justify-center space-y-4 hover:border-blue-400 transition-all">
                       <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center">{isUploading ? <Loader2 size={24} className="animate-spin text-blue-500" /> : <Upload size={24} />}</div>
                       <div className="text-center"><p className="text-[11px] font-black text-slate-600 uppercase">Anexar Documentação</p></div>
                    </button>
                    <div className="mt-8 space-y-3">
                       {checkoutAttachments.map((file) => (
                         <div key={file.id} className="flex items-center justify-between bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100">
                            <div className="flex items-center space-x-3 overflow-hidden"><div className="w-8 h-8 bg-emerald-500 text-white rounded-lg flex items-center justify-center shrink-0"><FileText size={16} /></div><span className="text-[10px] font-black text-slate-700 truncate uppercase">{file.name}</span></div>
                            <button onClick={()=>setCheckoutAttachments(prev => prev.filter(f => f.id !== file.id))} className="p-2 text-slate-300 hover:text-red-500"><Trash2 size={16} /></button>
                         </div>
                       ))}
                    </div>
                 </div>

                 <button onClick={handleFinalize} disabled={isFinalizing || isUploading || ((lead.attachments?.length || 0) + checkoutAttachments.length === 0)} className={`w-full py-6 rounded-[2.5rem] font-black uppercase tracking-[0.2em] text-xs shadow-2xl transition-all flex items-center justify-center space-x-3 ${!isUploading && ((lead.attachments?.length || 0) + checkoutAttachments.length > 0) ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                    {isFinalizing ? <Loader2 size={24} className="animate-spin" /> : <><ShieldCheck size={20} /><span>Finalizar Venda</span></>}
                 </button>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default LeadClosingModal;
