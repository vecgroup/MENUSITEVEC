import React, { useState, useEffect, useRef, useCallback } from 'react';
import { User } from '../types';
import { supabase } from '../lib/supabase';
import { 
  RefreshCw, 
  ExternalLink, 
  Loader2, 
  AlertCircle, 
  Maximize2, 
  Minimize2,
  ArrowLeft,
  MessageSquare,
  Building,
  PhoneCall,
  CheckCircle2
} from 'lucide-react';

interface WhatsAppCRMProps {
  user: User;
  cnpj?: string;
  phone?: string;
  leadName?: string;
  company?: string;
  leadId?: string;
  onBack?: () => void;
  onBackToDashboard?: () => void;
  showExternalButton?: boolean;
  isFullScreen?: boolean;
  onToggleFullScreen?: (full: boolean) => void;
}

const WHATSAPP_BASE_URL = 'https://whatsapp.vecgroup.com.br';
const WHATSAPP_AVATAR_URL = 'https://i.imgur.com/Y1YwAp2.png';

export const WhatsAppCRM: React.FC<WhatsAppCRMProps> = ({
  user,
  cnpj,
  phone,
  leadName,
  company,
  leadId,
  onBack,
  onBackToDashboard,
  showExternalButton = true,
  isFullScreen: controlledFullScreen,
  onToggleFullScreen
}) => {
  const handleBack = onBack || onBackToDashboard;
  const [iframeSrc, setIframeSrc] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [iframeKey, setIframeKey] = useState(0);
  const [internalFullScreen, setInternalFullScreen] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const handshakeTimerRef = useRef<NodeJS.Timeout | null>(null);

  const isFullScreen = controlledFullScreen !== undefined ? controlledFullScreen : internalFullScreen;

  const handleToggleFullScreen = () => {
    const next = !isFullScreen;
    setInternalFullScreen(next);
    if (onToggleFullScreen) {
      onToggleFullScreen(next);
    }
  };

  // Normalize phone digits (ensure DDI 55 for standard 10 or 11-digit BR numbers)
  const formatPhone = useCallback((raw?: string): { formatted: string; rawDigits: string } => {
    if (!raw) return { formatted: '', rawDigits: '' };
    const digits = raw.replace(/\D/g, '');
    if (!digits) return { formatted: '', rawDigits: '' };
    
    // Add Brazil DDI 55 if not already present
    if (digits.length === 10 || digits.length === 11) {
      return { formatted: `55${digits}`, rawDigits: digits };
    }
    return { formatted: digits, rawDigits: digits };
  }, []);

  const { formatted: normalizedPhone, rawDigits: rawPhoneDigits } = formatPhone(phone);
  const cleanCnpj = cnpj ? cnpj.replace(/\D/g, '') : '';
  const effectiveCompanyName = company || leadName || '';

  // Generate target URL with SSO parameters & Hash Session Token
  const prepareSessionUrl = useCallback(async () => {
    setIsLoading(true);
    setAuthError(null);

    try {
      const res = await supabase.auth.getSession();
      const session = res.data?.session;

      const urlObj = new URL(WHATSAPP_BASE_URL);

      // Deep Linking parameters
      if (cleanCnpj) {
        urlObj.searchParams.set('cnpj', cleanCnpj);
      }
      if (normalizedPhone) {
        urlObj.searchParams.set('phone', normalizedPhone);
        if (rawPhoneDigits) urlObj.searchParams.set('rawPhone', rawPhoneDigits);
      }
      if (leadName) {
        urlObj.searchParams.set('name', leadName);
        urlObj.searchParams.set('leadName', leadName);
      }
      if (effectiveCompanyName) {
        urlObj.searchParams.set('company', effectiveCompanyName);
        urlObj.searchParams.set('company_name', effectiveCompanyName);
      }
      if (leadId) {
        urlObj.searchParams.set('leadId', leadId);
        urlObj.searchParams.set('lead_id', leadId);
      }

      // User session context
      if (user?.email) urlObj.searchParams.set('email', user.email);
      if (user?.id) urlObj.searchParams.set('user_id', user.id);
      if (user?.name) urlObj.searchParams.set('user_name', user.name);
      if (user?.role) urlObj.searchParams.set('user_role', user.role);

      // Automatic trigger flags
      if (normalizedPhone || cleanCnpj) {
        urlObj.searchParams.set('auto_open', 'true');
        urlObj.searchParams.set('autoselect', '1');
        urlObj.searchParams.set('direct', '1');
      }
      urlObj.searchParams.set('embed', 'true');
      urlObj.searchParams.set('iframe', 'true');
      urlObj.searchParams.set('v', String(Date.now()));
      urlObj.searchParams.set('sso', '1');

      if (session?.user?.email) {
        urlObj.searchParams.set('user_email', session.user.email);
        if (!urlObj.searchParams.has('email')) urlObj.searchParams.set('email', session.user.email);
      }
      if (session?.user?.id) {
        urlObj.searchParams.set('user_id', session.user.id);
      }

      setIframeSrc(urlObj.toString());
    } catch (err: any) {
      console.error('[WhatsApp CRM] Erro ao preparar SSO para WhatsApp CRM:', err);
      setAuthError('Não foi possível sincronizar a sessão. Você pode tentar recarregar ou abrir externamente.');
      setIframeSrc(WHATSAPP_BASE_URL);
    }
  }, [cleanCnpj, normalizedPhone, rawPhoneDigits, leadName, effectiveCompanyName, leadId, user]);

  useEffect(() => {
    prepareSessionUrl();
  }, [prepareSessionUrl, iframeKey]);

  // PostMessage Bridge for cross-frame token synchronization & deep linking
  const sendSessionToIframe = useCallback(async () => {
    if (!iframeRef.current?.contentWindow) return;

    try {
      const res = await supabase.auth.getSession();
      const session = res.data?.session;

      if (session) {
        const payload = {
          type: 'VEC_AUTH_SYNC',
          source: 'VEC_CRM_MAIN',
          session: {
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
          },
          target: {
            phone: normalizedPhone,
            rawPhone: rawPhoneDigits,
            cnpj: cleanCnpj,
            name: leadName,
            company: effectiveCompanyName,
            leadId
          }
        };

        // Post main auth sync to iframe window
        iframeRef.current.contentWindow.postMessage(payload, '*');

        // Also post targeted conversation selection events
        if (normalizedPhone || cleanCnpj) {
          iframeRef.current.contentWindow.postMessage({
            type: 'OPEN_CONVERSATION',
            phone: normalizedPhone,
            rawPhone: rawPhoneDigits,
            cnpj: cleanCnpj,
            name: leadName,
            company: effectiveCompanyName,
            leadId
          }, '*');

          iframeRef.current.contentWindow.postMessage({
            type: 'SELECT_CONTACT',
            phone: normalizedPhone,
            rawPhone: rawPhoneDigits,
            cnpj: cleanCnpj,
            name: leadName,
            company: effectiveCompanyName,
            leadId
          }, '*');

          iframeRef.current.contentWindow.postMessage({
            type: 'VEC_OPEN_CHAT',
            phone: normalizedPhone,
            rawPhone: rawPhoneDigits,
            cnpj: cleanCnpj,
            name: leadName,
            company: effectiveCompanyName,
            leadId
          }, '*');
        }
      }
    } catch (e) {
      console.warn('[WhatsApp CRM] Falha ao enviar postMessage para iframe:', e);
    }
  }, [user, normalizedPhone, rawPhoneDigits, cleanCnpj, leadName, effectiveCompanyName, leadId]);

  // Listen for messages from WhatsApp CRM iframe (e.g. auth handshake requests or navigation)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (
        typeof event.origin === 'string' &&
        (
          event.origin.includes('whatsapp.vecgroup.com.br') || 
          event.origin.includes('vecgroup.com.br') || 
          event.origin.includes('localhost') ||
          event.origin.includes('run.app')
        )
      ) {
        const data = event.data;
        if (!data) return;

        // Iframe is requesting authentication or signaling readiness
        if (
          data.type === 'REQUEST_VEC_AUTH' || 
          data.type === 'REQUEST_AUTH' || 
          data.type === 'WHATSAPP_READY' ||
          data.type === 'IFRAME_MOUNTED' ||
          data.type === 'SSO_REQUEST' ||
          data.type === 'GET_SESSION'
        ) {
          setIsReady(true);
          setIsLoading(false);
          sendSessionToIframe();
        }

        // Iframe requests to navigate back to CRM
        if (
          data.type === 'NAVIGATE_BACK' ||
          data.type === 'CLOSE_WHATSAPP' ||
          data.type === 'VEC_GO_BACK' ||
          data.type === 'EXIT_WHATSAPP'
        ) {
          if (handleBack) {
            handleBack();
          }
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [sendSessionToIframe, handleBack]);

  const handleIframeLoad = () => {
    setIsLoading(false);
    // Trigger successive sync bursts to handle any timing variations
    sendSessionToIframe();
    if (handshakeTimerRef.current) clearTimeout(handshakeTimerRef.current);
    
    setTimeout(() => sendSessionToIframe(), 300);
    setTimeout(() => sendSessionToIframe(), 1000);
    setTimeout(() => sendSessionToIframe(), 2500);
  };

  const handleRefresh = () => {
    setIsLoading(true);
    setIframeKey(prev => prev + 1);
  };

  const handleOpenExternal = async () => {
    try {
      const res = await supabase.auth.getSession();
      const session = res.data?.session;
      const urlObj = new URL(WHATSAPP_BASE_URL);

      if (cleanCnpj) urlObj.searchParams.set('cnpj', cleanCnpj);
      if (normalizedPhone) urlObj.searchParams.set('phone', normalizedPhone);
      if (rawPhoneDigits) urlObj.searchParams.set('rawPhone', rawPhoneDigits);
      if (leadName) urlObj.searchParams.set('name', leadName);
      if (effectiveCompanyName) urlObj.searchParams.set('company', effectiveCompanyName);
      if (leadId) urlObj.searchParams.set('leadId', leadId);
      if (user?.email) urlObj.searchParams.set('email', user.email);
      urlObj.searchParams.set('sso', '1');

      if (session?.user?.email) {
        urlObj.searchParams.set('user_email', session.user.email);
      }
      if (session?.user?.id) {
        urlObj.searchParams.set('user_id', session.user.id);
      }

      window.open(urlObj.toString(), '_blank', 'noopener,noreferrer');
    } catch (err) {
      window.open(WHATSAPP_BASE_URL, '_blank', 'noopener,noreferrer');
    }
  };

  const hasTargetConversation = Boolean(phone || leadName || effectiveCompanyName || cnpj);
  const displayTargetLabel = effectiveCompanyName || leadName || phone || 'Atendimento';

  return (
    <div className={`w-full h-full relative bg-[#000d26] overflow-hidden flex flex-col ${isFullScreen ? 'fixed inset-0 z-[9999] w-screen h-screen' : ''}`}>
      {/* Top Floating Control Bar - Centered, Compact Pill style */}
      {showExternalButton && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[10000] flex items-center space-x-1 bg-[#000d26]/80 hover:bg-[#000d26]/95 backdrop-blur-md border border-white/15 px-2.5 py-1 rounded-full shadow-2xl transition-all duration-200 pointer-events-auto">
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

          {hasTargetConversation && (
            <>
              <div className="flex items-center space-x-1 px-2 py-0.5 bg-emerald-500/15 border border-emerald-500/25 rounded-full max-w-[200px] text-[9.5px] font-bold text-emerald-300">
                <Building size={10} className="shrink-0 text-emerald-400" />
                <span className="truncate uppercase">{displayTargetLabel}</span>
                {phone && (
                  <span className="shrink-0 text-[8.5px] text-emerald-400/80 font-mono hidden sm:inline">
                    • {phone}
                  </span>
                )}
              </div>
              <div className="w-[1px] h-3 bg-white/15" />
            </>
          )}

          <button
            type="button"
            onClick={handleOpenExternal}
            title="Abrir WhatsApp CRM em nova aba externa"
            className="flex items-center space-x-1 text-white/85 hover:text-white hover:bg-white/10 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase transition-all"
          >
            <ExternalLink size={11} className="text-emerald-400" />
            <span className="hidden sm:inline">Externo</span>
          </button>

          <div className="w-[1px] h-3 bg-white/15" />

          <button
            type="button"
            onClick={handleRefresh}
            title="Recarregar e sincronizar WhatsApp CRM"
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
        </div>
      )}

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-20 bg-[#000d26]/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300">
          <div className="relative mb-5">
            <div className="w-20 h-20 rounded-3xl bg-[#25D366]/15 border border-[#25D366]/40 flex items-center justify-center shadow-2xl shadow-[#25D366]/20 animate-pulse">
              <img 
                src={WHATSAPP_AVATAR_URL} 
                alt="WhatsApp" 
                className="w-12 h-12 object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="absolute -bottom-2 -right-2 bg-emerald-500 p-2 rounded-2xl border-2 border-[#000d26] shadow-lg">
              <Loader2 size={16} className="text-white animate-spin" />
            </div>
          </div>
          
          <h3 className="text-white font-black text-base uppercase tracking-wider mb-2">
            Carregando WhatsApp CRM
          </h3>
          <p className="text-white/60 text-xs max-w-md leading-relaxed">
            {hasTargetConversation ? (
              <>
                Abrindo conversa com <span className="text-emerald-400 font-black uppercase">{displayTargetLabel}</span>
                {phone && <span className="text-emerald-300 font-mono ml-1">({phone})</span>}...
              </>
            ) : (
              <>
                Sincronizando autenticação de <span className="text-emerald-400 font-black">{user.name || user.email}</span>...
              </>
            )}
          </p>
        </div>
      )}

      {/* Error Notification banner if any */}
      {authError && (
        <div className="absolute top-4 left-4 right-32 z-30 bg-amber-500/20 border border-amber-500/40 backdrop-blur-md rounded-2xl p-3.5 flex items-center justify-between text-amber-200 text-xs shadow-2xl animate-in slide-in-from-top-2">
          <div className="flex items-center space-x-2.5">
            <AlertCircle size={18} className="text-amber-400 shrink-0" />
            <span className="font-bold">{authError}</span>
          </div>
          <div className="flex items-center space-x-2 ml-3">
            <button
              type="button"
              onClick={handleRefresh}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-xl text-[10px] uppercase transition-all shrink-0 shadow-md"
            >
              Tentar Novamente
            </button>
            <button
              type="button"
              onClick={handleOpenExternal}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white font-black rounded-xl text-[10px] uppercase transition-all shrink-0"
            >
              Abrir Externo
            </button>
          </div>
        </div>
      )}

      {/* The Live WhatsApp CRM Iframe (NO SANDBOX: Allows normal execution) */}
      {iframeSrc && (
        <iframe
          key={iframeKey}
          ref={iframeRef}
          src={iframeSrc}
          title="WhatsApp VEC GROUP CRM"
          onLoad={handleIframeLoad}
          allow="camera; microphone; clipboard-read; clipboard-write; notifications; display-capture; autoplay; encrypted-media; geolocation"
          className="w-full h-full flex-1 border-0 bg-[#000d26]"
          loading="eager"
        />
      )}
    </div>
  );
};

export default WhatsAppCRM;

