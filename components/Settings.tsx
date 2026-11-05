
import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { User, UserRole } from '../types';
import { 
  User as UserIcon, 
  Lock, 
  Mail, 
  Phone, 
  Calendar, 
  Shield, 
  Save, 
  Key,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Loader2
} from 'lucide-react';

interface SettingsProps {
  user: User;
  onUpdateUser: (user: User) => Promise<void>;
}

// Redimensionar e cortar imagem pelo centro em 256x256 e converter para JPEG base64 (qualidade 0.85)
const resizeImageToSquareBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Erro ao carregar imagem'));
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 256;
          canvas.height = 256;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Não foi possível obter contexto do canvas'));
            return;
          }

          // Cortar em quadrado pelo centro
          const minDim = Math.min(img.width, img.height);
          const sx = (img.width - minDim) / 2;
          const sy = (img.height - minDim) / 2;

          ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, 256, 256);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          resolve(dataUrl);
        } catch (err) {
          reject(err);
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
};

const Settings: React.FC<SettingsProps> = ({ user, onUpdateUser }) => {
  const [activeSection, setActiveSection] = useState<'profile' | 'security'>('profile');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Profile State
  const [profileData, setProfileData] = useState({
    name: user.name,
    phone: user.phone || '',
    birthDate: user.birthDate || '',
    avatar: user.avatar || ''
  });

  // Security State
  const [passwords, setPasswords] = useState({
    current: '',
    new: '',
    confirm: ''
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });

  // Mantém os dados sincronizados quando o usuário for atualizado no componente pai
  useEffect(() => {
    setProfileData({
      name: user.name,
      phone: user.phone || '',
      birthDate: user.birthDate || '',
      avatar: user.avatar || ''
    });
  }, [user]);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar se é imagem
    if (!file.type.startsWith('image/')) {
      alert('Por favor, selecione um arquivo de imagem válido.');
      e.target.value = '';
      return;
    }

    // Validar se tem no máximo 10 MB
    if (file.size > 10 * 1024 * 1024) {
      alert('A imagem deve ter no máximo 10 MB.');
      e.target.value = '';
      return;
    }

    const previousAvatar = profileData.avatar;
    setIsUploadingAvatar(true);
    setSaveStatus('idle');

    try {
      // Redimensionar no navegador com canvas: corte quadrado pelo centro, 256x256, toDataURL('image/jpeg', 0.85)
      const dataUrl = await resizeImageToSquareBase64(file);

      // Mostrar a nova foto na hora
      setProfileData(prev => ({ ...prev, avatar: dataUrl }));

      // Salvar IMEDIATAMENTE chamando onUpdateUser, sem precisar clicar em "Salvar Alterações"
      await onUpdateUser({
        ...user,
        name: profileData.name,
        phone: profileData.phone,
        birthDate: profileData.birthDate,
        avatar: dataUrl
      });

      // Sucesso: mostrar "Perfil Atualizado!"
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error) {
      console.error('Erro ao salvar foto de perfil:', error);
      // Erro: voltar a foto anterior e mostrar "Erro ao salvar"
      setProfileData(prev => ({ ...prev, avatar: previousAvatar }));
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } finally {
      setIsUploadingAvatar(false);
      // Limpar o valor do input depois para permitir escolher o mesmo arquivo de novo
      if (e.target) {
        e.target.value = '';
      }
    }
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveStatus('idle');
    try {
      await onUpdateUser({
        ...user,
        name: profileData.name,
        phone: profileData.phone,
        birthDate: profileData.birthDate,
        avatar: profileData.avatar
      });
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error) {
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwords.new !== passwords.confirm) {
      alert("As senhas não coincidem!");
      return;
    }
    setIsSaving(true);
    setSaveStatus('idle');
    try {
      // In a real app, we'd call a specific password update function
      // For now, we'll simulate it
      await new Promise(resolve => setTimeout(resolve, 1000));
      setSaveStatus('success');
      setPasswords({ current: '', new: '', confirm: '' });
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error) {
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-black text-white uppercase tracking-tighter mb-2">Configurações</h1>
        <p className="text-white/40 text-xs font-bold uppercase tracking-widest">Gerencie seu perfil e segurança da conta</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar Tabs */}
        <div className="lg:col-span-1 space-y-2">
          <button
            onClick={() => setActiveSection('profile')}
            className={`w-full flex items-center space-x-3 p-4 rounded-2xl transition-all border ${
              activeSection === 'profile'
                ? 'bg-[#00A1E4] border-[#00A1E4] text-white shadow-lg shadow-[#00A1E4]/20'
                : 'bg-white/5 border-white/5 text-white/60 hover:bg-white/10 hover:text-white'
            }`}
          >
            <UserIcon size={18} />
            <span className="text-[10px] font-black uppercase tracking-widest">Meu Perfil</span>
          </button>
          <button
            onClick={() => setActiveSection('security')}
            className={`w-full flex items-center space-x-3 p-4 rounded-2xl transition-all border ${
              activeSection === 'security'
                ? 'bg-[#00A1E4] border-[#00A1E4] text-white shadow-lg shadow-[#00A1E4]/20'
                : 'bg-white/5 border-white/5 text-white/60 hover:bg-white/10 hover:text-white'
            }`}
          >
            <Lock size={18} />
            <span className="text-[10px] font-black uppercase tracking-widest">Segurança & Senha</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="lg:col-span-3">
          <motion.div
            key={activeSection}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#001a4d]/50 backdrop-blur-xl border border-white/5 rounded-3xl p-8 shadow-2xl"
          >
            {activeSection === 'profile' ? (
              <form onSubmit={handleProfileUpdate} className="space-y-8">
                <div className="flex items-center space-x-6 mb-8">
                  <div className="relative group">
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleAvatarChange} 
                      accept="image/*" 
                      className="hidden" 
                    />
                    <div className="w-24 h-24 rounded-3xl border-2 border-[#00A1E4] overflow-hidden shadow-2xl relative">
                      <img 
                        src={profileData.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=00A1E4&color=fff`} 
                        className="w-full h-full object-cover"
                        alt="Avatar"
                      />
                    </div>
                    <button 
                      type="button"
                      disabled={isUploadingAvatar}
                      onClick={() => fileInputRef.current?.click()}
                      className={`absolute inset-0 rounded-3xl flex items-center justify-center transition-opacity ${
                        isUploadingAvatar 
                          ? 'bg-black/60 opacity-100 cursor-wait' 
                          : 'bg-black/60 opacity-0 group-hover:opacity-100 cursor-pointer'
                      }`}
                      title="Alterar foto de perfil"
                    >
                      {isUploadingAvatar ? (
                        <Loader2 size={24} className="animate-spin text-white" />
                      ) : (
                        <span className="text-[8px] font-black text-white uppercase tracking-tighter">Alterar</span>
                      )}
                    </button>
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-white uppercase tracking-tighter">{user.name}</h3>
                    <p className="text-[#00A1E4] text-[10px] font-black uppercase tracking-widest">{user.role}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-white/40 uppercase tracking-widest ml-1">Nome Completo</label>
                    <div className="relative">
                      <UserIcon size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" />
                      <input
                        type="text"
                        value={profileData.name}
                        onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                        className="w-full bg-white/5 border border-white/5 rounded-2xl py-3 pl-12 pr-4 text-white text-sm font-bold focus:border-[#00A1E4] outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-white/40 uppercase tracking-widest ml-1">E-mail (Não alterável)</label>
                    <div className="relative">
                      <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" />
                      <input
                        type="email"
                        value={user.email}
                        disabled
                        className="w-full bg-white/5 border border-white/5 rounded-2xl py-3 pl-12 pr-4 text-white/40 text-sm font-bold cursor-not-allowed"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-white/40 uppercase tracking-widest ml-1">Telefone</label>
                    <div className="relative">
                      <Phone size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" />
                      <input
                        type="text"
                        value={profileData.phone}
                        onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                        placeholder="(00) 00000-0000"
                        className="w-full bg-white/5 border border-white/5 rounded-2xl py-3 pl-12 pr-4 text-white text-sm font-bold focus:border-[#00A1E4] outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-white/40 uppercase tracking-widest ml-1">Data de Nascimento</label>
                    <div className="relative">
                      <Calendar size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" />
                      <input
                        type="date"
                        value={profileData.birthDate}
                        onChange={(e) => setProfileData({ ...profileData, birthDate: e.target.value })}
                        className="w-full bg-white/5 border border-white/5 rounded-2xl py-3 pl-12 pr-4 text-white text-sm font-bold focus:border-[#00A1E4] outline-none transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-6 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {saveStatus === 'success' && (
                      <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex items-center space-x-2 text-emerald-500">
                        <CheckCircle2 size={16} />
                        <span className="text-[10px] font-black uppercase tracking-widest">Perfil Atualizado!</span>
                      </motion.div>
                    )}
                    {saveStatus === 'error' && (
                      <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex items-center space-x-2 text-red-500">
                        <AlertCircle size={16} />
                        <span className="text-[10px] font-black uppercase tracking-widest">Erro ao salvar</span>
                      </motion.div>
                    )}
                  </div>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="bg-[#00A1E4] hover:bg-[#003399] text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center space-x-3 shadow-xl shadow-[#00A1E4]/20 disabled:opacity-50"
                  >
                    {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    <span>Salvar Alterações</span>
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handlePasswordUpdate} className="space-y-8">
                <div className="flex items-center space-x-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl mb-8">
                  <Shield className="text-amber-500 shrink-0" size={24} />
                  <div>
                    <h4 className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Dica de Segurança</h4>
                    <p className="text-[10px] font-bold text-amber-500/70 uppercase leading-tight mt-1">Use uma senha forte com pelo menos 8 caracteres, incluindo números e símbolos.</p>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-white/40 uppercase tracking-widest ml-1">Senha Atual</label>
                    <div className="relative">
                      <Key size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" />
                      <input
                        type={showPasswords.current ? 'text' : 'password'}
                        value={passwords.current}
                        onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
                        className="w-full bg-white/5 border border-white/5 rounded-2xl py-3 pl-12 pr-12 text-white text-sm font-bold focus:border-[#00A1E4] outline-none transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 hover:text-white transition-colors"
                      >
                        {showPasswords.current ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-white/40 uppercase tracking-widest ml-1">Nova Senha</label>
                      <div className="relative">
                        <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" />
                        <input
                          type={showPasswords.new ? 'text' : 'password'}
                          value={passwords.new}
                          onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
                          className="w-full bg-white/5 border border-white/5 rounded-2xl py-3 pl-12 pr-12 text-white text-sm font-bold focus:border-[#00A1E4] outline-none transition-all"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 hover:text-white transition-colors"
                        >
                          {showPasswords.new ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-white/40 uppercase tracking-widest ml-1">Confirmar Nova Senha</label>
                      <div className="relative">
                        <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" />
                        <input
                          type={showPasswords.confirm ? 'text' : 'password'}
                          value={passwords.confirm}
                          onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                          className="w-full bg-white/5 border border-white/5 rounded-2xl py-3 pl-12 pr-12 text-white text-sm font-bold focus:border-[#00A1E4] outline-none transition-all"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 hover:text-white transition-colors"
                        >
                          {showPasswords.confirm ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-6 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {saveStatus === 'success' && (
                      <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex items-center space-x-2 text-emerald-500">
                        <CheckCircle2 size={16} />
                        <span className="text-[10px] font-black uppercase tracking-widest">Senha Alterada!</span>
                      </motion.div>
                    )}
                  </div>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="bg-[#00A1E4] hover:bg-[#003399] text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center space-x-3 shadow-xl shadow-[#00A1E4]/20 disabled:opacity-50"
                  >
                    {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Shield size={16} />}
                    <span>Atualizar Senha</span>
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
