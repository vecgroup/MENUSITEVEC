import React, { useState, useEffect, useRef, useCallback } from 'react';
import { User } from '../types';
import { supabase, supabaseClient, buildSSOUrl } from '../lib/supabase';
import { 
  RefreshCw, 
  ExternalLink, 
  Loader2, 
  AlertCircle, 
  Maximize2, 
  Minimize2, 
  ShieldCheck, 
  ArrowLeft 
} from 'lucide-react';

interface EmbeddedPortalProps {
  title: string;
  baseUrl: string;
  user: User;
  icon?: React.ReactNode;
  avatarUrl?: string;
  cnpj?: string;
  phone?: string;
  leadName?: string;
  leadId?: string;
  onBack?: () => void;
  onBackToDashboard?: () => void;
  showExternalButton?: boolean;
  isFullScreen?: boolean;
  onToggleFullScreen?: (full: boolean) => void;
  onToggleNativeView?: () => void;
  nativeViewLabel?: string;
}

export const EmbeddedPortal: React.FC<EmbeddedPortalProps> = ({
  title,
  baseUrl,
  user,
  icon,
  avatarUrl,
  cnpj,
  phone,
  leadName,
  leadId,
  onBack,
  onBackToDashboard,
  showExternalButton = true,
  isFullScreen: controlledFullScreen,
  onToggleFullScreen,
  onToggleNativeView,
  nativeViewLabel = "Modo Integrado"
}) => {
  const [iframeSrc, setIframeSrc] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [iframeKey, setIframeKey] = useState(0);
  const [internalFullScreen, setInternalFullScreen] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const isFullScreen = controlledFullScreen !== undefined ? controlledFullScreen : internalFullScreen;

  const handleToggleFullScreen = () => {
    const next = !isFullScreen;
    setInternalFullScreen(next);
    if (onToggleFullScreen) {
      onToggleFullScreen(next);
    }
  };

  const handleBack = onBack || onBackToDashboard;

  // Generate target URL with SSO parameters & Hash Session Token (WITHOUT type=recovery)
  const prepareSessionUrl = useCallback(async () => {
    setIsLoading(true);
    setAuthError(null);

    try {
      const extraParams: Record<string, string | undefined> = {};
      if (cnpj) extraParams.cnpj = cnpj.replace(/\D/g, '');
      if (phone) extraParams.phone = phone.replace(/\D/g, '');
      if (leadName) extraParams.name = leadName;
      if (leadId) extraParams.leadId = leadId;
      if (user?.email) extraParams.email = user.email;

      const fullSsoUrl = await buildSSOUrl(baseUrl, extraParams);
      setIframeSrc(fullSsoUrl);
    } catch (err: any) {
      console.error(`[EmbeddedPortal ${title}] Erro ao preparar SSO:`, err);
      setAuthError('Não foi possível sincronizar a sessão. Você pode tentar recarregar ou abrir externamente.');
      setIframeSrc(baseUrl);
    }
  }, [baseUrl, cnpj, phone, leadName, leadId, user, title]);

  useEffect(() => {
    prepareSessionUrl();
  }, [prepareSessionUrl, iframeKey]);

  // PostMessage Bridge for cross-frame token synchronization
  const sendSessionToIframe = useCallback(async () => {
    if (!iframeRef.current?.contentWindow) return;

    try {
      const { data } = await supabase.auth.getSession();
      let session = data?.session;
      if (!session?.access_token) {
        const ref = await supabaseClient.auth.refreshSession().catch(() => ({ data: { session: null } }));
        if (ref.data?.session?.access_token) {
          session = ref.data.session;
        }
      }

      if (session?.access_token) {
        const sessionPayload = {
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          expires_in: session.expires_in,
          token_type: session.token_type || 'bearer',
          user: {
            id: user.id || session.user?.id,
            email: user.email || session.user?.email,
            name: user.name,
            role: user.role
          }
        };

        const target = iframeRef.current.contentWindow;

        // Post standard message events so whatever listener the child app implements, it receives it
        const messages = [
          { type: 'VEC_AUTH_SYNC', source: 'VEC_CRM_MAIN', session: sessionPayload, ...sessionPayload },
          { type: 'VEC_AUTH_SESSION', source: 'VEC_CRM_MAIN', session: sessionPayload, ...sessionPayload },
          { type: 'SUPABASE_SESSION', session: sessionPayload, ...sessionPayload },
          { type: 'SET_SESSION', session: sessionPayload, ...sessionPayload },
          { type: 'VEC_SSO_INIT', session: sessionPayload, ...sessionPayload },
          { type: 'AUTH_STATE_CHANGE', event: 'SIGNED_IN', session: sessionPayload }
        ];

        messages.forEach(msg => {
          try {
            target.postMessage(msg, '*');
          } catch (_) {}
        });
      }
    } catch (e) {
      console.warn(`[EmbeddedPortal ${title}] Falha ao enviar postMessage para iframe:`, e);
    }
  }, [user, title]);

  // Listen for messages from the embedded iframe requesting auth
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const isAllowedOrigin = 
        typeof event.origin === 'string' && (
          event.origin.includes('vecgroup.com.br') || 
          event.origin.includes('localhost') ||
          event.origin.includes('run.app') ||
          event.origin === '*'
        );

      if (isAllowedOrigin && event.data) {
        const type = String(event.data.type || event.data.action || '').toUpperCase();
        if (
          type.includes('AUTH') || 
          type.includes('SESSION') || 
          type.includes('READY') || 
          type.includes('INIT') ||
          type.includes('SSO') ||
          type.includes('PING')
        ) {
          console.log(`[EmbeddedPortal ${title}] Iframe solicitou sincronização de sessão: ${type}`);
          sendSessionToIframe();
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [sendSessionToIframe, title]);

  const handleIframeLoad = () => {
    setIsLoading(false);
    // Sequence of handshake pings to ensure React hydration catches the session
    const delays = [150, 500, 1200, 2500];
    delays.forEach(delay => {
      setTimeout(() => {
        sendSessionToIframe();
      }, delay);
    });
  };

  const handleRefresh = () => {
    setIsLoading(true);
    setIframeKey(prev => prev + 1);
  };

  const handleOpenExternal = async () => {
    try {
      const extraParams: Record<string, string | undefined> = {};
      if (cnpj) extraParams.cnpj = cnpj.replace(/\D/g, '');
      if (phone) extraParams.phone = phone.replace(/\D/g, '');
      if (leadName) extraParams.name = leadName;
      if (leadId) extraParams.leadId = leadId;
      if (user?.email) extraParams.email = user.email;

      const targetUrl = await buildSSOUrl(baseUrl, extraParams);
      window.open(targetUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      window.open(baseUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className={`w-full h-full relative bg-[#000d26] overflow-hidden flex flex-col ${isFullScreen ? 'fixed inset-0 z-[9999] w-screen h-screen' : ''}`}>
      {/* Top Floating Control Bar - Centered, Compact Pill style */}
      {showExternalButton && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[10000] flex items-center space-x-1.5 bg-[#000d26]/85 hover:bg-[#000d26]/95 backdrop-blur-md border border-white/15 px-3 py-1 rounded-full shadow-2xl transition-all duration-200 pointer-events-auto">
          {handleBack && (
            <>
              <button
                type="button"
                onClick={handleBack}
                title="Voltar para a tela anterior do VEC CRM"
                className="flex items-center space-x-1 text-white/85 hover:text-white hover:bg-white/10 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase transition-all group"
              >
                <ArrowLeft size={11} className="text-emerald-400 group-hover:-translate-x-0.5 transition-transform" />
                <span>Voltar</span>
              </button>
              <div className="w-[1px] h-3 bg-white/15" />
            </>
          )}

          {onToggleNativeView && (
            <>
              <button
                type="button"
                onClick={onToggleNativeView}
                title="Alternar para a visualização integrada nativa (sem iframe)"
                className="flex items-center space-x-1 text-[#00A1E4] hover:text-white hover:bg-[#00A1E4]/20 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase transition-all"
              >
                <ShieldCheck size={11} />
                <span>{nativeViewLabel}</span>
              </button>
              <div className="w-[1px] h-3 bg-white/15" />
            </>
          )}

          <button
            type="button"
            onClick={handleOpenExternal}
            title={`Abrir ${title} em nova aba externa`}
            className="flex items-center space-x-1 text-white/85 hover:text-white hover:bg-white/10 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase transition-all"
          >
            <ExternalLink size={11} className="text-emerald-400" />
            <span className="hidden sm:inline">Externo</span>
          </button>

          <div className="w-[1px] h-3 bg-white/15" />

          <button
            type="button"
            onClick={handleRefresh}
            title="Recarregar e sincronizar"
            className="p-1 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-all"
          >
            <RefreshCw size={11} className={isLoading ? 'animate-spin text-emerald-400' : ''} />
          </button>

          <button
            type="button"
            onClick={handleToggleFullScreen}
            title={isFullScreen ? "Sair da tela cheia" : "Tela Cheia"}
            className="p-1 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-all"
          >
            {isFullScreen ? <Minimize2 size={11} /> : <Maximize2 size={11} />}
          </button>

          {user?.email && (
            <>
              <div className="w-[1px] h-3 bg-white/15 hidden md:block" />
              <div className="hidden md:flex items-center space-x-1 text-white/40 text-[9px] font-semibold pl-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="truncate max-w-[120px]">{user.email}</span>
              </div>
            </>
          )}
        </div>
      )}

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-20 bg-[#000d26]/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
          <div className="relative mb-4">
            <div className="w-16 h-16 rounded-2xl bg-[#00A1E4]/20 border border-[#00A1E4]/40 flex items-center justify-center shadow-xl shadow-[#00A1E4]/10 animate-pulse">
              {avatarUrl ? (
                <img 
                  src={avatarUrl} 
                  alt={title} 
                  className="w-10 h-10 object-contain"
                  referrerPolicy="no-referrer"
                />
              ) : icon ? (
                <div className="text-[#00A1E4]">{icon}</div>
              ) : (
                <ShieldCheck size={28} className="text-[#00A1E4]" />
              )}
            </div>
            <div className="absolute -bottom-2 -right-2 bg-[#00A1E4] p-1.5 rounded-xl border border-white/20 shadow-md">
              <Loader2 size={14} className="text-white animate-spin" />
            </div>
          </div>
          
          <h3 className="text-white font-black text-sm uppercase tracking-wider mb-1">
            Conectando ao {title}
          </h3>
          <p className="text-white/50 text-xs max-w-sm">
            Sincronizando com <span className="text-[#00A1E4] font-semibold">{user.email}</span>...
          </p>
        </div>
      )}

      {/* Error Notification banner if any */}
      {authError && (
        <div className="absolute top-4 left-4 right-28 z-30 bg-amber-500/20 border border-amber-500/40 backdrop-blur-md rounded-xl p-3 flex items-center justify-between text-amber-200 text-xs">
          <div className="flex items-center space-x-2">
            <AlertCircle size={16} className="text-amber-400 shrink-0" />
            <span>{authError}</span>
          </div>
          <div className="flex items-center space-x-2 ml-3">
            <button
              onClick={handleRefresh}
              className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg text-[10px] uppercase transition-all shrink-0"
            >
              Tentar Novamente
            </button>
            <button
              onClick={handleOpenExternal}
              className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white font-bold rounded-lg text-[10px] uppercase transition-all shrink-0"
            >
              Abrir Externo
            </button>
          </div>
        </div>
      )}

      {/* The Live Iframe (NO SANDBOX: Allows normal execution of sister web apps without storage/broadcast denial) */}
      {iframeSrc && (
        <iframe
          key={iframeKey}
          ref={iframeRef}
          src={iframeSrc}
          title={title}
          onLoad={handleIframeLoad}
          allow="camera; microphone; clipboard-read; clipboard-write; notifications; display-capture; autoplay; encrypted-media; geolocation; storage-access; web-share"
          className="w-full h-full border-0 bg-[#000d26]"
          loading="eager"
        />
      )}
    </div>
  );
};

export default EmbeddedPortal;
