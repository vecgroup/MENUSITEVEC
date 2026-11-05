import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { createClient } from '@supabase/supabase-js';

const PORT = Number(process.env.PORT) || 3000;
const app = express();

app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

const PRIMARY_URL = 'https://aoxudaqhkdiyvahzfzuj.supabase.co';
const PRIMARY_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFveHVkYXFoa2RpeXZhaHpmenVqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMDAyNTksImV4cCI6MjA4NDY3NjI1OX0.G7qoSDpTTXSIiSOf37wOupel3PmjfYUzNG7v4iNtUfs';

const CONFIG_FILE = path.join(process.cwd(), 'supabase-admin-config.json');
const ENV_FILE = path.join(process.cwd(), '.env');

// Helper to get Service Role Key from memory, file, or environment
function getServiceRoleKey(): string | null {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY.trim() !== '') {
    return process.env.SUPABASE_SERVICE_ROLE_KEY.trim();
  }
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const content = fs.readFileSync(CONFIG_FILE, 'utf-8');
      const data = JSON.parse(content);
      if (data?.serviceRoleKey && typeof data.serviceRoleKey === 'string' && data.serviceRoleKey.trim() !== '') {
        return data.serviceRoleKey.trim();
      }
    }
  } catch (e) {
    console.warn('[Admin] Erro ao ler supabase-admin-config.json:', e);
  }

  try {
    if (fs.existsSync(ENV_FILE)) {
      const envContent = fs.readFileSync(ENV_FILE, 'utf-8');
      const match = envContent.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
  } catch (e) {
    console.warn('[Admin] Erro ao ler .env:', e);
  }

  return null;
}

function saveServiceRoleKey(key: string) {
  process.env.SUPABASE_SERVICE_ROLE_KEY = key.trim();
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify({
      serviceRoleKey: key.trim(),
      updatedAt: new Date().toISOString()
    }, null, 2), 'utf-8');
  } catch (e) {
    console.warn('[Admin] Aviso ao salvar supabase-admin-config.json:', e);
  }
  try {
    let envContent = '';
    if (fs.existsSync(ENV_FILE)) {
      envContent = fs.readFileSync(ENV_FILE, 'utf-8');
    }
    if (envContent.includes('SUPABASE_SERVICE_ROLE_KEY=')) {
      envContent = envContent.replace(/SUPABASE_SERVICE_ROLE_KEY=.*/, `SUPABASE_SERVICE_ROLE_KEY=${key.trim()}`);
    } else {
      envContent += `\nSUPABASE_SERVICE_ROLE_KEY=${key.trim()}\n`;
    }
    fs.writeFileSync(ENV_FILE, envContent.trim() + '\n', 'utf-8');
  } catch (e) {
    console.warn('[Admin] Aviso ao salvar .env:', e);
  }
}

function getSupabaseAdmin() {
  const serviceRoleKey = getServiceRoleKey();
  if (!serviceRoleKey) return null;
  return createClient(PRIMARY_URL, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

// API ROUTE: Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'VEC GROUP CRM API',
    hasServiceRoleKey: !!getServiceRoleKey(),
    timestamp: new Date().toISOString()
  });
});

// API ROUTE: Check Admin Auth Status
app.get('/api/admin/status', (_req: Request, res: Response) => {
  const key = getServiceRoleKey();
  res.json({
    hasServiceRoleKey: !!key,
    supabaseUrl: PRIMARY_URL
  });
});

// API ROUTE: Save Service Role Key
app.post('/api/admin/config', async (req: Request, res: Response) => {
  try {
    const { serviceRoleKey } = req.body;
    if (!serviceRoleKey || typeof serviceRoleKey !== 'string' || serviceRoleKey.trim().length < 20) {
      return res.status(400).json({ error: 'Chave Service Role inválida ou muito curta.' });
    }

    const testClient = createClient(PRIMARY_URL, serviceRoleKey.trim(), {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Test the key against auth admin
    const { error: testError } = await testClient.auth.admin.listUsers({ page: 1, perPage: 1 });
    if (testError) {
      return res.status(400).json({ 
        error: `A chave informada foi recusada pelo Supabase: ${testError.message}. Verifique se copiou a chave 'service_role' (secret) e não a anon key.`
      });
    }

    saveServiceRoleKey(serviceRoleKey);
    console.log('[Admin] Chave Service Role validada e salva com sucesso!');
    return res.json({ success: true, message: 'Chave Service Role ativada com sucesso!' });
  } catch (err: any) {
    console.error('[Admin] Erro ao validar chave:', err);
    return res.status(500).json({ error: err.message || 'Erro interno ao validar chave.' });
  }
});

// API ROUTE: List users (via admin with fallback)
app.get('/api/admin/users', async (_req: Request, res: Response) => {
  try {
    const admin = getSupabaseAdmin();
    if (admin) {
      const { data, error } = await admin.from('profiles').select('*');
      if (!error && data) {
        return res.json({ users: data });
      }
    }
    // Fallback to anon
    const anon = createClient(PRIMARY_URL, PRIMARY_KEY);
    const { data, error } = await anon.from('profiles').select('*');
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    return res.json({ users: data || [] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// API ROUTE: Create User in Supabase Auth & public.profiles
app.post('/api/admin/users', async (req: Request, res: Response) => {
  try {
    const { name, email, password, role, phone, birthDate, admissionDate, status, avatar } = req.body;

    if (!name || !email) {
      return res.status(400).json({ error: 'Nome e E-mail são obrigatórios.' });
    }

    const reqRole = String(req.body.requesterRole || req.headers['x-user-role'] || '').toUpperCase().trim();
    const reqEmail = String(req.body.requesterEmail || req.headers['x-user-email'] || '').toLowerCase().trim();
    const targetRole = String(role || 'VENDEDOR').toUpperCase().trim();
    const cleanStatus = String(status || 'ATIVO').trim().toUpperCase();

    // Regra: Apenas Owner pode criar usuários com cargo de OWNER
    if (targetRole === 'OWNER') {
      if (reqRole !== 'OWNER' && reqEmail !== 'vinicius@ocomunicacao.com') {
        return res.status(403).json({ error: 'Permissão negada: apenas o Owner pode cadastrar usuários com o cargo de Owner.' });
      }
    }

    // Regra: Supervisor só consegue adicionar vendedor e adm
    if (reqRole === 'SUPERVISOR') {
      const allowedForSupervisor = ['VENDEDOR', 'ADMINISTRADOR', 'ADMINISTRATIVO', 'ADMIN'];
      if (!allowedForSupervisor.includes(targetRole)) {
        return res.status(403).json({ 
          error: 'Supervisores só têm autorização para cadastrar colaboradores nos cargos de Vendedor ou Administrador (Adm).' 
        });
      }
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const admin = getSupabaseAdmin();
    let authUserId: string;

    if (admin) {
      // 1. Create in Supabase Authentication using Admin API (instant email_confirm)
      const { data: createData, error: createError } = await admin.auth.admin.createUser({
        email: normalizedEmail,
        password: password,
        email_confirm: true,
        user_metadata: {
          name: name.trim(),
          full_name: name.trim(),
          role: targetRole
        }
      });

      if (createError) {
        const errLower = (createError.message || '').toLowerCase();
        if (errLower.includes('already registered') || errLower.includes('already exists') || errLower.includes('duplicate')) {
          // Find existing auth user
          const { data: userList } = await admin.auth.admin.listUsers();
          const existing = (userList?.users as any[])?.find((u: any) => u.email?.toLowerCase() === normalizedEmail);
          if (existing) {
            authUserId = existing.id;
            // Update password and metadata
            await admin.auth.admin.updateUserById(existing.id, {
              password,
              email_confirm: true,
              user_metadata: { name: name.trim(), full_name: name.trim(), role: role || 'VENDEDOR' }
            });
          } else {
            return res.status(400).json({ error: createError.message });
          }
        } else {
          return res.status(400).json({ error: `Erro no Supabase Auth: ${createError.message}` });
        }
      } else {
        authUserId = createData.user.id;
      }
    } else {
      // Fallback: Create in Supabase Authentication using anon.auth.signUp
      const anon = createClient(PRIMARY_URL, PRIMARY_KEY, {
        auth: { autoRefreshToken: false, persistSession: false }
      });
      const { data: signUpData, error: signUpError } = await anon.auth.signUp({
        email: normalizedEmail,
        password: password,
        options: {
          data: {
            name: name.trim(),
            full_name: name.trim(),
            role: role || 'VENDEDOR'
          }
        }
      });

      if (signUpError) {
        const errLower = (signUpError.message || '').toLowerCase();
        if (errLower.includes('already registered') || errLower.includes('already exists') || errLower.includes('duplicate')) {
          return res.status(400).json({ error: 'Este e-mail já possui cadastro no Supabase Authentication.' });
        }
        return res.status(400).json({ error: `Erro no Supabase Auth: ${signUpError.message}` });
      }

      if (!signUpData?.user) {
        return res.status(400).json({ error: 'Não foi possível registrar o usuário no Supabase Auth.' });
      }

      authUserId = signUpData.user.id;
    }

    // 2. Save into public.profiles database table
    const profilePayload: any = {
      id: authUserId,
      full_name: name.trim(),
      email: normalizedEmail,
      role: targetRole,
      status: cleanStatus,
      phone: phone || null,
      birth_date: birthDate || null,
      admission_date: admissionDate || null,
      avatar_url: avatar || null
    };

    const clientToUse = admin || createClient(PRIMARY_URL, PRIMARY_KEY);
    const { error: profileError } = await clientToUse.from('profiles').upsert(profilePayload, { onConflict: 'id' });
    if (profileError) {
      console.warn('[Admin] Aviso ao salvar perfil completo (tentando sem admission_date):', profileError.message);
      delete profilePayload.admission_date;
      const retry = await clientToUse.from('profiles').upsert(profilePayload, { onConflict: 'id' });
      if (retry.error) {
        console.error('[Admin] Erro no retry do perfil:', retry.error);
      }
    }

    console.log(`[Admin] Usuário criado com sucesso no Auth e Profiles: ${normalizedEmail} (${authUserId})`);
    return res.json({
      success: true,
      user: {
        id: authUserId,
        name: name.trim(),
        email: normalizedEmail,
        role: role || 'VENDEDOR',
        status: status || 'ATIVO'
      }
    });
  } catch (err: any) {
    console.error('[Admin] Erro na rota de criação de usuário:', err);
    return res.status(500).json({ error: err.message || 'Erro interno ao criar usuário.' });
  }
});

// API ROUTE: Update User in public.profiles and optionally reset password in Supabase Auth
app.put('/api/admin/users/:id', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const { name, email, password, role, phone, birthDate, admissionDate, status, avatar } = req.body;

    const normalizedEmail = email ? String(email).trim().toLowerCase() : undefined;
    const reqRole = String(req.body.requesterRole || req.headers['x-user-role'] || '').toUpperCase().trim();
    const reqEmail = String(req.body.requesterEmail || req.headers['x-user-email'] || '').toLowerCase().trim();
    const targetRole = role ? String(role).toUpperCase().trim() : undefined;
    const cleanStatus = status ? String(status).toUpperCase().trim() : undefined;
    const admin = getSupabaseAdmin();

    // Regra: Somente o Owner pode atribuir ou promover alguém a OWNER
    if (targetRole === 'OWNER') {
      if (reqRole !== 'OWNER' && reqEmail !== 'vinicius@ocomunicacao.com') {
        return res.status(403).json({ error: 'Permissão negada: apenas o Owner pode alterar ou atribuir o cargo de Owner.' });
      }
    }

    // Regra: Supervisor só consegue alterar/atribuir vendedor e adm
    if (reqRole === 'SUPERVISOR') {
      const checkClient = admin || createClient(PRIMARY_URL, PRIMARY_KEY);
      const { data: targetProfile } = await checkClient.from('profiles').select('role').eq('id', id).maybeSingle();
      if (targetProfile && String(targetProfile.role).toUpperCase().trim() === 'OWNER') {
        return res.status(403).json({ error: 'Permissão negada: supervisores não podem alterar o perfil de um Owner.' });
      }
      if (targetRole && !['VENDEDOR', 'ADMINISTRADOR', 'ADMINISTRATIVO', 'ADMIN'].includes(targetRole)) {
        return res.status(403).json({ 
          error: 'Supervisores só têm permissão para definir os cargos de Vendedor ou Administrador (Adm).' 
        });
      }
    }

    if (admin) {
      // If password provided, update in auth.users (restricted to vinicius@ocomunicacao.com)
      if (password && password.length >= 6) {
        if (reqEmail !== 'vinicius@ocomunicacao.com') {
          return res.status(403).json({ error: 'Apenas o usuário vinicius@ocomunicacao.com tem permissão para alterar a senha de colaboradores.' });
        }
        const updateAuthPayload: any = { password };
        if (normalizedEmail) updateAuthPayload.email = normalizedEmail;
        if (name) updateAuthPayload.user_metadata = { name: name.trim(), full_name: name.trim(), role: targetRole };
        
        const { error: authErr } = await admin.auth.admin.updateUserById(id, updateAuthPayload);
        if (authErr) {
          console.warn('[Admin] Aviso ao atualizar senha no Auth:', authErr.message);
          return res.status(400).json({ error: `Erro ao atualizar senha no Supabase: ${authErr.message}` });
        }
      }

      // Update in public.profiles
      const profilePayload: any = {
        id,
        full_name: name?.trim(),
        email: normalizedEmail,
        role: targetRole || 'VENDEDOR',
        status: cleanStatus || 'ATIVO',
        phone: phone || null,
        birth_date: birthDate || null,
        admission_date: admissionDate || null,
        avatar_url: avatar || null
      };

      const { error: profileErr } = await admin.from('profiles').upsert(profilePayload, { onConflict: 'id' });
      if (profileErr) {
        delete profilePayload.admission_date;
        await admin.from('profiles').upsert(profilePayload, { onConflict: 'id' });
      }

      return res.json({ success: true });
    }

    // Fallback if no service role key
    const anon = createClient(PRIMARY_URL, PRIMARY_KEY);
    const profilePayload: any = {
      id,
      full_name: name?.trim(),
      email: normalizedEmail,
      role: role || 'VENDEDOR',
      status: status || 'ATIVO',
      phone: phone || null,
      birth_date: birthDate || null,
      avatar_url: avatar || null
    };
    await anon.from('profiles').upsert(profilePayload, { onConflict: 'id' });
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// API ROUTE: Change Password specifically (Restricted to vinicius@ocomunicacao.com)
app.post('/api/admin/users/:id/change-password', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const { password, requesterEmail } = req.body;
    const reqEmail = String(requesterEmail || req.headers['x-user-email'] || '').toLowerCase().trim();

    if (reqEmail !== 'vinicius@ocomunicacao.com') {
      return res.status(403).json({ 
        error: 'Acesso negado: apenas o administrador vinicius@ocomunicacao.com possui autorização para alterar senhas de colaboradores.' 
      });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'A nova senha deve ter no mínimo 6 caracteres.' });
    }

    const admin = getSupabaseAdmin();
    if (!admin) {
      return res.status(400).json({ 
        error: 'A chave Service Role do Supabase não está configurada no servidor. Conecte a chave no painel de equipe.' 
      });
    }

    const { error: authErr } = await admin.auth.admin.updateUserById(id, { password });
    if (authErr) {
      return res.status(400).json({ error: `Erro no Supabase Auth: ${authErr.message}` });
    }

    console.log(`[Admin] Senha do colaborador ${id} alterada com sucesso por ${reqEmail}`);
    return res.json({ 
      success: true, 
      message: 'Senha do colaborador alterada com sucesso no Supabase Authentication!' 
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Erro interno ao alterar senha.' });
  }
});

// API ROUTE: Delete User from Supabase Auth & public.profiles
app.delete('/api/admin/users/:id', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const reqRole = String(req.headers['x-user-role'] || req.query.requesterRole || '').toUpperCase().trim();
    const admin = getSupabaseAdmin();
    const checkClient = admin || createClient(PRIMARY_URL, PRIMARY_KEY);

    // Impedir que não-owners excluam o perfil de um Owner
    const { data: targetProfile } = await checkClient.from('profiles').select('role').eq('id', id).maybeSingle();
    if (targetProfile && String(targetProfile.role).toUpperCase().trim() === 'OWNER' && reqRole !== 'OWNER') {
      return res.status(403).json({ error: 'Permissão negada: não é permitido excluir um perfil de Owner.' });
    }

    let authDeleted = false;
    if (admin) {
      // Delete from auth.users
      const { error: authErr } = await admin.auth.admin.deleteUser(id);
      if (authErr) {
        console.warn(`[Admin] Aviso ao deletar do Auth (${id}):`, authErr.message);
      } else {
        authDeleted = true;
      }

      // Delete from public.profiles
      await admin.from('profiles').delete().eq('id', id);

      return res.json({
        success: true,
        authDeleted,
        message: 'Usuário excluído do Supabase Authentication e do banco de dados com sucesso.'
      });
    }

    // Fallback: delete only from profiles
    const anon = createClient(PRIMARY_URL, PRIMARY_KEY);
    await anon.from('profiles').delete().eq('id', id);

    return res.json({
      success: true,
      authDeleted: false,
      message: 'Perfil removido do banco de dados. Configure a chave Service Role para remover automaticamente do Auth.'
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// VITE MIDDLEWARE & SERVING
async function startServer() {
  try {
    if (process.env.NODE_ENV !== 'production') {
      const vite = await createViteServer({
        server: { 
          middlewareMode: true,
          hmr: false
        },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } else {
      const distPath = path.join(process.cwd(), 'dist');
      app.use(express.static(distPath));
      app.get('*all', (_req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }

    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`[VEC GROUP CRM Server] Rodando na porta ${PORT}`);
    });

    server.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`[VEC GROUP CRM Server] Porta ${PORT} já está em uso.`);
      } else {
        console.error('[VEC GROUP CRM Server] Erro no servidor Express:', err);
      }
    });
  } catch (err) {
    console.error('[VEC GROUP CRM Server] Falha ao iniciar servidor:', err);
  }
}

startServer();
