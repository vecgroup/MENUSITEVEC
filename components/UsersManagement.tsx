import React, { useState, useEffect } from 'react';
import { User, UserRole, UserStatus } from '../types';
import { supabase, normalizeRole, normalizeUserStatus } from '../lib/supabase';
import { 
  Plus, Search, Mail, User as UserIcon, Lock, Trash2, X, Save, Loader2, ShieldCheck, 
  Info, Check, AlertCircle, Edit, RefreshCw, Phone, Cake, Calendar, Key, Eye, EyeOff, 
  Copy, CheckCircle2, ShieldAlert, Sparkles, ExternalLink, HelpCircle
} from 'lucide-react';

interface UsersManagementProps {
  currentUser: User;
}

const UsersManagement: React.FC<UsersManagementProps> = ({ currentUser }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [isNewUser, setIsNewUser] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  
  // Auth Password Management
  const [userPassword, setUserPassword] = useState('');
  const [newPasswordReset, setNewPasswordReset] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);

  // Supabase Service Role Key status
  const [hasServiceRoleKey, setHasServiceRoleKey] = useState<boolean>(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [serviceRoleKeyInput, setServiceRoleKeyInput] = useState('');
  const [isSavingKey, setIsSavingKey] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  const isOwner = currentUser.role === UserRole.OWNER;
  const isSupervisorOrOwner = currentUser.role === UserRole.OWNER || currentUser.role === UserRole.SUPERVISOR;
  const canManageUsers = isSupervisorOrOwner || currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.ADMIN_ALT;
  const canChangePassword = currentUser.email?.toLowerCase().trim() === 'vinicius@ocomunicacao.com';

  // Dedicated Password Modal State (Exclusively for vinicius@ocomunicacao.com)
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [passwordTargetUser, setPasswordTargetUser] = useState<User | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [passwordModalError, setPasswordModalError] = useState<string | null>(null);

  useEffect(() => {
    loadUsers();
    checkAdminConfig();
  }, []);

  const checkAdminConfig = async () => {
    try {
      const status = await supabase.users.checkAdminConfig();
      setHasServiceRoleKey(!!status?.hasServiceRoleKey);
    } catch (e) {
      console.warn('Erro ao checar status de admin config:', e);
    }
  };

  const loadUsers = async () => {
    setError(null);
    try {
      // Tenta buscar via endpoint admin primeiro (bypassa RLS com service_role se ativo)
      const res = await fetch('/api/admin/users').catch(() => null);
      if (res && res.ok) {
        const json = await res.json();
        if (json?.users && Array.isArray(json.users) && json.users.length > 0) {
          setUsers(json.users.map((u: any) => ({
            id: u.id,
            name: u.full_name || u.name || 'Sem Nome',
            email: u.email,
            role: (u.role as UserRole) || UserRole.VENDEDOR,
            status: (u.status as UserStatus) || UserStatus.ACTIVE,
            phone: u.phone || '',
            birthDate: u.birth_date || u.birthDate,
            admissionDate: u.admission_date || u.admissionDate || u.created_at,
            avatar: u.avatar_url || u.avatar
          })));
          return;
        }
      }

      // Fallback para supabase client
      const { data, error: supabaseError } = await supabase.users.getAll();
      if (supabaseError) {
        setError(supabaseError.message);
        return;
      }
      if (data && data.length > 0) {
        setUsers(data.map((u: any) => ({
          ...u,
          role: u.role as UserRole,
          status: u.status as UserStatus
        })));
      } else {
        setUsers([]);
      }
    } catch (err: any) {
      console.error("Erro ao carregar usuários:", err);
      setError(err.message || "Erro desconhecido ao carregar usuários");
    }
  };

  const generateStrongPassword = () => {
    const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    const nums = '23456789';
    const symbols = '!@#$%&*';
    let pass = 'Vec@';
    for (let i = 0; i < 4; i++) {
      pass += letters.charAt(Math.floor(Math.random() * letters.length));
    }
    pass += nums.charAt(Math.floor(Math.random() * nums.length));
    pass += nums.charAt(Math.floor(Math.random() * nums.length));
    pass += symbols.charAt(Math.floor(Math.random() * symbols.length));
    setUserPassword(pass);
    setNewPasswordReset(pass);
  };

  const copyToClipboard = (text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedPassword(true);
    setTimeout(() => setCopiedPassword(false), 2500);
  };

  const handleOpenNewUserModal = () => {
    const todayIso = new Date().toISOString().split('T')[0];
    const initialPass = 'Vec@' + Math.floor(1000 + Math.random() * 9000) + '!';
    
    setSelectedUser({
      id: '',
      name: '',
      email: '',
      role: UserRole.VENDEDOR,
      status: UserStatus.ACTIVE,
      phone: '',
      birthDate: '',
      admissionDate: todayIso,
      avatar: ''
    });
    setUserPassword(initialPass);
    setNewPasswordReset('');
    setIsNewUser(true);
    setShowPassword(false);
    setIsModalOpen(true);
  };

  const handleOpenEditUserModal = (user: User) => {
    setSelectedUser({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      phone: user.phone || '',
      birthDate: user.birthDate || (user as any).birth_date || '',
      admissionDate: user.admissionDate || (user as any).admission_date || '',
      avatar: user.avatar || ''
    });
    setUserPassword('');
    setNewPasswordReset('');
    setIsNewUser(false);
    setShowPassword(false);
    setIsModalOpen(true);
  };

  const handleOpenPasswordModal = (user: User) => {
    if (!canChangePassword) {
      alert("Acesso restrito: apenas o usuário vinicius@ocomunicacao.com tem autorização para alterar senhas de colaboradores.");
      return;
    }
    setPasswordTargetUser(user);
    setNewPasswordInput('');
    setPasswordModalError(null);
    setShowPassword(false);
    setIsPasswordModalOpen(true);
  };

  const handleSavePasswordChange = async () => {
    if (!passwordTargetUser) return;
    if (!canChangePassword) {
      alert("Apenas o usuário vinicius@ocomunicacao.com tem permissão para alterar a senha de colaboradores.");
      return;
    }

    if (!newPasswordInput || newPasswordInput.trim().length < 6) {
      setPasswordModalError("A nova senha deve ter no mínimo 6 caracteres.");
      return;
    }

    setIsSavingPassword(true);
    setPasswordModalError(null);
    try {
      const { data, error } = await supabase.users.changePasswordAsAdmin(
        passwordTargetUser.id,
        newPasswordInput.trim(),
        currentUser.email || ''
      );
      if (error) throw error;

      setSuccessBanner(`Senha de ${passwordTargetUser.name} alterada com sucesso no Supabase Authentication! Nova Senha: ${newPasswordInput.trim()}`);
      setIsPasswordModalOpen(false);
      setTimeout(() => setSuccessBanner(null), 15000);
    } catch (err: any) {
      setPasswordModalError(err.message || "Erro ao alterar senha no Supabase.");
    } finally {
      setIsSavingPassword(false);
    }
  };

  const handleSaveUser = async () => {
    if (!canManageUsers) {
      alert("Apenas Supervisores, Administradores e o Proprietário (Owner) têm permissão para cadastrar ou gerenciar colaboradores.");
      return;
    }

    if (!selectedUser?.name || !selectedUser?.email) {
      alert("Nome Completo e E-mail de Login são campos obrigatórios.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(selectedUser.email)) {
      alert("Por favor, informe um endereço de e-mail válido.");
      return;
    }

    if (isNewUser && (!userPassword || userPassword.length < 6)) {
      alert("A senha de acesso provisória deve conter no mínimo 6 caracteres.");
      return;
    }

    setIsSaving(true);
    try {
      if (isNewUser) {
        // Criar usuário novo no Supabase Auth + public.profiles
        const { data, error } = await supabase.users.createAdminUser({
          name: selectedUser.name.trim(),
          email: selectedUser.email.trim().toLowerCase(),
          password: userPassword,
          role: selectedUser.role,
          phone: selectedUser.phone,
          birthDate: selectedUser.birthDate,
          admissionDate: selectedUser.admissionDate,
          status: selectedUser.status,
          avatar: selectedUser.avatar
        });

        if (error) {
          if (error.message?.includes('SERVICE_ROLE_KEY_REQUIRED')) {
            setIsConfigModalOpen(true);
            return;
          }
          throw error;
        }

        setSuccessBanner(`Usuário ${selectedUser.name} registrado com sucesso no Supabase Authentication e no Banco de Dados! Senha: ${userPassword}`);
        setTimeout(() => setSuccessBanner(null), 12000);
      } else {
        // Se foi informada nova senha na tela de edição, validar se é vinicius@ocomunicacao.com
        if (newPasswordReset && newPasswordReset.trim().length > 0) {
          if (!canChangePassword) {
            alert("Apenas o administrador vinicius@ocomunicacao.com tem permissão para alterar a senha de colaboradores.");
            return;
          }
        }

        // Atualizar usuário existente
        const { error } = await supabase.users.updateAdminUser(selectedUser.id, {
          name: selectedUser.name.trim(),
          email: selectedUser.email.trim().toLowerCase(),
          password: (canChangePassword && newPasswordReset && newPasswordReset.length >= 6) ? newPasswordReset : undefined,
          role: selectedUser.role,
          phone: selectedUser.phone,
          birthDate: selectedUser.birthDate,
          admissionDate: selectedUser.admissionDate,
          status: selectedUser.status,
          avatar: selectedUser.avatar,
          requesterEmail: currentUser.email || ''
        });

        if (error) throw error;
        setSuccessBanner(`Perfil de ${selectedUser.name} atualizado com sucesso!`);
        setTimeout(() => setSuccessBanner(null), 5000);
      }

      await loadUsers();
      setIsModalOpen(false);
    } catch (err: any) {
      console.error("Erro ao salvar usuário:", err);
      alert(`Erro ao salvar usuário: ${err.message || 'Verifique sua conexão ou credenciais.'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteUser = async (userToDelete: User) => {
    if (!isSupervisorOrOwner) {
      alert("Apenas Supervisores e o Proprietário (Owner) podem excluir colaboradores.");
      return;
    }

    if (userToDelete.id === currentUser.id) {
      alert("Você não pode excluir seu próprio perfil.");
      return;
    }

    const confirmText = `ATENÇÃO: Deseja realmente excluir permanentemente o colaborador:\n\n${userToDelete.name.toUpperCase()} (${userToDelete.email})?\n\nEle será removido do Banco de Dados e perderá o acesso de login no Supabase Authentication.`;
    if (!window.confirm(confirmText)) return;

    setIsDeletingId(userToDelete.id);
    try {
      const { data, error } = await supabase.users.deleteAdminUser(userToDelete.id);
      if (error) throw error;

      await loadUsers();
      setSuccessBanner(`Colaborador ${userToDelete.name} excluído do banco de dados e do Authentication.`);
      setTimeout(() => setSuccessBanner(null), 5000);
    } catch (err: any) {
      console.error("Erro ao excluir usuário:", err);
      alert(`Erro ao excluir: ${err.message}`);
    } finally {
      setIsDeletingId(null);
    }
  };

  const handleSaveServiceRoleKey = async () => {
    if (!serviceRoleKeyInput || serviceRoleKeyInput.trim().length < 20) {
      setConfigError("Informe uma chave Service Role válida (começa com eyJhbGci...).");
      return;
    }

    setIsSavingKey(true);
    setConfigError(null);
    try {
      const { error } = await supabase.users.saveAdminKey(serviceRoleKeyInput.trim());
      if (error) throw error;

      setHasServiceRoleKey(true);
      setIsConfigModalOpen(false);
      setServiceRoleKeyInput('');
      setSuccessBanner("Conexão com o Supabase Auth Admin ativada com sucesso! Agora você pode criar e excluir usuários sem precisar abrir o painel do Supabase.");
      setTimeout(() => setSuccessBanner(null), 8000);
    } catch (err: any) {
      setConfigError(err.message || "Chave rejeitada pelo Supabase. Verifique se copiou a chave service_role (secret).");
    } finally {
      setIsSavingKey(false);
    }
  };

  const handleMergeDuplicates = async () => {
    if (!window.confirm("Isso irá buscar perfis com o mesmo e-mail e mesclá-los permanentemente no banco de dados. Deseja continuar?")) return;
    
    setIsSaving(true);
    try {
      const { data: allProfiles } = await supabase.users.getAll();
      if (!allProfiles) return;

      const emailMap = new Map<string, any[]>();
      allProfiles.forEach(p => {
        const email = p.email?.toLowerCase().trim();
        if (!email) return;
        const list = emailMap.get(email) || [];
        list.push(p);
        emailMap.set(email, list);
      });

      let mergedCount = 0;
      for (const [, profiles] of emailMap.entries()) {
        if (profiles.length > 1) {
          const sorted = [...profiles].sort((a, b) => {
            const roles = [UserRole.OWNER, UserRole.SUPERVISOR, UserRole.ADMIN, UserRole.ADMIN_ALT, UserRole.ADVOGADO, UserRole.VENDEDOR];
            const roleA = roles.indexOf(a.role as UserRole);
            const roleB = roles.indexOf(b.role as UserRole);
            if (roleA !== roleB) return roleA - roleB;
            return 0;
          });

          const best = sorted[0];
          const others = sorted.slice(1);

          for (const other of others) {
            await supabase.users.delete(other.id);
            mergedCount++;
          }
        }
      }
      
      if (mergedCount > 0) {
        alert(`${mergedCount} perfis duplicados foram limpos com sucesso.`);
      } else {
        alert("Nenhum perfil duplicado encontrado.");
      }
      await loadUsers();
    } catch (err) {
      console.error("Erro ao mesclar duplicados:", err);
      alert("Erro ao mesclar duplicados.");
    } finally {
      setIsSaving(false);
    }
  };

  const filtered = users.filter(u => 
    (u.name?.toLowerCase() || "").includes(search.toLowerCase()) || 
    (u.email?.toLowerCase() || "").includes(search.toLowerCase()) ||
    (u.role?.toLowerCase() || "").includes(search.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-3xl font-black text-white tracking-tighter uppercase">Gestão de Equipe & Usuários</h1>
            {hasServiceRoleKey ? (
              <span className="flex items-center space-x-1.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">
                <CheckCircle2 size={12} />
                <span>Supabase Auth Conectado</span>
              </span>
            ) : (
              <button
                onClick={() => setIsConfigModalOpen(true)}
                className="flex items-center space-x-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider transition-all"
              >
                <ShieldAlert size={12} />
                <span>Ativar Chave Supabase</span>
              </button>
            )}
            {canChangePassword && (
              <span className="flex items-center space-x-1.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">
                <Key size={12} className="text-amber-400" />
                <span>Gestor Autorizado de Senhas (Vinicius)</span>
              </span>
            )}
          </div>
          <p className="text-slate-400 mt-1 font-medium tracking-widest uppercase text-[10px]">
            Criação e exclusão automática no Supabase Authentication e Banco de Dados (sem precisar entrar no painel).
          </p>
        </div>

        {canManageUsers && (
          <div className="flex flex-wrap items-center gap-3">
            {isOwner && (
              <button
                onClick={() => setIsConfigModalOpen(true)}
                className="flex items-center space-x-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all"
                title="Configurar Chave Service Role do Supabase"
              >
                <Key size={14} className="text-[#00A1E4]" />
                <span>Chave Supabase</span>
              </button>
            )}

            <button 
              onClick={handleMergeDuplicates}
              className="flex items-center space-x-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all"
              title="Mesclar perfis duplicados por e-mail"
            >
              <RefreshCw size={14} className={isSaving ? "animate-spin" : ""} />
              <span>Limpar Duplicados</span>
            </button>

            <button 
              onClick={handleOpenNewUserModal}
              className="flex items-center space-x-2.5 bg-[#00A1E4] hover:bg-[#008bc5] text-white px-6 py-3.5 rounded-2xl font-black text-[11px] uppercase tracking-wider shadow-lg shadow-[#00A1E4]/30 hover:shadow-[#00A1E4]/50 active:scale-95 transition-all"
            >
              <Plus size={18} />
              <span>Novo Colaborador</span>
            </button>
          </div>
        )}
      </div>

      {/* Success Banner */}
      {successBanner && (
        <div className="p-4 bg-emerald-500/15 border border-emerald-500/30 rounded-2xl flex items-center justify-between text-emerald-300 text-xs animate-in slide-in-from-top-2">
          <div className="flex items-center space-x-3">
            <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
            <span className="font-semibold">{successBanner}</span>
          </div>
          <button onClick={() => setSuccessBanner(null)} className="text-emerald-400 hover:text-emerald-200">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Warning Banner if Service Role is NOT connected */}
      {!hasServiceRoleKey && isOwner && (
        <div className="p-5 bg-gradient-to-r from-amber-500/15 via-[#001a4d] to-amber-500/10 border border-amber-500/30 rounded-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start space-x-3.5">
            <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-2xl shrink-0">
              <Key size={20} />
            </div>
            <div>
              <h4 className="text-white text-xs font-black uppercase tracking-wider">
                Ative a Criação Automática no Supabase Authentication
              </h4>
              <p className="text-white/60 text-[11px] mt-0.5">
                Para que novos usuários criados aqui tenham login e senha automáticos (sem confirmação de e-mail e sem você precisar abrir o Supabase), insira a chave <strong className="text-amber-300">service_role</strong> do seu projeto uma única vez.
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsConfigModalOpen(true)}
            className="shrink-0 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[10px] uppercase tracking-wider px-5 py-2.5 rounded-xl transition-all shadow-md active:scale-95 flex items-center space-x-1.5"
          >
            <span>Conectar em 1 Clique</span>
            <ExternalLink size={12} />
          </button>
        </div>
      )}

      {/* Search Input */}
      <div className="flex items-center space-x-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-white/30" size={18} />
          <input 
            type="text" 
            placeholder="Buscar por nome, e-mail ou cargo..." 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
            className="w-full pl-14 pr-6 py-4 rounded-2xl bg-white/5 border border-white/10 font-semibold text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#00A1E4] focus:ring-1 focus:ring-[#00A1E4] transition-all" 
          />
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-3xl flex items-center gap-4 text-red-400">
          <AlertCircle size={24} className="shrink-0" />
          <div className="flex-1">
            <p className="font-black text-xs uppercase tracking-widest">Aviso do Banco de Dados</p>
            <p className="text-[11px] font-bold opacity-80 mt-1">{error}</p>
          </div>
          <button 
            onClick={loadUsers}
            className="flex items-center gap-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all"
          >
            <RefreshCw size={12} /> Tentar Novamente
          </button>
        </div>
      )}

      {/* Empty State */}
      {users.length === 0 && !error && (
        <div className="bg-[#001a4d] border border-white/10 p-12 rounded-3xl flex flex-col items-center text-center space-y-4">
          <div className="w-16 h-16 bg-[#00A1E4]/20 rounded-2xl flex items-center justify-center text-[#00A1E4]">
            <UserIcon size={32} />
          </div>
          <div>
            <h3 className="text-white font-black text-base uppercase">Nenhum colaborador encontrado</h3>
            <p className="text-white/50 text-xs mt-1">Clique em "Novo Colaborador" para adicionar o primeiro usuário com acesso imediato.</p>
          </div>
          {canManageUsers && (
            <button
              onClick={handleOpenNewUserModal}
              className="bg-[#00A1E4] hover:bg-[#008bc5] text-white font-black text-xs uppercase tracking-wider px-6 py-3 rounded-2xl shadow-lg transition-all"
            >
              + Novo Colaborador
            </button>
          )}
        </div>
      )}

      {/* Users Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filtered.map(user => {
          const isCurrentUser = user.id === currentUser.id;
          const isDeleting = isDeletingId === user.id;

          return (
            <div 
              key={user.id} 
              className="bg-[#001a4d] border border-white/10 hover:border-white/20 p-6 rounded-3xl transition-all shadow-xl relative flex flex-col justify-between group"
            >
              <div>
                {/* Header card: Avatar & Actions */}
                <div className="flex items-start justify-between mb-4">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-[#00A1E4]/50 bg-[#000d26]">
                      <img 
                        src={user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=00A1E4&color=fff`} 
                        alt={user.name} 
                        className="w-full h-full object-cover" 
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <span 
                      className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-[#001a4d] ${
                        user.status === UserStatus.ACTIVE ? 'bg-emerald-500' : 'bg-red-500'
                      }`} 
                      title={user.status}
                    />
                  </div>

                  {(canManageUsers || canChangePassword) && (
                    <div className="flex items-center space-x-1 bg-white/5 border border-white/10 rounded-2xl p-1">
                      {canChangePassword && (
                        <button 
                          onClick={() => handleOpenPasswordModal(user)} 
                          className="p-2 text-amber-400 hover:text-amber-300 hover:bg-amber-500/20 rounded-xl transition-all" 
                          title="Alterar Senha do Colaborador (Exclusivo Vinicius)"
                        >
                          <Key size={16} />
                        </button>
                      )}
                      {canManageUsers && (
                        <button 
                          onClick={() => handleOpenEditUserModal(user)} 
                          className="p-2 text-white/60 hover:text-[#00A1E4] hover:bg-white/10 rounded-xl transition-all" 
                          title="Editar Perfil"
                        >
                          <Edit size={16} />
                        </button>
                      )}
                      {isSupervisorOrOwner && !isCurrentUser && (
                        <button 
                          onClick={() => handleDeleteUser(user)} 
                          disabled={isDeleting}
                          className="p-2 text-white/60 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all disabled:opacity-50" 
                          title="Excluir Usuário do Supabase Auth e Banco"
                        >
                          {isDeleting ? <Loader2 size={16} className="animate-spin text-red-400" /> : <Trash2 size={16} />}
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Name & Email */}
                <h3 className="text-lg font-black text-white uppercase tracking-tight truncate" title={user.name}>
                  {user.name}
                </h3>
                <div className="flex items-center space-x-2 text-white/50 mt-1 text-xs truncate">
                  <Mail size={13} className="shrink-0 text-white/40" />
                  <span className="truncate">{user.email}</span>
                </div>

                {/* Additional Info */}
                <div className="mt-4 pt-4 border-t border-white/5 space-y-2 text-xs">
                  {user.phone && (
                    <a 
                      href={`https://wa.me/${user.phone.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center space-x-2 text-emerald-400 hover:text-emerald-300 font-semibold transition-colors"
                    >
                      <Phone size={13} />
                      <span>{user.phone}</span>
                    </a>
                  )}

                  {user.birthDate && (
                    <div className="flex items-center space-x-2 text-white/60">
                      <Cake size={13} className="text-[#00A1E4]" />
                      <span>Aniversário: {new Date(user.birthDate + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                    </div>
                  )}

                  {user.admissionDate && (
                    <div className="flex items-center space-x-2 text-white/60">
                      <Calendar size={13} className="text-[#00A1E4]" />
                      <span>Início / Admissão: {new Date(user.admissionDate + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                    </div>
                  )}
                </div>

                {/* Botão de Alterar Senha Exclusivo para vinicius@ocomunicacao.com */}
                {canChangePassword && (
                  <button
                    onClick={() => handleOpenPasswordModal(user)}
                    className="w-full mt-4 py-2.5 px-3 bg-gradient-to-r from-amber-500/15 to-amber-500/25 hover:from-amber-500/25 hover:to-amber-500/35 border border-amber-500/30 hover:border-amber-500/50 text-amber-300 hover:text-amber-200 rounded-2xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center space-x-2 transition-all shadow-sm active:scale-98 group"
                    title={`Alterar senha de login de ${user.name}`}
                  >
                    <Key size={13} className="text-amber-400 group-hover:rotate-45 transition-transform" />
                    <span>Alterar Senha</span>
                  </button>
                )}
              </div>

              {/* Bottom Card Footer */}
              <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between text-xs">
                <div>
                  <span className="text-[9px] font-black text-white/30 uppercase tracking-widest block">Nível de Acesso</span>
                  <span className="inline-block bg-[#00A1E4]/15 border border-[#00A1E4]/30 text-[#00A1E4] text-[10px] font-black uppercase px-2.5 py-0.5 rounded-lg mt-0.5">
                    {user.role}
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-[9px] font-black text-white/30 uppercase tracking-widest block">Status</span>
                  <span className={`text-[10px] font-black uppercase tracking-wider ${
                    user.status === UserStatus.ACTIVE ? 'text-emerald-400' : 'text-red-400'
                  }`}>
                    {user.status}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL: CRIAR OU EDITAR USUÁRIO */}
      {isModalOpen && selectedUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setIsModalOpen(false)} />
          <div className="bg-[#001a4d] border border-white/10 w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden flex flex-col relative z-10 animate-in zoom-in-95 max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-8 py-6 border-b border-white/10 flex items-center justify-between bg-[#001338]">
              <div>
                <h2 className="text-xl font-black text-white uppercase tracking-tight flex items-center space-x-2">
                  <span>{isNewUser ? 'Cadastrar Novo Colaborador' : 'Editar Colaborador'}</span>
                </h2>
                <p className="text-white/40 text-[10px] font-bold uppercase tracking-wider mt-0.5">
                  {isNewUser ? 'Registro automático no Supabase Auth e Banco de Dados' : 'Atualizar dados e credenciais'}
                </p>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="p-2 text-white/40 hover:text-white rounded-xl hover:bg-white/5 transition-all"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-8 space-y-5 overflow-y-auto custom-scrollbar flex-1">
              {/* Nome */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-white/60 uppercase tracking-widest">
                  Nome Completo *
                </label>
                <input 
                  type="text" 
                  value={selectedUser.name} 
                  onChange={(e) => setSelectedUser({ ...selectedUser, name: e.target.value })} 
                  placeholder="Ex: João Silva"
                  className="w-full bg-white/5 border border-white/10 focus:border-[#00A1E4] focus:ring-1 focus:ring-[#00A1E4] rounded-2xl px-4 py-3 text-sm font-bold text-white outline-none transition-all placeholder:text-white/20" 
                />
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-white/60 uppercase tracking-widest">
                  E-mail de Login *
                </label>
                <input 
                  type="email" 
                  value={selectedUser.email} 
                  onChange={(e) => setSelectedUser({ ...selectedUser, email: e.target.value })} 
                  placeholder="exemplo@vecgroup.com.br"
                  className="w-full bg-white/5 border border-white/10 focus:border-[#00A1E4] focus:ring-1 focus:ring-[#00A1E4] rounded-2xl px-4 py-3 text-sm font-bold text-white outline-none transition-all placeholder:text-white/20" 
                />
              </div>

              {/* Senha (Para novo usuário ou reset de senha) */}
              {isNewUser ? (
                <div className="space-y-2 bg-white/5 border border-white/10 p-4 rounded-2xl">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black text-[#00A1E4] uppercase tracking-widest flex items-center space-x-1.5">
                      <Key size={13} />
                      <span>Senha de Acesso (Login no Supabase) *</span>
                    </label>
                    <button
                      type="button"
                      onClick={generateStrongPassword}
                      className="flex items-center space-x-1 text-emerald-400 hover:text-emerald-300 text-[10px] font-bold uppercase transition-colors"
                    >
                      <Sparkles size={12} />
                      <span>Gerar Senha Forte</span>
                    </button>
                  </div>

                  <div className="relative">
                    <input 
                      type={showPassword ? 'text' : 'password'} 
                      value={userPassword} 
                      onChange={(e) => setUserPassword(e.target.value)} 
                      placeholder="Mínimo 6 caracteres (Ex: Vec@8491!)"
                      className="w-full bg-[#000d26] border border-white/15 focus:border-[#00A1E4] rounded-xl pl-4 pr-24 py-3 text-sm font-mono font-bold text-white outline-none transition-all placeholder:text-white/25" 
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center space-x-1">
                      {userPassword && (
                        <button
                          type="button"
                          onClick={() => copyToClipboard(userPassword)}
                          className="p-1.5 text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                          title="Copiar Senha"
                        >
                          {copiedPassword ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="p-1.5 text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                        title={showPassword ? "Ocultar Senha" : "Exibir Senha"}
                      >
                        {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>
                  {copiedPassword && (
                    <p className="text-emerald-400 text-[10px] font-bold flex items-center space-x-1">
                      <CheckCircle2 size={12} />
                      <span>Senha copiada para a área de transferência!</span>
                    </p>
                  )}
                </div>
              ) : (
                canChangePassword ? (
                  <div className="space-y-2 bg-amber-500/10 border border-amber-500/30 p-4 rounded-2xl">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-black text-amber-400 uppercase tracking-widest flex items-center space-x-1.5">
                        <Key size={13} />
                        <span>Nova Senha no Supabase (Opcional)</span>
                      </label>
                      <button
                        type="button"
                        onClick={generateStrongPassword}
                        className="flex items-center space-x-1 text-emerald-400 hover:text-emerald-300 text-[10px] font-bold uppercase transition-colors"
                      >
                        <Sparkles size={12} />
                        <span>Gerar Senha</span>
                      </button>
                    </div>

                    <div className="relative">
                      <input 
                        type={showPassword ? 'text' : 'password'} 
                        value={newPasswordReset} 
                        onChange={(e) => setNewPasswordReset(e.target.value)} 
                        placeholder="Deixe em branco para manter a senha atual"
                        className="w-full bg-[#000d26] border border-white/15 focus:border-amber-400 rounded-xl pl-4 pr-24 py-3 text-sm font-mono font-bold text-white outline-none transition-all placeholder:text-white/25" 
                      />
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center space-x-1">
                        {newPasswordReset && (
                          <button
                            type="button"
                            onClick={() => copyToClipboard(newPasswordReset)}
                            className="p-1.5 text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                            title="Copiar Senha"
                          >
                            {copiedPassword ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="p-1.5 text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                          title={showPassword ? "Ocultar Senha" : "Exibir Senha"}
                        >
                          {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    </div>
                    {copiedPassword && (
                      <p className="text-emerald-400 text-[10px] font-bold flex items-center space-x-1">
                        <CheckCircle2 size={12} />
                        <span>Senha copiada para a área de transferência!</span>
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="p-3.5 bg-white/5 border border-white/10 rounded-2xl flex items-center space-x-3 text-white/50 text-xs">
                    <Lock size={15} className="text-amber-400 shrink-0" />
                    <span className="text-[10px]">Alteração de senhas permitida exclusivamente para <strong>vinicius@ocomunicacao.com</strong></span>
                  </div>
                )
              )}

              {/* Telefone & Aniversário */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-white/60 uppercase tracking-widest">
                    Telefone / WhatsApp
                  </label>
                  <input 
                    type="text" 
                    value={selectedUser.phone || ''} 
                    onChange={(e) => setSelectedUser({ ...selectedUser, phone: e.target.value })} 
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-[#00A1E4] transition-all placeholder:text-white/20" 
                    placeholder="(00) 00000-0000" 
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-white/60 uppercase tracking-widest">
                    Data de Aniversário
                  </label>
                  <input 
                    type="date" 
                    value={selectedUser.birthDate || ''} 
                    onChange={(e) => setSelectedUser({ ...selectedUser, birthDate: e.target.value })} 
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-[#00A1E4] transition-all" 
                  />
                </div>
              </div>

              {/* Data de Admissão */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-white/60 uppercase tracking-widest">
                  Data de Início / Admissão (Ponto)
                </label>
                <input 
                  type="date" 
                  value={selectedUser.admissionDate || ''} 
                  onChange={(e) => setSelectedUser({ ...selectedUser, admissionDate: e.target.value })} 
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-[#00A1E4] transition-all" 
                />
                <p className="text-[9px] text-white/40 font-semibold">
                  O colaborador só será cobrado de justificativas e registros de ponto a partir desta data.
                </p>
              </div>

              {/* Cargo & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-white/60 uppercase tracking-widest">
                    Cargo VEC
                  </label>
                  <select 
                    value={selectedUser.role} 
                    onChange={(e) => setSelectedUser({ ...selectedUser, role: e.target.value as any })} 
                    className="w-full bg-[#001338] border border-white/10 rounded-2xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-[#00A1E4] transition-all"
                  >
                    {Object.values(UserRole).map(r => (
                      <option key={r} value={r} className="bg-[#001338] text-white">{r}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-white/60 uppercase tracking-widest">
                    Status de Acesso
                  </label>
                  <select 
                    value={selectedUser.status} 
                    onChange={(e) => setSelectedUser({ ...selectedUser, status: e.target.value as any })} 
                    className="w-full bg-[#001338] border border-white/10 rounded-2xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-[#00A1E4] transition-all"
                  >
                    {Object.values(UserStatus).map(s => (
                      <option key={s} value={s} className="bg-[#001338] text-white">{s}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-white/10 bg-[#001338] flex items-center justify-between">
              <button 
                type="button"
                onClick={() => setIsModalOpen(false)} 
                className="px-6 py-3 text-xs font-bold text-white/50 hover:text-white uppercase tracking-wider transition-colors"
              >
                Cancelar
              </button>
              <button 
                type="button"
                onClick={handleSaveUser} 
                disabled={isSaving} 
                className="bg-[#00A1E4] hover:bg-[#008bc5] text-white px-8 py-3.5 rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg shadow-[#00A1E4]/30 flex items-center space-x-2 disabled:opacity-50 active:scale-95 transition-all"
              >
                {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                <span>{isNewUser ? 'Criar Usuário no Supabase' : 'Salvar Alterações'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CONFIGURAR CHAVE SERVICE ROLE KEY DO SUPABASE */}
      {isConfigModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-black/85 backdrop-blur-md" onClick={() => setIsConfigModalOpen(false)} />
          <div className="bg-[#001a4d] border border-white/15 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col relative z-10 animate-in zoom-in-95">
            <div className="px-8 py-6 border-b border-white/10 flex items-center justify-between bg-[#001338]">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-[#00A1E4]/20 text-[#00A1E4] rounded-xl">
                  <Key size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-white uppercase tracking-tight">
                    Chave Service Role do Supabase
                  </h3>
                  <p className="text-white/40 text-[10px] font-bold uppercase tracking-wider">
                    Permite criar e excluir no Authentication sem sair do CRM
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsConfigModalOpen(false)} 
                className="p-2 text-white/40 hover:text-white rounded-xl hover:bg-white/5 transition-all"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-8 space-y-5">
              {configError && (
                <div className="p-4 bg-red-500/15 border border-red-500/30 rounded-2xl flex items-start space-x-3 text-red-300 text-xs">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <span>{configError}</span>
                </div>
              )}

              <div className="bg-white/5 border border-white/10 p-4 rounded-2xl text-xs space-y-2 text-white/70">
                <p className="font-bold text-white flex items-center space-x-1.5">
                  <Info size={14} className="text-[#00A1E4]" />
                  <span>Como obter a chave em 3 passos:</span>
                </p>
                <ol className="list-decimal list-inside space-y-1.5 text-[11px] leading-relaxed text-white/60">
                  <li>Acesse o <strong className="text-white">Painel do Supabase</strong> do seu projeto.</li>
                  <li>Clique no ícone de engrenagem ⚙️ <strong className="text-white">Project Settings</strong> &rarr; <strong className="text-white">API</strong>.</li>
                  <li>Na seção <strong className="text-white">Project API keys</strong>, copie a chave chamada <strong className="text-amber-300">service_role (secret)</strong>.</li>
                </ol>
                <p className="text-[10px] text-white/40 italic pt-1">
                  * A chave fica armazenada com segurança no servidor e não é visível para outros usuários.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-white/60 uppercase tracking-widest">
                  Cole a chave service_role aqui:
                </label>
                <textarea
                  rows={3}
                  value={serviceRoleKeyInput}
                  onChange={(e) => setServiceRoleKeyInput(e.target.value)}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  className="w-full bg-[#000d26] border border-white/15 focus:border-[#00A1E4] rounded-2xl p-4 text-xs font-mono font-medium text-white outline-none transition-all placeholder:text-white/20 resize-none"
                />
              </div>
            </div>

            <div className="p-6 border-t border-white/10 bg-[#001338] flex items-center justify-between">
              <button 
                type="button"
                onClick={() => setIsConfigModalOpen(false)} 
                className="px-6 py-3 text-xs font-bold text-white/50 hover:text-white uppercase tracking-wider transition-colors"
              >
                Fechar
              </button>
              <button 
                type="button"
                onClick={handleSaveServiceRoleKey} 
                disabled={isSavingKey || !serviceRoleKeyInput.trim()} 
                className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 px-8 py-3.5 rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg flex items-center space-x-2 disabled:opacity-50 active:scale-95 transition-all"
              >
                {isSavingKey ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                <span>Validar e Ativar</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ESPECÍFICO: ALTERAR SENHA DO COLABORADOR (EXCLUSIVO vinicius@ocomunicacao.com) */}
      {isPasswordModalOpen && passwordTargetUser && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-black/85 backdrop-blur-md" onClick={() => setIsPasswordModalOpen(false)} />
          <div className="bg-[#001a4d] border border-amber-500/40 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col relative z-10 animate-in zoom-in-95">
            {/* Modal Header */}
            <div className="px-8 py-6 border-b border-white/10 flex items-center justify-between bg-[#001338]">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-2xl border border-amber-500/30">
                  <Key size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-white uppercase tracking-tight">
                    Alterar Senha do Colaborador
                  </h3>
                  <p className="text-amber-400 text-[10px] font-bold uppercase tracking-wider">
                    Permissão exclusiva: vinicius@ocomunicacao.com
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsPasswordModalOpen(false)} 
                className="p-2 text-white/40 hover:text-white rounded-xl hover:bg-white/5 transition-all"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-8 space-y-6">
              {/* Informações do Colaborador Selecionado */}
              <div className="flex items-center space-x-4 bg-white/5 border border-white/10 p-4 rounded-2xl">
                <div className="w-12 h-12 rounded-2xl overflow-hidden border border-[#00A1E4]/40 bg-[#000d26] shrink-0">
                  <img 
                    src={passwordTargetUser.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(passwordTargetUser.name)}&background=00A1E4&color=fff`} 
                    alt={passwordTargetUser.name}
                    className="w-full h-full object-cover" 
                  />
                </div>
                <div className="overflow-hidden">
                  <h4 className="text-sm font-black text-white uppercase tracking-tight truncate">
                    {passwordTargetUser.name}
                  </h4>
                  <p className="text-white/50 text-xs truncate">
                    {passwordTargetUser.email}
                  </p>
                  <span className="inline-block bg-[#00A1E4]/15 text-[#00A1E4] text-[9px] font-black uppercase px-2 py-0.5 rounded-md mt-1">
                    {passwordTargetUser.role}
                  </span>
                </div>
              </div>

              {passwordModalError && (
                <div className="p-3.5 bg-red-500/15 border border-red-500/30 rounded-2xl flex flex-col space-y-2 text-red-300 text-xs">
                  <div className="flex items-center space-x-2">
                    <AlertCircle size={16} className="shrink-0" />
                    <span className="font-semibold">{passwordModalError}</span>
                  </div>
                  {(!hasServiceRoleKey || passwordModalError.includes('Service Role')) && (
                    <button
                      type="button"
                      onClick={() => setIsConfigModalOpen(true)}
                      className="self-start text-[10px] text-amber-300 hover:text-amber-200 underline uppercase font-bold"
                    >
                      Abrir tela de configuração da chave &rarr;
                    </button>
                  )}
                </div>
              )}

              {/* Box de Ativação Direta caso a chave ainda não tenha sido colada */}
              {!hasServiceRoleKey && (
                <div className="p-4 bg-gradient-to-br from-amber-500/20 via-[#001338] to-amber-500/10 border border-amber-500/40 rounded-2xl space-y-3">
                  <div className="flex items-start space-x-2.5">
                    <Key size={18} className="text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-white text-xs font-black uppercase tracking-wider">
                        Ativação Necessária: Chave Service Role
                      </p>
                      <p className="text-white/70 text-[11px] mt-1 leading-relaxed">
                        Para o CRM conseguir gravar a nova senha no Supabase sem você precisar abrir o dashboard, cole a chave <strong className="text-amber-300">service_role (secret)</strong> do Supabase uma única vez:
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2 pt-1">
                    <input
                      type="password"
                      value={serviceRoleKeyInput}
                      onChange={(e) => setServiceRoleKeyInput(e.target.value)}
                      placeholder="Cole aqui a chave service_role (eyJhbGci...)"
                      className="w-full bg-[#000d26] border border-amber-500/40 focus:border-amber-400 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white outline-none placeholder:text-white/20"
                    />
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={async () => {
                          await handleSaveServiceRoleKey();
                          if (newPasswordInput && newPasswordInput.trim().length >= 6) {
                            setTimeout(() => handleSavePasswordChange(), 500);
                          }
                        }}
                        disabled={isSavingKey || !serviceRoleKeyInput.trim()}
                        className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[10px] uppercase rounded-xl transition-all flex items-center justify-center space-x-1.5 disabled:opacity-50"
                      >
                        {isSavingKey ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                        <span>Ativar Chave & Salvar Senha</span>
                      </button>
                      <a
                        href="https://supabase.com/dashboard/project/aoxudaqhkdiyvahzfzuj/settings/api"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-2.5 bg-white/10 hover:bg-white/15 text-white/80 hover:text-white rounded-xl text-[10px] font-bold uppercase transition-all flex items-center space-x-1 shrink-0"
                        title="Abrir página de API no Supabase"
                      >
                        <span>Abrir Supabase</span>
                        <ExternalLink size={11} />
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {/* Input da Nova Senha */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black text-amber-400 uppercase tracking-widest flex items-center space-x-1.5">
                    <Key size={13} />
                    <span>Nova Senha no Supabase Auth *</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
                      const nums = '23456789';
                      let pass = 'Vec@';
                      for (let i = 0; i < 4; i++) pass += letters.charAt(Math.floor(Math.random() * letters.length));
                      pass += nums.charAt(Math.floor(Math.random() * nums.length));
                      pass += nums.charAt(Math.floor(Math.random() * nums.length));
                      pass += '!';
                      setNewPasswordInput(pass);
                    }}
                    className="flex items-center space-x-1 text-emerald-400 hover:text-emerald-300 text-[10px] font-bold uppercase transition-colors"
                  >
                    <Sparkles size={12} />
                    <span>Gerar Senha Forte</span>
                  </button>
                </div>

                <div className="relative">
                  <input 
                    type={showPassword ? 'text' : 'password'} 
                    value={newPasswordInput} 
                    onChange={(e) => setNewPasswordInput(e.target.value)} 
                    placeholder="Mínimo 6 caracteres (Ex: Vec@8491!)"
                    className="w-full bg-[#000d26] border border-white/15 focus:border-amber-400 rounded-2xl pl-4 pr-24 py-3.5 text-sm font-mono font-bold text-white outline-none transition-all placeholder:text-white/20" 
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center space-x-1">
                    {newPasswordInput && (
                      <button
                        type="button"
                        onClick={() => copyToClipboard(newPasswordInput)}
                        className="p-1.5 text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                        title="Copiar Senha"
                      >
                        {copiedPassword ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="p-1.5 text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                      title={showPassword ? "Ocultar Senha" : "Exibir Senha"}
                    >
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                {copiedPassword && (
                  <p className="text-emerald-400 text-[10px] font-bold flex items-center space-x-1">
                    <CheckCircle2 size={12} />
                    <span>Senha copiada para enviar ao colaborador!</span>
                  </p>
                )}

                <p className="text-[10px] text-white/40 leading-relaxed">
                  A nova senha é gravada diretamente no Supabase Authentication. O colaborador poderá entrar no sistema imediatamente com essa senha.
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-white/10 bg-[#001338] flex items-center justify-between">
              <button 
                type="button"
                onClick={() => setIsPasswordModalOpen(false)} 
                className="px-6 py-3 text-xs font-bold text-white/50 hover:text-white uppercase tracking-wider transition-colors"
              >
                Cancelar
              </button>
              <button 
                type="button"
                onClick={handleSavePasswordChange} 
                disabled={isSavingPassword || !newPasswordInput || newPasswordInput.trim().length < 6} 
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-8 py-3.5 rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg flex items-center space-x-2 disabled:opacity-50 active:scale-95 transition-all"
              >
                {isSavingPassword ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                <span>Salvar Nova Senha no Supabase</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersManagement;