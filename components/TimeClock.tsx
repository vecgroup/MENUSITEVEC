import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  ArrowLeft, 
  Clock, 
  Calendar, 
  Download, 
  RefreshCw, 
  LogIn, 
  LogOut, 
  Coffee, 
  CheckCircle2,
  Users,
  ChevronRight,
  ChevronLeft,
  Loader2,
  AlertTriangle,
  X,
  Check,
  Star,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Award,
  Activity,
  Sparkles,
  BarChart3,
  CalendarDays,
  Flame,
  ShieldCheck,
  CheckCircle,
  HelpCircle,
  Info,
  Filter,
  Eye,
  Sliders,
  FileSpreadsheet,
  Plus,
  Trash2,
  FileText,
  Upload,
  Paperclip,
  FileCheck,
  PartyPopper,
  Sun,
  Sunset,
  Timer,
  Bell
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  AreaChart, 
  Area, 
  Cell 
} from 'recharts';
import { User, UserStatus, PunchRecord, Attachment } from '../types';
import { supabase } from '../lib/supabase';
import { getUserStartDate, isDateBeforeUserAdmission, isNewUserWithoutStartDate, saveUserAdmissionDate } from '../lib/userDateUtils';
import { ExecutiveTimeClockDashboard } from './ExecutiveTimeClockDashboard';
import { MonthlyReportDpModal } from './MonthlyReportDpModal';

interface TimeClockProps {
  user: User;
  allUsers: User[];
  onBack: () => void;
}

interface DayDetailModalData {
  dateStr: string;
  formattedDate: string;
  entry: string;
  lunchStart: string;
  lunchReturn: string;
  exit: string;
  morningBreak?: string;
  afternoonBreak?: string;
  workedHours: string;
  balance: string;
  status: string;
  statusType: 'normal' | 'delay' | 'overtime' | 'absence' | 'off' | 'incomplete' | 'upcoming';
  isHoliday?: boolean;
  holidayName?: string | null;
  isCustomHoliday?: boolean;
  justificationReason?: string;
  hasMedicalCertificate?: boolean;
  medicalCertificateAttachment?: Attachment;
}

const TimeClock: React.FC<TimeClockProps> = ({ user, allUsers, onBack }) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  
  const getLocalDateString = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [selectedDate, setSelectedDate] = useState(getLocalDateString(new Date()));
  const [reportMonth, setReportMonth] = useState(
    new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0')
  ); // YYYY-MM
  const [historyMonth, setHistoryMonth] = useState(() => {
    const now = new Date();
    return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  });
  const [records, setRecords] = useState<PunchRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPunching, setIsPunching] = useState(false);
  const [punchSuccess, setPunchSuccess] = useState(false);
  const [confirmPunch, setConfirmPunch] = useState<'entry' | 'lunchStart' | 'lunchReturn' | 'exit' | null>(null);

  // Pausas de 5 Minutos (Manhã e Tarde - Horário Flexível)
  const [breakSecondsLeft, setBreakSecondsLeft] = useState<number>(300);
  const [breakFeedbackMsg, setBreakFeedbackMsg] = useState<string | null>(null);
  const [confirmBreakModal, setConfirmBreakModal] = useState<'morning' | 'afternoon' | null>(null);
  const [isProcessingBreak, setIsProcessingBreak] = useState<boolean>(false);

  // Selected day detail modal state for smart calendar
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<DayDetailModalData | null>(null);
  const [customHolidayInput, setCustomHolidayInput] = useState<string>('');
  const [showAddHolidayForm, setShowAddHolidayForm] = useState<boolean>(false);
  const [isDpReportModalOpen, setIsDpReportModalOpen] = useState<boolean>(false);
  const [activeMetricModal, setActiveMetricModal] = useState<'banco' | 'overtime' | 'atrasos' | 'faltas' | 'dias' | 'presenca' | null>(null);
  
  // Custom holidays stored in localStorage (YYYY-MM-DD -> Description)
  const [customHolidays, setCustomHolidays] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('vecgroup_custom_holidays');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  // Justification State for missing punches / absences
  const [justificationReasonInput, setJustificationReasonInput] = useState<string>('');
  const [hasAtestadoInput, setHasAtestadoInput] = useState<boolean>(false);
  const [atestadoAttachmentInput, setAtestadoAttachmentInput] = useState<Attachment | null>(null);
  const [isUploadingAtestado, setIsUploadingAtestado] = useState<boolean>(false);
  const [isSubmittingJustification, setIsSubmittingJustification] = useState<boolean>(false);
  const [justificationSuccess, setJustificationSuccess] = useState<string | null>(null);
  const [dismissedJustificationDates, setDismissedJustificationDates] = useState<string[]>([]);
  const [selectedRecordJustification, setSelectedRecordJustification] = useState<PunchRecord | null>(null);

  // Smart Onboarding for First-time New Users
  const [showFirstTimeWelcomeModal, setShowFirstTimeWelcomeModal] = useState<boolean>(false);
  const [firstTimeStartDate, setFirstTimeStartDate] = useState<string>(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  });
  const [isSavingFirstTimeStartDate, setIsSavingFirstTimeStartDate] = useState<boolean>(false);
  const [welcomeFeedbackMessage, setWelcomeFeedbackMessage] = useState<string | null>(null);

  const handleConfirmFirstTimeStartDate = async () => {
    if (!firstTimeStartDate) {
      alert("Por favor, informe a data em que você começou na empresa.");
      return;
    }
    setIsSavingFirstTimeStartDate(true);
    await saveUserAdmissionDate(user, firstTimeStartDate);
    user.admissionDate = firstTimeStartDate;
    user.admission_date = firstTimeStartDate;
    setIsSavingFirstTimeStartDate(false);
    setShowFirstTimeWelcomeModal(false);

    const formattedDate = new Date(firstTimeStartDate + 'T00:00:00').toLocaleDateString('pt-BR');
    setWelcomeFeedbackMessage(`Boas-vindas à VEC! Sua data de início foi definida para ${formattedDate}. Seu ponto passará a ser contabilizado a partir deste dia.`);
    setTimeout(() => {
      setWelcomeFeedbackMessage(null);
    }, 6000);
  };

  // Calculate Easter Sunday for a given year
  const getEasterSunday = (year: number) => {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month - 1, day);
  };

  // Check Brazilian National & Variable Holidays
  const getBrazilianHoliday = useCallback((dateStr: string): string | null => {
    if (!dateStr) return null;
    const [y, m, d] = dateStr.split('-').map(Number);
    const year = y;
    
    // Fixed Brazilian National Holidays
    const fixedHolidays: Record<string, string> = {
      '01-01': 'Ano Novo / Confraternização Universal',
      '04-21': 'Tiradentes',
      '05-01': 'Dia do Trabalhador',
      '09-07': 'Independência do Brasil',
      '10-12': 'Nossa Senhora Aparecida',
      '11-02': 'Finados',
      '11-15': 'Proclamação da República',
      '11-20': 'Dia da Consciência Negra',
      '12-25': 'Natal',
    };

    const monthDay = `${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    if (fixedHolidays[monthDay]) {
      return fixedHolidays[monthDay];
    }

    // Variable Holidays derived from Easter
    const easter = getEasterSunday(year);
    
    const addDays = (baseDate: Date, days: number) => {
      const res = new Date(baseDate);
      res.setDate(res.getDate() + days);
      return res;
    };

    const formatDateKey = (dateObj: Date) => {
      const yr = dateObj.getFullYear();
      const mo = String(dateObj.getMonth() + 1).padStart(2, '0');
      const da = String(dateObj.getDate()).padStart(2, '0');
      return `${yr}-${mo}-${da}`;
    };

    const variableHolidays: Record<string, string> = {
      [formatDateKey(addDays(easter, -48))]: 'Carnaval (Segunda-feira)',
      [formatDateKey(addDays(easter, -47))]: 'Carnaval (Terça-feira)',
      [formatDateKey(addDays(easter, -2))]: 'Sexta-feira Santa',
      [formatDateKey(easter)]: 'Páscoa',
      [formatDateKey(addDays(easter, 60))]: 'Corpus Christi',
    };

    if (variableHolidays[dateStr]) {
      return variableHolidays[dateStr];
    }

    return null;
  }, []);

  // Combined holiday check (Custom or National)
  const getHolidayInfo = useCallback((dateStr: string): string | null => {
    if (customHolidays[dateStr]) {
      return customHolidays[dateStr];
    }
    return getBrazilianHoliday(dateStr);
  }, [customHolidays, getBrazilianHoliday]);

  const handleSaveCustomHoliday = (dateStr: string, description: string) => {
    const desc = description.trim() || 'Feriado Municipal / Folga Especial';
    const updated = { ...customHolidays, [dateStr]: desc };
    setCustomHolidays(updated);
    localStorage.setItem('vecgroup_custom_holidays', JSON.stringify(updated));
    setShowAddHolidayForm(false);
    setCustomHolidayInput('');
  };

  const handleRemoveCustomHoliday = (dateStr: string) => {
    const updated = { ...customHolidays };
    delete updated[dateStr];
    setCustomHolidays(updated);
    localStorage.setItem('vecgroup_custom_holidays', JSON.stringify(updated));
  };

  // Helper para verificar se a data pertence ao mês atual ou ao mês anterior
  const isCurrentOrPreviousMonth = useCallback((dateStr: string): boolean => {
    if (!dateStr) return false;
    const parts = dateStr.split('-');
    if (parts.length < 3) return false;
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;

    const now = new Date();
    const curY = now.getFullYear();
    const curM = now.getMonth();

    const prevM = curM === 0 ? 11 : curM - 1;
    const prevY = curM === 0 ? curY - 1 : curY;

    return (y === curY && m === curM) || (y === prevY && m === prevM);
  }, []);

  // Detect past work days (up to 30 days back) with missing punch / absence that require mandatory justification
  const pendingJustificationDays = useMemo(() => {
    // OWNER e SUPERVISOR não registram ponto de presença, portanto não recebem alerta de justificativa pendente
    const userRoleStr = (user.role || '').toUpperCase();
    if (userRoleStr === 'OWNER' || userRoleStr === 'SUPERVISOR') {
      return [];
    }

    // Se o usuário for novo e estiver configurando seu primeiro acesso, não exibe alertas retroativos
    if (showFirstTimeWelcomeModal || isNewUserWithoutStartDate(user, records)) {
      return [];
    }

    const today = new Date();
    const result: Array<{ dateStr: string; formattedDate: string; isAbsence: boolean }> = [];

    for (let i = 1; i <= 30; i++) {
      const pastDate = new Date(today);
      pastDate.setDate(pastDate.getDate() - i);
      const dateStr = getLocalDateString(pastDate);

      // Apenas exibe alertas do mês atual ou mês anterior
      if (!isCurrentOrPreviousMonth(dateStr)) continue;

      // Não cobra justificativas de datas anteriores à admissão/cadastro do funcionário
      if (isDateBeforeUserAdmission(dateStr, user, records)) continue;

      // Skip weekends & holidays
      const isWeekend = pastDate.getDay() === 0 || pastDate.getDay() === 6;
      const isHoliday = !!getHolidayInfo(dateStr);
      if (isWeekend || isHoliday) continue;

      // Skip if user dismissed this date in current session
      if (dismissedJustificationDates.includes(dateStr)) continue;

      const rec = records.find(r => r.userId === user.id && r.date === dateStr);
      // Skip if justification is already provided
      if (rec?.justificationReason) continue;

      // Unjustified if no record, or marked Ausente, or missing entry punch
      if (!rec || rec.status === 'Ausente' || !rec.entry) {
        const formattedDate = pastDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        result.push({
          dateStr,
          formattedDate,
          isAbsence: !rec || rec.status === 'Ausente'
        });
      }
    }

    return result;
  }, [records, user.id, user.role, getHolidayInfo, dismissedJustificationDates, isCurrentOrPreviousMonth]);

  const currentPendingDay = pendingJustificationDays.length > 0 ? pendingJustificationDays[0] : null;

  const handleAtestadoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert("O arquivo do atestado é muito grande. Tamanho máximo permitido é 10MB.");
      return;
    }

    setIsUploadingAtestado(true);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setAtestadoAttachmentInput({
        id: `att-atestado-${Date.now()}`,
        name: file.name,
        url: dataUrl,
        type: file.type.includes('image') ? 'image' : file.type.includes('pdf') ? 'pdf' : 'document',
        size: `${(file.size / 1024).toFixed(0)} KB`,
        createdAt: new Date().toISOString()
      });
      setIsUploadingAtestado(false);
    };
    reader.onerror = () => {
      alert("Erro ao ler o arquivo do atestado.");
      setIsUploadingAtestado(false);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveJustification = async () => {
    if (!currentPendingDay) return;
    if (!justificationReasonInput.trim()) {
      alert("Por favor, preencha o motivo do atraso ou falta.");
      return;
    }
    if (hasAtestadoInput && !atestadoAttachmentInput) {
      alert("Você marcou que possui atestado. Por favor, anexe a foto ou arquivo do atestado antes de salvar.");
      return;
    }

    setIsSubmittingJustification(true);

    const dateStr = currentPendingDay.dateStr;
    const existing = records.find(r => r.userId === user.id && r.date === dateStr);

    const updatedPunch: PunchRecord = {
      id: existing?.id || `punch-${user.id}-${dateStr}`,
      userId: user.id,
      userName: user.name,
      userAvatar: user.avatar,
      date: dateStr,
      entry: existing?.entry || undefined,
      lunchStart: existing?.lunchStart || undefined,
      lunchReturn: existing?.lunchReturn || undefined,
      exit: existing?.exit || undefined,
      status: existing?.status || 'Ausente',
      justificationReason: justificationReasonInput.trim(),
      hasMedicalCertificate: hasAtestadoInput,
      medicalCertificateAttachment: atestadoAttachmentInput || existing?.medicalCertificateAttachment || undefined
    };

    // 1. Salvar no backup local (localStorage) imediatamente para garantir persistência
    try {
      const stored = localStorage.getItem('vecgroup_punches_backup');
      const localList: PunchRecord[] = stored ? JSON.parse(stored) : [];
      const updatedLocal = [updatedPunch, ...localList.filter(r => !(r.userId === user.id && r.date === dateStr))];
      localStorage.setItem('vecgroup_punches_backup', JSON.stringify(updatedLocal));
    } catch (e) {
      console.warn("Erro ao salvar no localStorage local:", e);
    }

    // 2. Tentar salvar no Supabase
    const { error } = await supabase.punches.upsert(updatedPunch);
    if (error) {
      console.error("Erro ao salvar justificativa no Supabase:", error);
    }

    setRecords(prev => {
      const filtered = prev.filter(r => !(r.userId === user.id && r.date === dateStr));
      return [updatedPunch, ...filtered];
    });

    setJustificationReasonInput('');
    setHasAtestadoInput(false);
    setAtestadoAttachmentInput(null);
    setIsSubmittingJustification(false);
    setJustificationSuccess(`Justificativa do dia ${currentPendingDay.formattedDate} salva com sucesso!`);

    setTimeout(() => {
      setJustificationSuccess(null);
    }, 3500);
  };
  
  // Tab for charts view (Bar vs Area vs Comparison)
  const [activeChartTab, setActiveChartTab] = useState<'daily' | 'bank' | 'compare'>('daily');

  const isPrivileged = useMemo(() => {
    const role = (user.role || '').toUpperCase();
    return role === 'OWNER' || role === 'SUPERVISOR';
  }, [user.role]);

  const canManageHolidays = useMemo(() => {
    const role = (user.role || '').toUpperCase();
    return role === 'OWNER' || role === 'SUPERVISOR';
  }, [user.role]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    loadPunches();
    return () => clearInterval(timer);
  }, []);

  const loadPunches = async () => {
    setIsLoading(true);
    const { data, error } = await supabase.punches.getAll();
    
    if (error) {
      console.warn("Aviso ao carregar pontos do Supabase (utilizando backup local):", error);
    }

    // Carregar backup local para não perder justificativas caso o Supabase não possua as colunas ainda
    let localBackupRecords: PunchRecord[] = [];
    try {
      const stored = localStorage.getItem('vecgroup_punches_backup');
      if (stored) {
        localBackupRecords = JSON.parse(stored);
      }
    } catch (e) {
      console.warn("Erro ao ler backup do localStorage:", e);
    }

    const mergedRecordsMap = new Map<string, PunchRecord>();

    // Insere dados do Supabase primeiro
    if (data && Array.isArray(data)) {
      data.forEach(r => {
        const key = `${r.userId}_${r.date}`;
        mergedRecordsMap.set(key, r);
      });
    }

    // Mescla/Sobrescreve com registros locais se tiverem justificativa/atestado/marcações corrigidas localmente
    localBackupRecords.forEach(localRec => {
      const key = `${localRec.userId}_${localRec.date}`;
      const existing = mergedRecordsMap.get(key);
      if (!existing) {
        mergedRecordsMap.set(key, localRec);
      } else {
        mergedRecordsMap.set(key, {
          ...existing,
          entry: localRec.entry || existing.entry,
          lunchStart: localRec.lunchStart || existing.lunchStart,
          lunchReturn: localRec.lunchReturn || existing.lunchReturn,
          exit: localRec.exit || existing.exit,
          morningBreakStart: localRec.morningBreakStart || existing.morningBreakStart,
          morningBreakEnd: localRec.morningBreakEnd || existing.morningBreakEnd,
          afternoonBreakStart: localRec.afternoonBreakStart || existing.afternoonBreakStart,
          afternoonBreakEnd: localRec.afternoonBreakEnd || existing.afternoonBreakEnd,
          status: localRec.status || existing.status,
          justificationReason: localRec.justificationReason || existing.justificationReason,
          hasMedicalCertificate: localRec.hasMedicalCertificate ?? existing.hasMedicalCertificate,
          medicalCertificateAttachment: localRec.medicalCertificateAttachment || existing.medicalCertificateAttachment
        });
      }
    });

    // Sanitize any impossible future punch times for today's date
    const now = new Date();
    const curTodayStr = getLocalDateString(now);
    const nowMins = now.getHours() * 60 + now.getMinutes();

    const sanitizedRecords = Array.from(mergedRecordsMap.values()).map(r => {
      if (r.date === curTodayStr) {
        const copy = { ...r };
        let modified = false;

        const parseM = (t?: string) => {
          if (!t || !t.includes(':')) return null;
          const [h, m] = t.split(':').map(Number);
          return isNaN(h) || isNaN(m) ? null : h * 60 + m;
        };

        if (copy.exit && (parseM(copy.exit) ?? 0) > nowMins) {
          copy.exit = undefined;
          modified = true;
        }
        if (copy.lunchReturn && (parseM(copy.lunchReturn) ?? 0) > nowMins) {
          copy.lunchReturn = undefined;
          modified = true;
        }
        if (copy.lunchStart && (parseM(copy.lunchStart) ?? 0) > nowMins) {
          copy.lunchStart = undefined;
          modified = true;
        }
        if (copy.entry && (parseM(copy.entry) ?? 0) > nowMins) {
          copy.entry = undefined;
          modified = true;
        }

        if (modified) {
          if (copy.exit) copy.status = 'Finalizado';
          else if (copy.lunchStart && !copy.lunchReturn) copy.status = 'Almoço';
          else if (copy.entry) copy.status = 'Presente';
          else copy.status = 'Ausente';
        }
        return copy;
      }
      return r;
    });

    // Também atualiza localStorage caso o backup local contenha marcas no futuro
    try {
      localStorage.setItem('vecgroup_punches_backup', JSON.stringify(sanitizedRecords));
    } catch (e) {
      console.warn("Erro ao atualizar backup no localStorage:", e);
    }

    setRecords(sanitizedRecords);
    setIsLoading(false);

    // Detecção inteligente de novo usuário: primeiro acesso ao ponto
    if (isNewUserWithoutStartDate(user, sanitizedRecords)) {
      setShowFirstTimeWelcomeModal(true);
    }
  };

  const handlePrevMonth = () => {
    const [y, m] = reportMonth.split('-').map(Number);
    const prevDate = new Date(y, m - 2, 1);
    const newMonthStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
    setReportMonth(newMonthStr);
  };

  const handleNextMonth = () => {
    const [y, m] = reportMonth.split('-').map(Number);
    const nextDate = new Date(y, m, 1);
    const newMonthStr = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`;
    setReportMonth(newMonthStr);
  };

  const formatClockTime = (date: Date) => {
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const formatClockSeconds = (date: Date) => {
    return date.toLocaleTimeString('pt-BR', { second: '2-digit' });
  };

  const formatClockDate = (date: Date) => {
    const weekday = date.toLocaleDateString('pt-BR', { weekday: 'long' }).toUpperCase();
    const dayMonth = date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' }).toUpperCase();
    return `${weekday}, ${dayMonth}`;
  };

  const myTodayRecord = useMemo(() => 
    records.find(r => r.userId === user.id && r.date === getLocalDateString(new Date())),
    [records, user.id]
  );

  const nextPunchType = useMemo(() => {
    if (!myTodayRecord) return 'entry';
    if (!myTodayRecord.entry) return 'entry';
    if (!myTodayRecord.lunchStart) return 'lunchStart';
    if (!myTodayRecord.lunchReturn) return 'lunchReturn';
    if (!myTodayRecord.exit) return 'exit';
    return null;
  }, [myTodayRecord]);

  const handlePunch = async (type: 'entry' | 'lunchStart' | 'lunchReturn' | 'exit') => {
    if (isPunching) return;
    
    // Se for um novo colaborador sem data de início definida, abre o modal de boas-vindas
    if (isNewUserWithoutStartDate(user, records)) {
      setShowFirstTimeWelcomeModal(true);
      return;
    }

    if (type !== nextPunchType) {
      alert("Ação inválida para a sequência atual do ponto.");
      return;
    }

    setIsPunching(true);

    const now = new Date();
    const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const today = getLocalDateString(now);

    const existing = records.find(r => r.userId === user.id && r.date === today);
    
    let updatedStatus: PunchRecord['status'] = 'Presente';
    if (type === 'lunchStart') updatedStatus = 'Almoço';
    if (type === 'lunchReturn') updatedStatus = 'Presente';
    if (type === 'exit') updatedStatus = 'Finalizado';

    const newRecord: PunchRecord = existing 
      ? { ...existing, [type]: timeStr, status: updatedStatus }
      : {
          id: `p-${user.id}-${today}`,
          userId: user.id,
          userName: user.name,
          userAvatar: user.avatar,
          date: today,
          [type]: timeStr,
          status: updatedStatus
        };

    const { error } = await supabase.punches.upsert(newRecord);

    if (!error) {
      setRecords(prev => {
        const filtered = prev.filter(r => r.id !== newRecord.id);
        return [newRecord, ...filtered];
      });
      setPunchSuccess(true);
      setTimeout(() => {
        setConfirmPunch(null);
        setPunchSuccess(false);
      }, 2000);
    } else {
      console.error("Erro Supabase (Ponto):", error);
      alert(`Erro ao registrar ponto: ${error.message || 'Erro desconhecido'}`);
    }

    setIsPunching(false);
  };

  const exportReport = () => {
    setIsDpReportModalOpen(true);
  };

  // Helper to play synthesized gentle notification chime
  const playBreakAlarmSound = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;
      [
        { freq: 659.25, time: now },
        { freq: 830.61, time: now + 0.15 },
        { freq: 987.77, time: now + 0.3 }
      ].forEach(({ freq, time }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, time);
        gain.gain.setValueAtTime(0.25, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.6);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(time);
        osc.stop(time + 0.6);
      });
    } catch (e) {
      // AudioContext unavailable or blocked by browser policy
    }
  }, []);

  const formatSeconds = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const isMorningBreakActive = !!(myTodayRecord?.morningBreakStart && !myTodayRecord?.morningBreakEnd);
  const isAfternoonBreakActive = !!(myTodayRecord?.afternoonBreakStart && !myTodayRecord?.afternoonBreakEnd);
  const activeBreakType: 'morning' | 'afternoon' | null = isMorningBreakActive ? 'morning' : isAfternoonBreakActive ? 'afternoon' : null;

  const handleFinishBreak = useCallback(async (type: 'morning' | 'afternoon') => {
    if (isProcessingBreak) return;
    setIsProcessingBreak(true);

    const now = new Date();
    const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const today = getLocalDateString(now);

    const existing = records.find(r => r.userId === user.id && r.date === today);
    const endField = type === 'morning' ? 'morningBreakEnd' : 'afternoonBreakEnd';

    const timerStorageKey = `vec_break_timer_${user.id}_${today}_${type}`;
    localStorage.removeItem(timerStorageKey);

    playBreakAlarmSound();

    const restoredStatus: PunchRecord['status'] = existing?.exit 
      ? 'Finalizado' 
      : (existing?.lunchStart && !existing?.lunchReturn) 
        ? 'Almoço' 
        : existing?.entry 
          ? 'Presente' 
          : 'Presente';

    const updatedRecord: PunchRecord = existing
      ? { ...existing, [endField]: timeStr, status: restoredStatus }
      : {
          id: `p-${user.id}-${today}`,
          userId: user.id,
          userName: user.name,
          userAvatar: user.avatar,
          date: today,
          [endField]: timeStr,
          status: 'Presente'
        };

    try {
      const stored = localStorage.getItem('vecgroup_punches_backup');
      const localList: PunchRecord[] = stored ? JSON.parse(stored) : [];
      const updatedLocal = [updatedRecord, ...localList.filter(r => !(r.userId === user.id && r.date === today))];
      localStorage.setItem('vecgroup_punches_backup', JSON.stringify(updatedLocal));
    } catch (e) {
      console.warn("Erro ao salvar backup local:", e);
    }

    setRecords(prev => {
      const filtered = prev.filter(r => !(r.userId === user.id && r.date === today));
      return [updatedRecord, ...filtered];
    });

    setIsProcessingBreak(false);

    setBreakFeedbackMsg(`Pausa da ${type === 'morning' ? 'Manhã' : 'Tarde'} de 5 minutos concluída! Bom retorno ao trabalho.`);
    setTimeout(() => setBreakFeedbackMsg(null), 5000);

    await supabase.punches.upsert(updatedRecord);
  }, [isProcessingBreak, records, user.id, user.name, user.avatar, playBreakAlarmSound]);

  // Monitor e Countdown de 5 Minutos (300 segundos) para pausa ativa
  useEffect(() => {
    if (!activeBreakType) return;

    const today = getLocalDateString(new Date());
    const timerStorageKey = `vec_break_timer_${user.id}_${today}_${activeBreakType}`;
    
    let startTimestamp = Date.now();
    try {
      const saved = localStorage.getItem(timerStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.startTimestamp) startTimestamp = parsed.startTimestamp;
      } else {
        localStorage.setItem(timerStorageKey, JSON.stringify({ startTimestamp }));
      }
    } catch (e) {}

    const updateTimer = () => {
      const elapsedSecs = Math.floor((Date.now() - startTimestamp) / 1000);
      const remaining = Math.max(0, 300 - elapsedSecs);
      setBreakSecondsLeft(remaining);

      if (remaining === 0) {
        handleFinishBreak(activeBreakType);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [activeBreakType, myTodayRecord?.morningBreakStart, myTodayRecord?.afternoonBreakStart, user.id, handleFinishBreak]);

  const handleStartBreak = async (type: 'morning' | 'afternoon') => {
    if (isProcessingBreak) return;
    setIsProcessingBreak(true);

    const now = new Date();
    const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const today = getLocalDateString(now);

    const existing = records.find(r => r.userId === user.id && r.date === today);
    const startField = type === 'morning' ? 'morningBreakStart' : 'afternoonBreakStart';
    const endField = type === 'morning' ? 'morningBreakEnd' : 'afternoonBreakEnd';

    const timerStorageKey = `vec_break_timer_${user.id}_${today}_${type}`;
    localStorage.setItem(timerStorageKey, JSON.stringify({ startTimestamp: Date.now() }));

    const updatedRecord: PunchRecord = existing
      ? { ...existing, [startField]: timeStr, [endField]: undefined, status: 'Pausa' }
      : {
          id: `p-${user.id}-${today}`,
          userId: user.id,
          userName: user.name,
          userAvatar: user.avatar,
          date: today,
          [startField]: timeStr,
          status: 'Pausa'
        };

    try {
      const stored = localStorage.getItem('vecgroup_punches_backup');
      const localList: PunchRecord[] = stored ? JSON.parse(stored) : [];
      const updatedLocal = [updatedRecord, ...localList.filter(r => !(r.userId === user.id && r.date === today))];
      localStorage.setItem('vecgroup_punches_backup', JSON.stringify(updatedLocal));
    } catch (e) {
      console.warn("Erro ao salvar backup local:", e);
    }

    setRecords(prev => {
      const filtered = prev.filter(r => !(r.userId === user.id && r.date === today));
      return [updatedRecord, ...filtered];
    });

    setBreakSecondsLeft(300);
    setConfirmBreakModal(null);
    setIsProcessingBreak(false);

    setBreakFeedbackMsg(`Pausa da ${type === 'morning' ? 'Manhã' : 'Tarde'} iniciada! Você tem 5 minutos de descanso.`);
    setTimeout(() => setBreakFeedbackMsg(null), 4000);

    await supabase.punches.upsert(updatedRecord);
  };

  const handleResetBreak = async (type: 'morning' | 'afternoon') => {
    const confirm = window.confirm(`Deseja redefinir ou cancelar o registro da pausa da ${type === 'morning' ? 'manhã' : 'tarde'} de hoje?`);
    if (!confirm) return;

    const now = new Date();
    const today = getLocalDateString(now);
    const existing = records.find(r => r.userId === user.id && r.date === today);
    if (!existing) return;

    const startField = type === 'morning' ? 'morningBreakStart' : 'afternoonBreakStart';
    const endField = type === 'morning' ? 'morningBreakEnd' : 'afternoonBreakEnd';

    const timerStorageKey = `vec_break_timer_${user.id}_${today}_${type}`;
    localStorage.removeItem(timerStorageKey);

    const restoredStatus: PunchRecord['status'] = existing.exit 
      ? 'Finalizado' 
      : (existing.lunchStart && !existing.lunchReturn) 
        ? 'Almoço' 
        : existing.entry 
          ? 'Presente' 
          : 'Presente';

    const updatedRecord: PunchRecord = {
      ...existing,
      [startField]: undefined,
      [endField]: undefined,
      status: restoredStatus
    };

    try {
      const stored = localStorage.getItem('vecgroup_punches_backup');
      const localList: PunchRecord[] = stored ? JSON.parse(stored) : [];
      const updatedLocal = [updatedRecord, ...localList.filter(r => !(r.userId === user.id && r.date === today))];
      localStorage.setItem('vecgroup_punches_backup', JSON.stringify(updatedLocal));
    } catch (e) {
      console.warn("Erro ao salvar backup local:", e);
    }

    setRecords(prev => {
      const filtered = prev.filter(r => !(r.userId === user.id && r.date === today));
      return [updatedRecord, ...filtered];
    });

    await supabase.punches.upsert(updatedRecord);
  };

  // Helper to calculate minutes between HH:MM strings
  const parseToMinutes = (timeStr?: string) => {
    if (!timeStr || !timeStr.includes(':')) return null;
    const [h, m] = timeStr.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return null;
    return h * 60 + m;
  };

  const formatMinutesToHours = (mins: number, showSign = false) => {
    const sign = mins < 0 ? '-' : showSign && mins > 0 ? '+' : '';
    const absMins = Math.abs(mins);
    const h = Math.floor(absMins / 60);
    const m = absMins % 60;
    return `${sign}${String(h).padStart(2, '0')}h${String(m).padStart(2, '0')}`;
  };

  const formatBrazilianDateWithWeekday = useCallback((dateStr: string) => {
    if (!dateStr) return '';
    let year: number, month: number, day: number;

    if (dateStr.includes('-')) {
      const parts = dateStr.split('-');
      if (parts.length !== 3) return dateStr;
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10) - 1;
      day = parseInt(parts[2], 10);
    } else if (dateStr.includes('/')) {
      const parts = dateStr.split('/');
      if (parts.length !== 3) return dateStr;
      day = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10) - 1;
      year = parseInt(parts[2], 10);
    } else {
      return dateStr;
    }

    if (isNaN(year) || isNaN(month) || isNaN(day)) return dateStr;

    const d = new Date(year, month, day);
    const dayFormatted = String(day).padStart(2, '0');
    const monthFormatted = String(month + 1).padStart(2, '0');
    const weekdays = [
      'Domingo',
      'Segunda-feira',
      'Terça-feira',
      'Quarta-feira',
      'Quinta-feira',
      'Sexta-feira',
      'Sábado'
    ];
    const weekdayName = weekdays[d.getDay()] || '';
    return `${dayFormatted}/${monthFormatted}/${year} - ${weekdayName}`;
  }, []);

  // Helper for single record stats
  const calculateRecordStats = (rec?: PunchRecord) => {
    if (!rec) {
      return {
        workedMins: 0,
        balanceMins: 0,
        delayMins: 0,
        overtimeMins: 0,
        isAbsence: false,
        isIncomplete: false,
        formattedWorked: '00h00',
        formattedBalance: '00h00',
        statusBadge: 'Ausente',
        statusType: 'off' as const
      };
    }

    // Determine day of week for expected schedule
    const recDate = rec.date ? new Date(rec.date + 'T12:00:00') : new Date();
    const dayOfWeek = recDate.getDay(); // 0: Sun, 1: Mon, ..., 5: Fri, 6: Sat
    const isFriday = dayOfWeek === 5;
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isHoliday = rec.date ? !!getHolidayInfo(rec.date) : false;

    // Horários padrão VECGROUP:
    // Entrada esperada: 08:00 (480 min)
    // Almoço saída esperado: 12:00 (720 min)
    // Almoço retorno esperado: 13:00 (780 min)
    // Saída esperada: Seg-Qui 18:00 (1080 min) | Sex 17:00 (1020 min)
    // Tolerância padrão: 15 minutos para todos os horários (tanto para hora extra quanto para atraso/falta)
    const expectedEntryMins = 480; // 08:00
    const expectedLunchStartMins = 720; // 12:00
    const expectedLunchReturnMins = 780; // 13:00
    const expectedExitMins = isFriday ? 1020 : 1080; // 17:00 na sexta, 18:00 de seg a qui
    const expectedWorkMins = isWeekend ? 0 : isFriday ? 480 : 540; // 8h líquidas na sex, 9h líquidas seg-qui

    const entryMins = parseToMinutes(rec.entry);
    const lunchStartMins = parseToMinutes(rec.lunchStart);
    const lunchReturnMins = parseToMinutes(rec.lunchReturn);
    const exitMins = parseToMinutes(rec.exit);

    // Função para aplicar tolerância de 15 minutos em relação a um horário alvo
    const applyTolerance = (mins: number | null, targetMins: number, tolerance: number = 15): number | null => {
      if (mins === null) return null;
      if (Math.abs(mins - targetMins) <= tolerance) {
        return targetMins; // Dentro da tolerância de 15m -> considera o horário oficial
      }
      return mins;
    };

    const effectiveEntryMins = applyTolerance(entryMins, expectedEntryMins);
    const effectiveLunchStartMins = applyTolerance(lunchStartMins, expectedLunchStartMins);
    const effectiveLunchReturnMins = applyTolerance(lunchReturnMins, expectedLunchReturnMins);
    const effectiveExitMins = applyTolerance(exitMins, expectedExitMins);

    const hasJustification = !!(rec.justificationReason && rec.justificationReason.trim());
    const hasMedicalCert = !!rec.hasMedicalCertificate;
    const todayStr = getLocalDateString(new Date());
    const isPastDay = rec.date < todayStr;
    const isToday = rec.date === todayStr;

    let delayMins = 0;
    if (entryMins !== null && entryMins > expectedEntryMins + 15) {
      delayMins = entryMins - expectedEntryMins;
    }

    let workedMins = 0;
    let isIncomplete = false;

    // Check if punches are missing on past days
    const isPunchesIncomplete = isPastDay && (
      (effectiveEntryMins !== null && exitMins === null) ||
      (effectiveLunchStartMins !== null && effectiveLunchReturnMins === null)
    );

    // Marked as incomplete ONLY if missing punches AND no justification/medical certificate provided
    if (isPunchesIncomplete && !hasJustification && !hasMedicalCert) {
      isIncomplete = true;
    }

    // Calculate worked minutes:
    if (hasMedicalCert) {
      // Atestado Médico abona o dia integralmente
      workedMins = expectedWorkMins;
    } else {
      // Justificativa sem atestado NÃO abona: calcula apenas o tempo efetivamente trabalhado
      if (effectiveEntryMins !== null && effectiveExitMins !== null) {
        let lunchSpan = 60;
        if (effectiveLunchStartMins !== null && effectiveLunchReturnMins !== null) {
          lunchSpan = Math.max(30, effectiveLunchReturnMins - effectiveLunchStartMins);
        }
        workedMins = Math.max(0, (effectiveExitMins - effectiveEntryMins) - lunchSpan);
      } else if (effectiveEntryMins !== null && effectiveLunchStartMins !== null) {
        let morningSpan = Math.max(0, effectiveLunchStartMins - effectiveEntryMins);
        let afternoonSpan = 0;
        if (effectiveLunchReturnMins !== null && effectiveExitMins !== null) {
          afternoonSpan = Math.max(0, effectiveExitMins - effectiveLunchReturnMins);
        }
        workedMins = morningSpan + afternoonSpan;
      } else if (effectiveEntryMins !== null && isToday) {
        // Dia em andamento
        const nowMins = currentTime.getHours() * 60 + currentTime.getMinutes();
        let lunchSpan = 0;
        if (effectiveLunchStartMins !== null && effectiveLunchReturnMins !== null) {
          lunchSpan = effectiveLunchReturnMins - effectiveLunchStartMins;
        } else if (effectiveLunchStartMins !== null) {
          lunchSpan = Math.max(0, nowMins - effectiveLunchStartMins);
        }
        workedMins = Math.max(0, Math.min(expectedWorkMins, nowMins - effectiveEntryMins - lunchSpan));
      } else {
        workedMins = 0;
      }
    }

    // Balance calculation
    let rawBalanceMins = 0;
    if (hasMedicalCert) {
      rawBalanceMins = 0; // Abonado pelo atestado
    } else {
      // Sem atestado: saldo = trabalhado - esperado (saldo negativo = hora falta)
      rawBalanceMins = workedMins - expectedWorkMins;
      // Tolerância de 15 minutos para saldo
      if (Math.abs(rawBalanceMins) <= 15) {
        rawBalanceMins = 0;
      }
    }

    const balanceMins = rawBalanceMins;
    const overtimeMins = balanceMins > 0 ? balanceMins : 0;

    // Atestado abonado nunca é falta
    const isAbsence = !hasMedicalCert && (
      rec.status === 'Ausente' || 
      (isPastDay && workedMins === 0 && !rec.entry && !isWeekend && !isHoliday)
    );
    const isJustifiedAbsence = isAbsence && hasJustification;
    const isUnjustifiedAbsence = isAbsence && !hasJustification;

    let statusBadge = rec.status || 'OK';
    let statusType: DayDetailModalData['statusType'] = 'normal';

    if (hasMedicalCert) {
      statusBadge = 'Atestado';
      statusType = 'normal';
    } else if (isJustifiedAbsence) {
      statusBadge = 'Falta Justificada';
      statusType = 'absence';
    } else if (isUnjustifiedAbsence) {
      statusBadge = 'Falta Injustificada';
      statusType = 'absence';
    } else if (hasJustification) {
      statusBadge = 'Justificado';
      statusType = 'delay';
    } else if (isIncomplete) {
      statusBadge = 'Inconsistência';
      statusType = 'incomplete';
    } else if (delayMins > 0) {
      statusBadge = 'Atrasado';
      statusType = 'delay';
    } else if (overtimeMins > 0) {
      statusBadge = 'Hora Extra';
      statusType = 'overtime';
    } else if (workedMins >= (expectedWorkMins - 15) && workedMins > 0) {
      statusBadge = 'OK';
      statusType = 'normal';
    } else if (rec.entry) {
      statusBadge = 'Trabalhando';
      statusType = 'normal';
    }

    return {
      workedMins,
      balanceMins,
      delayMins,
      overtimeMins,
      isAbsence,
      isJustifiedAbsence,
      isUnjustifiedAbsence,
      hasMedicalCert,
      hasJustification,
      isIncomplete,
      formattedWorked: formatMinutesToHours(workedMins),
      formattedBalance: formatMinutesToHours(balanceMins, true),
      statusBadge,
      statusType
    };
  };

  // Compute User Monthly Statistics for "Resumo do Mês"
  const monthlyStats = useMemo(() => {
    const currentMonthStr = reportMonth; // e.g., '2026-08'
    const userMonthRecords = records.filter(r => r.userId === user.id && r.date.startsWith(currentMonthStr));

    let totalBankMins = 0;
    let totalOvertimeMins = 0;
    let totalDelayCount = 0;
    let totalDelayMins = 0;
    let totalAbsenceCount = 0;
    let totalUnjustifiedAbsenceCount = 0;
    let totalJustifiedAbsenceCount = 0;
    let totalDaysWorked = 0;
    let totalIncompleteCount = 0;
    const incompleteDays: { dateStr: string; formattedDate: string; rec?: PunchRecord }[] = [];

    userMonthRecords.forEach(rec => {
      const stats = calculateRecordStats(rec);
      totalBankMins += stats.balanceMins;
      totalOvertimeMins += stats.overtimeMins;
      if (stats.delayMins > 0) {
        totalDelayCount += 1;
        totalDelayMins += stats.delayMins;
      }
      if (stats.isAbsence) {
        totalAbsenceCount += 1;
        if (stats.isJustifiedAbsence) totalJustifiedAbsenceCount += 1;
        if (stats.isUnjustifiedAbsence) totalUnjustifiedAbsenceCount += 1;
      }
      if (stats.workedMins > 0 || stats.hasMedicalCert) totalDaysWorked += 1;
      if (stats.isIncomplete) {
        totalIncompleteCount += 1;
        incompleteDays.push({
          dateStr: rec.date,
          formattedDate: formatBrazilianDateWithWeekday(rec.date),
          rec
        });
      }
    });

    incompleteDays.sort((a, b) => a.dateStr.localeCompare(b.dateStr));

    // Presence percentage calculation
    const [y, m] = currentMonthStr.split('-').map(Number);
    const today = new Date();
    const isCurrentMonth = today.getFullYear() === y && (today.getMonth() + 1) === m;
    const maxDays = isCurrentMonth ? today.getDate() : new Date(y, m, 0).getDate();
    
    let expectedWorkDays = 0;
    for (let d = 1; d <= maxDays; d++) {
      const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayOfWeek = new Date(y, m - 1, d).getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const isHoliday = !!getHolidayInfo(dateStr);
      const isBeforeAdmission = isDateBeforeUserAdmission(dateStr, user, records);
      
      if (!isWeekend && !isHoliday && !isBeforeAdmission) {
        expectedWorkDays++;
      }
    }

    const presenceRate = expectedWorkDays > 0 
      ? Math.min(100, Math.round((totalDaysWorked / expectedWorkDays) * 100))
      : 100;

    // Performance Index Calculation (0 to 100)
    let score = 100;
    score -= (totalDelayCount * 2);
    score -= (totalUnjustifiedAbsenceCount * 10);
    score -= (totalJustifiedAbsenceCount * 3);
    score -= (totalIncompleteCount * 5);
    if (totalBankMins > 0) score += 2;
    if (totalBankMins < 0) score -= Math.min(20, Math.abs(Math.round(totalBankMins / 30)));
    score = Math.max(0, Math.min(100, score));

    return {
      bankMins: totalBankMins,
      formattedBank: formatMinutesToHours(totalBankMins, true),
      isBankPositive: totalBankMins >= 0,
      overtimeMins: totalOvertimeMins,
      formattedOvertime: formatMinutesToHours(totalOvertimeMins),
      delayCount: totalDelayCount,
      delayMins: totalDelayMins,
      absenceCount: totalAbsenceCount,
      unjustifiedAbsenceCount: totalUnjustifiedAbsenceCount,
      justifiedAbsenceCount: totalJustifiedAbsenceCount,
      daysWorked: totalDaysWorked,
      presenceRate: Math.max(0, presenceRate),
      score,
      incompleteCount: totalIncompleteCount,
      incompleteDays
    };
  }, [records, user.id, reportMonth, currentTime, getHolidayInfo, formatBrazilianDateWithWeekday]);

  // Calendar Days calculation for current month
  const calendarDays = useMemo(() => {
    const [y, m] = reportMonth.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const firstDayOfWeek = new Date(y, m - 1, 1).getDay(); // 0 = Dom, 1 = Seg, ..., 6 = Sáb
    const days = [];

    const today = new Date();
    const todayYear = today.getFullYear();
    const todayMonth = today.getMonth() + 1;
    const todayDay = today.getDate();

    const isCurrentMonth = (y === todayYear && m === todayMonth);
    const isPastMonth = (y < todayYear || (y === todayYear && m < todayMonth));

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayDate = new Date(y, m - 1, d);
      const isWeekend = dayDate.getDay() === 0 || dayDate.getDay() === 6;
      const holidayName = getHolidayInfo(dateStr);
      const isHoliday = !!holidayName;

      const rec = records.find(r => r.userId === user.id && r.date === dateStr);
      const stats = calculateRecordStats(rec);

      let statusType: DayDetailModalData['statusType'] = 'normal';
      let statusLabel = 'Dia Normal';
      let dotColor = 'bg-emerald-500';

      const isPastDay = isPastMonth || (isCurrentMonth && d < todayDay);
      const isToday = isCurrentMonth && d === todayDay;
      const isBeforeAdmission = isDateBeforeUserAdmission(dateStr, user, records);

      if (isBeforeAdmission) {
        statusType = 'off';
        statusLabel = 'Não cadastrado / Não admitido';
        dotColor = 'bg-slate-200';
      } else if (isHoliday) {
        statusType = 'off';
        statusLabel = `Feriado: ${holidayName}`;
        dotColor = 'bg-[#8B5CF6]'; // Purple for holidays
      } else if (isWeekend) {
        statusType = 'off';
        statusLabel = 'Folga';
        dotColor = 'bg-slate-300';
      } else if (!rec) {
        if (isPastDay) {
          statusType = 'absence';
          statusLabel = 'Falta / Sem Registro';
          dotColor = 'bg-red-500';
        } else if (isToday) {
          statusType = 'upcoming';
          statusLabel = 'Aguardando Ponto';
          dotColor = 'bg-amber-400';
        } else {
          statusType = 'upcoming';
          statusLabel = 'Aguardando';
          dotColor = 'bg-slate-200';
        }
      } else if (stats.isIncomplete) {
        statusType = 'incomplete';
        statusLabel = 'Inconsistência';
        dotColor = 'bg-purple-500';
      } else if (stats.delayMins > 0) {
        statusType = 'delay';
        statusLabel = 'Atraso';
        dotColor = 'bg-amber-500';
      } else if (stats.overtimeMins > 0) {
        statusType = 'overtime';
        statusLabel = 'Hora Extra';
        dotColor = 'bg-blue-500';
      } else {
        statusType = 'normal';
        statusLabel = 'Dia Normal';
        dotColor = 'bg-emerald-500';
      }

      days.push({
        dayNumber: d,
        dateStr,
        formattedDate: `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`,
        isWeekend,
        isHoliday,
        holidayName,
        statusType,
        statusLabel,
        dotColor,
        rec,
        stats
      });
    }

    return { firstDayOfWeek, days };
  }, [reportMonth, records, user.id, getHolidayInfo]);

  // Chart Data Preparation (Last 30 days)
  const chartData30Days = useMemo(() => {
    const data = [];
    const today = new Date();
    
    let cumulativeBank = 0;

    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const dateStr = getLocalDateString(d);
      const dayLabel = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;

      const rec = records.find(r => r.userId === user.id && r.date === dateStr);
      const stats = calculateRecordStats(rec);

      let workedHoursNum = rec ? (stats.workedMins / 60) : 0;
      let balanceHoursNum = rec ? (stats.balanceMins / 60) : 0;
      let delayMinsNum = rec ? stats.delayMins : 0;

      cumulativeBank += balanceHoursNum;

      data.push({
        day: dayLabel,
        dateStr,
        horas: Number(workedHoursNum.toFixed(1)),
        saldo: Number(balanceHoursNum.toFixed(1)),
        bancoAcumulado: Number(cumulativeBank.toFixed(1)),
        atraso: delayMinsNum,
        status: stats.statusBadge
      });
    }

    return data;
  }, [records, user.id]);

  // Comparison Data (This month vs Last month)
  const comparisonData = useMemo(() => {
    const [y, m] = reportMonth.split('-').map(Number);
    const lastMonthDate = new Date(y, m - 2, 1);
    const lastMonthStr = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`;
    const lastMonthRecords = records.filter(r => r.userId === user.id && r.date.startsWith(lastMonthStr));

    let lmBankMins = 0;
    let lmOvertimeMins = 0;
    let lmDelays = 0;
    let lmAbsences = 0;
    let lmDaysWorked = 0;

    lastMonthRecords.forEach(rec => {
      const stats = calculateRecordStats(rec);
      lmBankMins += stats.balanceMins;
      lmOvertimeMins += stats.overtimeMins;
      if (stats.delayMins > 0) lmDelays += 1;
      if (stats.isAbsence) lmAbsences += 1;
      if (stats.workedMins > 0) lmDaysWorked += 1;
    });

    const lmMaxDays = new Date(lastMonthDate.getFullYear(), lastMonthDate.getMonth() + 1, 0).getDate();
    let lmExpectedDays = 0;
    for (let d = 1; d <= lmMaxDays; d++) {
      const dayOfWeek = new Date(lastMonthDate.getFullYear(), lastMonthDate.getMonth(), d).getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) lmExpectedDays++;
    }
    const lmPresenceRate = lmExpectedDays > 0 ? Math.min(100, Math.round((lmDaysWorked / lmExpectedDays) * 100)) : 100;

    return [
      { metric: 'Banco de Horas (h)', esteMes: Number((monthlyStats.bankMins / 60).toFixed(1)), mesPassado: Number((lmBankMins / 60).toFixed(1)), unit: 'h' },
      { metric: 'Horas Extras (h)', esteMes: Number((monthlyStats.overtimeMins / 60).toFixed(1)), mesPassado: Number((lmOvertimeMins / 60).toFixed(1)), unit: 'h' },
      { metric: 'Atrasos (qtd)', esteMes: monthlyStats.delayCount, mesPassado: lmDelays, unit: '' },
      { metric: 'Faltas (qtd)', esteMes: monthlyStats.absenceCount, mesPassado: lmAbsences, unit: '' },
      { metric: 'Presença (%)', esteMes: monthlyStats.presenceRate, mesPassado: lmPresenceRate, unit: '%' }
    ];
  }, [monthlyStats, records, user.id, reportMonth]);

  // Detailed breakdown calculation for selected metric modal
  const metricModalDetails = useMemo(() => {
    if (!activeMetricModal) return null;

    const parts = reportMonth.split('-');
    const yStr = parts[0] || '2026';
    const mStr = parts[1] || '01';
    const monthNames = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    const monthFormattedName = `${monthNames[Math.max(0, parseInt(mStr, 10) - 1)]} de ${yStr}`;

    const daysData = calendarDays.days;

    if (activeMetricModal === 'banco') {
      const detailsList = daysData.map(d => {
        const stats = d.stats;
        const rec = d.rec;
        const balMins = stats.balanceMins;
        
        let reason = '';
        if (d.isHoliday) reason = `Feriado: ${d.holidayName || 'Nacional/Local'}`;
        else if (d.isWeekend) reason = 'Fim de semana (Folga regular)';
        else if (rec?.hasMedicalCertificate) reason = 'Atestado médico anexado (Abonado integralmente)';
        else if (d.statusType === 'absence') reason = 'Falta ou sem registro de entrada (-9h00min de débito no banco)';
        else if (stats.isIncomplete) reason = 'Inconsistência/Ponto incompleto sem saída registrada';
        else if (stats.delayMins > 0 && balMins < 0) reason = `Entrada com atraso de ${stats.delayMins} min (-${stats.delayMins}m)`;
        else if (balMins < 0) reason = `Horas trabalhadas (${stats.formattedWorked}) abaixo da jornada diária (9h00min)`;
        else if (balMins > 0) reason = `Horas extras acumuladas (+${stats.formattedBalance})`;
        else reason = 'Jornada cumprida exatamente no horário esperado';

        return {
          ...d,
          balMins,
          reason
        };
      });

      const negativeDays = detailsList.filter(d => d.balMins < 0 && !d.isWeekend && !d.isHoliday);
      const positiveDays = detailsList.filter(d => d.balMins > 0);

      const totalNegMins = negativeDays.reduce((acc, d) => acc + d.balMins, 0);
      const totalPosMins = positiveDays.reduce((acc, d) => acc + d.balMins, 0);

      return {
        type: 'banco',
        title: 'Detalhamento do Banco de Horas',
        monthName: monthFormattedName,
        currentValue: monthlyStats.formattedBank,
        isPositive: monthlyStats.isBankPositive,
        summaryText: monthlyStats.isBankPositive
          ? `Seu Banco de Horas está POSITIVO em ${monthlyStats.formattedBank}. Você acumulou créditos por tempo trabalhado além da sua jornada contratual.`
          : `Seu Banco de Horas está NEGATIVO em ${monthlyStats.formattedBank}. O saldo negativo é a soma dos débitos diários provocados por faltas sem registro de ponto (com débito de 9h por dia útil), pontos incompletos sem saída, atrasos na entrada e saídas antecipadas sem atestado médico.`,
        positiveMinsText: formatMinutesToHours(totalPosMins, true),
        negativeMinsText: formatMinutesToHours(totalNegMins, true),
        negativeCount: negativeDays.length,
        positiveCount: positiveDays.length,
        items: detailsList.filter(d => d.balMins !== 0 || d.statusType === 'absence' || d.stats.isIncomplete || d.rec)
      };
    }

    if (activeMetricModal === 'overtime') {
      const items = daysData
        .filter(d => d.stats.overtimeMins > 0)
        .map(d => ({
          ...d,
          reason: `Trabalhou ${d.stats.formattedWorked} (+${formatMinutesToHours(d.stats.overtimeMins)} além da jornada regular)`
        }));

      return {
        type: 'overtime',
        title: 'Detalhamento de Horas Extras',
        monthName: monthFormattedName,
        currentValue: monthlyStats.formattedOvertime,
        summaryText: items.length > 0
          ? `Você acumulou ${monthlyStats.formattedOvertime} de horas extras em ${items.length} dia(s) no mês de ${monthFormattedName}.`
          : `Não foram registradas horas extras no mês de ${monthFormattedName}.`,
        items
      };
    }

    if (activeMetricModal === 'atrasos') {
      const items = daysData
        .filter(d => d.stats.delayMins > 0)
        .map(d => ({
          ...d,
          reason: `Entrada registrada às ${d.rec?.entry || '--:--'} (Horário padrão: 08:00, limite com tolerância: 08:15). Atraso de ${d.stats.delayMins} min.`
        }));

      return {
        type: 'atrasos',
        title: 'Detalhamento de Atrasos',
        monthName: monthFormattedName,
        currentValue: `${monthlyStats.delayCount} atraso(s)`,
        summaryText: items.length > 0
          ? `Foram identificados ${monthlyStats.delayCount} atraso(s) na entrada em ${monthFormattedName}, totalizando ${monthlyStats.delayMins} minutos de débito.`
          : `Parabéns! Nenhum atraso registrado na entrada no mês de ${monthFormattedName}.`,
        items
      };
    }

    if (activeMetricModal === 'faltas') {
      const items = daysData
        .filter(d => d.stats.isAbsence)
        .map(d => ({
          ...d,
          reason: d.stats.isJustifiedAbsence
            ? `Ausência justificada: "${d.rec?.justificationReason}" (Nota: a justificativa sem atestado não abona a jornada, mantendo débito no banco de horas)`
            : 'Falta injustificada (Dia útil sem registro de ponto e sem justificativa - débito de -9h00 no banco)'
        }));

      const unjustifiedCount = items.filter(i => i.stats.isUnjustifiedAbsence).length;
      const justifiedCount = items.filter(i => i.stats.isJustifiedAbsence).length;

      let summaryText = '';
      if (items.length === 0) {
        summaryText = `Parabéns! Nenhuma falta ou ausência registrada no mês de ${monthFormattedName}. Dias com atestado médico são abonados e não contam como falta.`;
      } else if (unjustifiedCount > 0 && justifiedCount > 0) {
        summaryText = `Existem ${items.length} falta(s) no mês de ${monthFormattedName} (${unjustifiedCount} injustificada(s) e ${justifiedCount} com justificativa sem atestado). Lembrando: apenas atestados médicos válidos abonam o dia.`;
      } else if (justifiedCount > 0) {
        summaryText = `Existem ${justifiedCount} falta(s) com justificativa enviada no mês de ${monthFormattedName}. Como não possui atestado médico anexado, a falta é justificada mas o dia não é abonado (débito mantido no banco de horas).`;
      } else {
        summaryText = `Existem ${unjustifiedCount} falta(s) injustificada(s) sem registro de ponto ou justificativa no mês de ${monthFormattedName}.`;
      }

      return {
        type: 'faltas',
        title: 'Detalhamento de Faltas e Ausências',
        monthName: monthFormattedName,
        currentValue: `${items.length} falta(s)`,
        summaryText,
        items
      };
    }

    if (activeMetricModal === 'dias') {
      const items = daysData
        .filter(d => d.stats.workedMins > 0)
        .map(d => ({
          ...d,
          reason: `Presença confirmada (${d.stats.formattedWorked} trabalhadas • Entrada: ${d.rec?.entry || '--:--'}, Saída: ${d.rec?.exit || '--:--'})`
        }));

      return {
        type: 'dias',
        title: 'Detalhamento de Dias Trabalhados',
        monthName: monthFormattedName,
        currentValue: `${monthlyStats.daysWorked} dia(s)`,
        summaryText: `Você registrou presença e trabalhou em ${monthlyStats.daysWorked} dia(s) no mês de ${monthFormattedName}.`,
        items
      };
    }

    if (activeMetricModal === 'presenca') {
      const items = daysData.filter(d => !d.isWeekend && !d.isHoliday);

      return {
        type: 'presenca',
        title: 'Detalhamento da Presença / Pontualidade',
        monthName: monthFormattedName,
        currentValue: `${monthlyStats.presenceRate}%`,
        summaryText: `Sua taxa de assiduidade no mês de ${monthFormattedName} é de ${monthlyStats.presenceRate}%. Fórmulagem: (${monthlyStats.daysWorked} dias trabalhados / dias úteis esperados) × 100%.`,
        items
      };
    }

    return null;
  }, [activeMetricModal, calendarDays.days, monthlyStats, reportMonth, formatMinutesToHours]);

  const isPartnerUser = (u: User) => {
    const normalize = (str?: string) => (str || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const nameNorm = normalize(u.name);
    const emailNorm = normalize(u.email);
    const roleNorm = normalize(u.role);
    const deptNorm = normalize(u.department);
    return nameNorm.includes('parceir') || emailNorm.includes('parceir') || roleNorm.includes('parceir') || deptNorm.includes('parceir');
  };

  const isExternalSalesperson = (u: User) => {
    const normalize = (str?: string) => (str || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const emailNorm = normalize(u.email);
    const nameNorm = normalize(u.name);
    const deptNorm = normalize(u.department);
    const roleNorm = normalize(u.role);

    return emailNorm.includes('erica@vecgroup.com.br') ||
           emailNorm.includes('erica@ocomunicacao.com') ||
           (nameNorm.includes('erica') && (emailNorm.includes('vecgroup') || emailNorm.includes('ocomunicacao') || deptNorm.includes('extern') || roleNorm.includes('extern'))) ||
           nameNorm.includes('vendedora externa') ||
           nameNorm.includes('vendedor externo') ||
           roleNorm.includes('extern') ||
           deptNorm.includes('extern');
  };

  const isEligibleVendedor = (u: User) => {
    const statusStr = (u.status || '').toUpperCase();
    const isActive = !statusStr || statusStr === 'ATIVO' || statusStr === 'ACTIVE' || u.status === UserStatus.ACTIVE;
    if (!isActive) return false;

    if (isPartnerUser(u)) return false;
    if (isExternalSalesperson(u)) return false;

    const roleUpper = (u.role || '').toUpperCase();
    if (roleUpper === 'OWNER' || roleUpper === 'SUPERVISOR' || roleUpper === 'ADVOGADO') return false;

    return true;
  };

  const tableRecords = useMemo(() => {
    if (!isPrivileged) {
      return records
        .filter(r => r.userId === user.id && r.date && r.date.startsWith(historyMonth))
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    }
    
    return records
      .filter(r => r.date && r.date.startsWith(historyMonth) && allUsers.some(u => (u.id === r.userId || (u.email && r.userId && String(r.userId).toLowerCase() === u.email.toLowerCase())) && isEligibleVendedor(u)))
      .sort((a, b) => (b.date || '').localeCompare(a.date || '') || (a.userName || '').localeCompare(b.userName || ''));
  }, [records, historyMonth, isPrivileged, user.id, allUsers]);

  const getStatusBadge = (statusStr: string, rec?: PunchRecord) => {
    const stats = calculateRecordStats(rec);
    const badgeText = stats.statusBadge || statusStr;

    if (rec?.justificationReason) {
      return (
        <button
          type="button"
          onClick={() => setSelectedRecordJustification(rec)}
          className="bg-amber-100 hover:bg-amber-200 text-amber-900 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border border-amber-300 shadow-2xs inline-flex items-center gap-1 transition-all hover:scale-105 cursor-pointer"
          title="Clique para ver justificativa e atestado"
        >
          <FileText size={11} className="text-amber-700" />
          {rec.hasMedicalCertificate ? 'Atestado' : 'Justificado'}
        </button>
      );
    }

    switch (badgeText) {
      case 'Finalizado':
      case 'OK':
        return <span className="bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border border-emerald-200/60 shadow-sm inline-flex items-center gap-1"><CheckCircle2 size={11} /> OK</span>;
      case 'Almoço':
        return <span className="bg-amber-50 text-amber-600 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border border-amber-200/60 shadow-sm inline-flex items-center gap-1"><Coffee size={11} /> Almoço</span>;
      case 'Pausa':
        return <span className="bg-amber-100 text-amber-800 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border border-amber-300 shadow-sm inline-flex items-center gap-1 animate-pulse"><Coffee size={11} /> Em Pausa (5m)</span>;
      case 'Trabalhando':
      case 'Presente':
        return <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border border-blue-200/60 shadow-sm inline-flex items-center gap-1"><Activity size={11} /> Trabalhando</span>;
      case 'Atrasado':
        return <span className="bg-amber-50 text-amber-700 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border border-amber-200/60 shadow-sm inline-flex items-center gap-1"><Clock size={11} /> Atrasado</span>;
      case 'Hora Extra':
        return <span className="bg-sky-50 text-sky-700 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border border-sky-200/60 shadow-sm inline-flex items-center gap-1"><TrendingUp size={11} /> Hora Extra</span>;
      case 'Inconsistência':
        return <span className="bg-purple-50 text-purple-700 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border border-purple-200/60 shadow-sm inline-flex items-center gap-1"><AlertTriangle size={11} /> Inconsistência</span>;
      case 'Falta':
      case 'Ausente':
      default:
        return <span className="bg-rose-50 text-rose-600 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border border-rose-200/60 shadow-sm inline-flex items-center gap-1"><XCircleIcon size={11} /> Falta</span>;
    }
  };

  const XCircleIcon = ({ size }: { size: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>
    </svg>
  );

  const getPunchLabel = (type: string) => {
    switch(type) {
      case 'entry': return 'ENTRADA';
      case 'lunchStart': return 'INÍCIO ALMOÇO';
      case 'lunchReturn': return 'RETORNO ALMOÇO';
      case 'exit': return 'SAÍDA FINAL';
      default: return '';
    }
  };

  if (isLoading && records.length === 0) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-6 animate-in fade-in duration-500">
        <div className="relative">
          <div className="w-24 h-24 border-4 border-[#00A1E4]/20 border-t-[#00A1E4] rounded-full animate-spin" />
          <Clock className="absolute inset-0 m-auto text-[#00A1E4] animate-pulse" size={32} />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Sincronizando Ponto</h2>
          <p className="text-white/40 text-[10px] font-bold uppercase tracking-[0.2em]">Aguarde enquanto validamos seus registros no Supabase...</p>
        </div>
      </div>
    );
  }

  const userRoleStr = (user.role || '').toUpperCase();
  const isExecutiveOrSupervisor = userRoleStr === 'OWNER' || userRoleStr === 'SUPERVISOR';

  if (isExecutiveOrSupervisor) {
    return (
      <ExecutiveTimeClockDashboard
        user={user}
        allUsers={allUsers}
        records={records}
        onRefreshData={loadPunches}
        onUpdatePunch={async (rec) => {
          await supabase.punches.upsert(rec);
          await loadPunches();
        }}
        onBack={onBack}
      />
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-24">
      
      {/* MODAL DE CONFIRMAÇÃO DE PONTO */}
      {confirmPunch && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-100 animate-in zoom-in-95">
              {punchSuccess ? (
                <div className="p-14 flex flex-col items-center text-center bg-emerald-500 text-white animate-in zoom-in-95 duration-500">
                   <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mb-6 shadow-xl">
                      <CheckCircle2 size={44} className="text-white" />
                   </div>
                   <h2 className="text-2xl font-black uppercase tracking-tighter">Sucesso!</h2>
                   <p className="text-white/80 font-bold text-xs mt-2 uppercase tracking-widest">Ponto registrado com êxito.</p>
                   <div className="mt-8 px-6 py-2 bg-white/10 rounded-full text-[10px] font-black uppercase tracking-widest">
                     {formatClockTime(currentTime)} • {getPunchLabel(confirmPunch)}
                   </div>
                </div>
              ) : (
                <>
                  <div className={`p-8 flex flex-col items-center text-center ${
                    confirmPunch === 'entry' ? 'bg-[#00A1E4]' :
                    confirmPunch === 'exit' ? 'bg-rose-600' :
                    'bg-amber-500'
                  } text-white`}>
                     <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mb-4 shadow-xl animate-pulse">
                        {confirmPunch === 'entry' && <LogIn size={32} />}
                        {confirmPunch === 'exit' && <LogOut size={32} />}
                        {(confirmPunch === 'lunchStart' || confirmPunch === 'lunchReturn') && <Coffee size={32} />}
                     </div>
                     <h2 className="text-xl font-black uppercase tracking-tighter">Confirmar Registro?</h2>
                     <p className="text-white/70 font-bold text-[10px] uppercase tracking-widest mt-1 italic">Sincronizado via Supabase VECGROUP</p>
                  </div>
                  
                  <div className="p-8 space-y-6">
                     <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 flex flex-col items-center">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Horário de Registro</p>
                        <div className="flex items-baseline space-x-2">
                           <span className="text-3xl font-black text-slate-900">{formatClockTime(currentTime)}</span>
                           <span className="text-base font-bold text-slate-400">{formatClockSeconds(currentTime)}</span>
                        </div>
                        <div className="mt-3 px-4 py-1.5 bg-white border border-slate-200 rounded-xl">
                           <span className="text-[10px] font-black text-slate-700 uppercase tracking-tight">{getPunchLabel(confirmPunch)}</span>
                        </div>
                     </div>

                     <div className="flex flex-col space-y-3">
                        <button 
                          disabled={isPunching}
                          onClick={() => handlePunch(confirmPunch)} 
                          className={`w-full py-4 rounded-xl font-black text-[11px] uppercase tracking-[0.2em] shadow-xl transition-all active:scale-95 flex items-center justify-center space-x-3 ${
                            confirmPunch === 'entry' ? 'bg-[#00A1E4] text-white hover:bg-[#0081b8]' :
                            confirmPunch === 'exit' ? 'bg-rose-600 text-white hover:bg-rose-700' :
                            'bg-amber-500 text-white hover:bg-amber-600'
                          }`}
                        >
                           {isPunching ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                           <span>Confirmar Registro</span>
                        </button>
                        <button 
                          onClick={() => setConfirmPunch(null)}
                          className="w-full py-3 text-[10px] font-black uppercase text-slate-400 hover:text-slate-900 transition-colors"
                        >
                           Cancelar
                        </button>
                     </div>
                  </div>
                </>
              )}
           </div>
        </div>
      )}



      {/* MODAL DE CONFIRMAÇÃO DE PAUSA (5 MINUTOS) */}
      {confirmBreakModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-100 animate-in zoom-in-95">
            <div className="p-8 flex flex-col items-center text-center bg-gradient-to-br from-amber-500 to-orange-500 text-white">
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mb-4 shadow-xl">
                <Coffee size={32} />
              </div>
              <h2 className="text-xl font-black uppercase tracking-tighter">
                Iniciar Pausa da {confirmBreakModal === 'morning' ? 'Manhã' : 'Tarde'}?
              </h2>
              <p className="text-white/80 font-bold text-[10px] uppercase tracking-widest mt-1">
                5 Minutos de Descanso • Horário Flexível
              </p>
            </div>
            
            <div className="p-8 space-y-6">
              <div className="bg-amber-50/70 p-5 rounded-2xl border border-amber-200/60 flex flex-col items-center text-center">
                <span className="text-[10px] font-black text-amber-800 uppercase tracking-widest mb-1">Duração da Pausa</span>
                <span className="text-4xl font-black text-amber-950 font-mono tracking-tight">05:00</span>
                <p className="text-xs text-amber-850 font-medium mt-2 leading-relaxed">
                  Você decide quando iniciar. Ao clicar em confirmar, o cronômetro de 5 minutos começará a contar em tempo real e emitirá um aviso sonoro ao terminar.
                </p>
              </div>

              <div className="flex flex-col space-y-3">
                <button 
                  disabled={isProcessingBreak}
                  onClick={() => handleStartBreak(confirmBreakModal)} 
                  className="w-full py-4 rounded-xl font-black text-[11px] uppercase tracking-[0.2em] shadow-xl transition-all active:scale-95 flex items-center justify-center space-x-3 bg-amber-500 text-white hover:bg-amber-600 cursor-pointer"
                >
                  {isProcessingBreak ? <Loader2 size={18} className="animate-spin" /> : <Timer size={18} />}
                  <span>Iniciar 5 Minutos Agora</span>
                </button>
                <button 
                  onClick={() => setConfirmBreakModal(null)}
                  className="w-full py-3 text-[10px] font-black uppercase text-slate-400 hover:text-slate-900 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TOPO: VOLTAR E NAVEGAÇÃO PRINCIPAL */}
      {breakFeedbackMsg && (
        <div className="p-4 sm:p-5 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white rounded-3xl shadow-xl flex items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
              <Coffee size={20} className="text-white animate-bounce" />
            </div>
            <div>
              <h4 className="text-xs font-black uppercase tracking-wide">Pausa de 5 Minutos</h4>
              <p className="text-xs font-medium text-white/95">{breakFeedbackMsg}</p>
            </div>
          </div>
          <button
            onClick={() => setBreakFeedbackMsg(null)}
            className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-all cursor-pointer shrink-0"
          >
            <X size={18} />
          </button>
        </div>
      )}

      {/* BANNER DE PAUSA ATIVA EM ANDAMENTO */}
      {activeBreakType && (
        <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white p-5 sm:p-7 rounded-[2.5rem] shadow-2xl border border-amber-300/40 flex flex-col md:flex-row items-center justify-between gap-5 animate-in fade-in slide-in-from-top-4">
          <div className="flex items-center space-x-4 sm:space-x-5">
            <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0 shadow-lg">
              <Coffee size={32} className="text-white animate-bounce" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-white/80">Pausa Regulamentar de 5 Minutos em Andamento</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-white/20 text-white animate-pulse">
                  Ao Vivo
                </span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-black tracking-tight mt-0.5">
                {activeBreakType === 'morning' ? 'Pausa da Manhã' : 'Pausa da Tarde'}: <span className="font-mono text-amber-100">{formatSeconds(breakSecondsLeft)}</span>
              </h3>
              <p className="text-xs text-white/90 font-medium mt-1">
                Aproveite os 5 minutos para descansar a vista, levantar-se e se hidratar. Ao término, soará um aviso sonoro.
              </p>
              <div className="w-full bg-black/20 h-2 rounded-full overflow-hidden mt-3 max-w-md">
                <div 
                  className="bg-white h-full rounded-full transition-all duration-1000"
                  style={{ width: `${Math.min(100, Math.max(0, ((300 - breakSecondsLeft) / 300) * 100))}%` }}
                />
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-3 w-full md:w-auto justify-end">
            <button
              onClick={() => handleFinishBreak(activeBreakType)}
              className="flex-1 md:flex-none px-6 py-4 bg-white text-amber-900 hover:bg-amber-50 rounded-2xl text-xs font-black uppercase tracking-wider transition-all shadow-xl hover:scale-105 flex items-center justify-center space-x-2 cursor-pointer font-bold"
            >
              <Check size={18} />
              <span>Concluir Pausa Agora</span>
            </button>
            <button
              onClick={() => handleResetBreak(activeBreakType)}
              className="px-4 py-4 bg-black/20 hover:bg-black/30 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center cursor-pointer"
              title="Cancelar ou reiniciar pausa"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      )}

      {welcomeFeedbackMessage && (
        <div className="p-4 sm:p-5 bg-gradient-to-r from-[#00A1E4] to-emerald-500 text-white rounded-3xl shadow-xl flex items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
              <Sparkles size={20} className="text-white" />
            </div>
            <div>
              <h4 className="text-xs font-black uppercase tracking-wide">Ponto Configurado com Sucesso!</h4>
              <p className="text-xs font-medium text-white/90">{welcomeFeedbackMessage}</p>
            </div>
          </div>
          <button
            onClick={() => setWelcomeFeedbackMessage(null)}
            className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-all cursor-pointer shrink-0"
          >
            <X size={18} />
          </button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="flex flex-col w-full sm:w-auto">
          <button onClick={onBack} className="flex items-center space-x-2 text-slate-400 hover:text-white transition-colors mb-4 group w-fit">
            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
            <span className="text-[10px] font-black uppercase tracking-widest">Voltar ao CRM</span>
          </button>
          <div className="flex items-center space-x-4">
             <div className="w-10 h-10 sm:w-12 sm:h-12 bg-[#00A1E4]/20 text-[#00A1E4] rounded-2xl flex items-center justify-center border border-[#00A1E4]/30 shadow-sm">
               <Clock size={22} className="sm:w-6 sm:h-6" />
             </div>
             <div>
                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tighter uppercase leading-none">Relógio Ponto RH</h1>
                <p className="text-white/60 text-[10px] sm:text-xs font-medium mt-1">Acompanhamento completo da jornada e banco de horas</p>
             </div>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <button 
            type="button"
            onClick={() => setShowFirstTimeWelcomeModal(true)}
            className="flex-1 sm:flex-none flex items-center justify-center space-x-2 px-4 py-3 bg-[#00A1E4]/20 hover:bg-[#00A1E4]/30 border border-[#00A1E4]/40 rounded-xl text-[10px] font-black uppercase text-white transition-all shadow-sm cursor-pointer"
            title="Configurar ou alterar data em que você começou na empresa"
          >
            <Calendar size={14} className="text-[#00A1E4]" />
            <span>Início: {formatBrazilianDateWithWeekday(getUserStartDate(user, records)).split(',')[0]}</span>
          </button>

          <button onClick={loadPunches} className="flex-1 sm:flex-none flex items-center justify-center space-x-2 px-4 sm:px-6 py-3 bg-white/10 backdrop-blur-md border border-white/10 rounded-xl text-[10px] font-black uppercase text-white hover:bg-white/20 transition-all shadow-sm">
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            <span>Atualizar</span>
          </button>
          
          <div className="flex-1 sm:flex-none flex items-center bg-white/10 backdrop-blur-md border border-white/10 rounded-xl p-1 shadow-sm">
            <button 
              onClick={handlePrevMonth} 
              title="Mês anterior"
              className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-all"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="flex items-center px-1 sm:px-3 space-x-2">
              <Calendar size={14} className="text-white/60" />
              <input 
                type="month" 
                value={reportMonth} 
                onChange={(e) => setReportMonth(e.target.value)}
                className="text-[10px] sm:text-[11px] font-black text-white focus:outline-none bg-transparent w-24 sm:w-auto cursor-pointer"
              />
            </div>
            <button 
              onClick={handleNextMonth} 
              title="Próximo mês"
              className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-all"
            >
              <ChevronRight size={16} />
            </button>

            {isPrivileged && (
              <button 
                onClick={exportReport} 
                className="flex items-center justify-center space-x-2 px-3 sm:px-5 py-2.5 bg-[#00A1E4] text-white rounded-lg text-[10px] font-black uppercase hover:bg-[#0081b8] shadow-xl shadow-[#00A1E4]/20 transition-all ml-1"
              >
                <Download size={14} />
                <span className="hidden sm:inline">Exportar</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* MOSTRADOR PRINCIPAL DO RELÓGIO PONTO */}
      <div className="bg-white rounded-[2rem] sm:rounded-[3rem] shadow-xl border border-slate-100 p-8 sm:p-12 lg:p-14 flex flex-col items-center text-center relative overflow-hidden">
        <div className="relative z-10 w-full">
          <div className="flex items-baseline justify-center">
            <h2 className="text-6xl sm:text-8xl lg:text-[130px] font-black text-slate-900 tracking-tighter leading-none select-none">
              {formatClockTime(currentTime)}
            </h2>
            <span className="text-xl sm:text-3xl font-black text-slate-300 ml-2 sm:ml-4 select-none mb-2 sm:mb-4">
              {formatClockSeconds(currentTime)}
            </span>
          </div>
          <p className="text-xs sm:text-lg font-black text-slate-500 uppercase tracking-[0.2em] mt-3 sm:mt-5">
            {formatClockDate(currentTime)}
          </p>
          
          <div className="mt-5 sm:mt-7 flex justify-center">
            {!nextPunchType && myTodayRecord?.exit ? (
              <div className="bg-emerald-50 text-emerald-600 px-4 sm:px-8 py-2 sm:py-3 rounded-full border border-emerald-100 flex items-center space-x-2 sm:space-x-3 animate-in zoom-in-95">
                <CheckCircle2 size={16} className="sm:w-5 sm:h-5" />
                <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest">Jornada Finalizada</span>
              </div>
            ) : nextPunchType ? (
              <button
                type="button"
                onClick={() => {
                  if (isNewUserWithoutStartDate(user, records)) {
                    setShowFirstTimeWelcomeModal(true);
                    return;
                  }
                  handlePunch(nextPunchType);
                }}
                className="bg-blue-50 hover:bg-blue-100 text-blue-600 px-4 sm:px-8 py-2 sm:py-3 rounded-full border border-blue-200 flex items-center space-x-2 sm:space-x-3 transition-all hover:scale-105 cursor-pointer shadow-sm"
              >
                <Clock size={16} className="sm:w-5 sm:h-5 animate-pulse" />
                <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest">Aguardando: {getPunchLabel(nextPunchType)} (Clique para Bater)</span>
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {/* BOTÕES DE BATER PONTO (ENTRADA / ALMOÇO / RETORNO / SAÍDA) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
        {[
          { label: 'ENTRADA', field: 'entry', icon: <LogIn size={20} />, action: 'entry', color: 'bg-blue-50 text-blue-500' },
          { label: 'ALMOÇO', field: 'lunchStart', icon: <Coffee size={20} />, action: 'lunchStart', color: 'bg-amber-50 text-amber-500' },
          { label: 'RETORNO', field: 'lunchReturn', icon: <RefreshCw size={20} />, action: 'lunchReturn', color: 'bg-indigo-50 text-indigo-500' },
          { label: 'SAÍDA', field: 'exit', icon: <LogOut size={20} />, action: 'exit', color: 'bg-rose-50 text-rose-500' },
        ].map((item) => {
          const isPunched = !!myTodayRecord?.[item.field as keyof PunchRecord];
          const isNext = item.action === nextPunchType;
          const isDisabled = isLoading || isPunching || (!isNext && !isPunched);

          return (
            <button 
              key={item.label}
              disabled={isDisabled}
              onClick={() => {
                if (isNewUserWithoutStartDate(user, records)) {
                  setShowFirstTimeWelcomeModal(true);
                  return;
                }
                handlePunch(item.action as any);
              }}
              className={`bg-white p-4 sm:p-7 rounded-[1.8rem] border transition-all flex flex-col sm:flex-row items-center sm:items-center justify-center sm:justify-start space-y-3 sm:space-y-0 sm:space-x-5 group relative shadow-sm ${
                isPunched 
                  ? 'border-emerald-200 ring-2 ring-emerald-50' 
                  : isNext
                    ? 'border-[#00A1E4] ring-4 ring-[#00A1E4]/10 shadow-lg scale-[1.02]'
                    : 'border-slate-100 opacity-40 grayscale'
              } ${!isDisabled && !isPunched ? 'hover:border-[#00A1E4] hover:shadow-xl hover:scale-[1.02]' : ''}`}
            >
              {isNext && (
                <div className="absolute -top-2.5 -right-1 bg-[#00A1E4] text-white text-[7px] sm:text-[8px] font-black px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full shadow-md animate-bounce">
                  PRÓXIMO
                </div>
              )}
              <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center transition-all ${isPunched ? 'bg-emerald-500 text-white' : isNext ? 'bg-[#00A1E4] text-white' : item.color}`}>
                {isPunching && isNext ? <Loader2 className="animate-spin" size={18} /> : item.icon}
              </div>
              <div className="text-center sm:text-left">
                <p className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{item.label}</p>
                <h4 className={`text-sm sm:text-lg font-black ${isPunched ? 'text-emerald-600' : isNext ? 'text-[#00A1E4]' : 'text-slate-300'}`}>
                  {myTodayRecord?.[item.field as keyof PunchRecord] || '--:--'}
                </h4>
              </div>
            </button>
          );
        })}
      </div>

      {/* PAUSAS REGULAMENTARES DE 5 MINUTOS (MANHÃ E TARDE - HORÁRIO LIVRE) */}
      <div className="bg-white rounded-[2rem] sm:rounded-[2.5rem] border border-slate-100 shadow-sm p-6 sm:p-8 space-y-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold shrink-0">
              <Coffee size={22} />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm sm:text-base font-black uppercase text-slate-800 tracking-tight">Pausas de Descanso • 5 Minutos Cada</h3>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[9px] font-black uppercase tracking-wider border border-emerald-200">
                  Horário Flexível
                </span>
              </div>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-0.5">
                Você decide quando realizar a pausa da manhã e a pausa da tarde ao longo do expediente
              </p>
            </div>
          </div>
          <span className="text-[10px] font-bold text-slate-500 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
            Tempo Remunerado • Bem-estar e Foco
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card Pausa da Manhã (5 min) */}
          <div className={`p-5 sm:p-6 rounded-[2rem] border transition-all ${
            myTodayRecord?.morningBreakEnd
              ? 'bg-emerald-50/40 border-emerald-200'
              : isMorningBreakActive
                ? 'bg-amber-50/60 border-amber-300 ring-2 ring-amber-400/30 shadow-md'
                : 'bg-slate-50/50 border-slate-200 hover:border-amber-300'
          }`}>
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                  myTodayRecord?.morningBreakEnd 
                    ? 'bg-emerald-500 text-white' 
                    : isMorningBreakActive 
                      ? 'bg-amber-500 text-white animate-pulse' 
                      : 'bg-amber-100 text-amber-700'
                }`}>
                  <Sun size={22} />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h4 className="text-xs sm:text-sm font-black text-slate-900 uppercase">Pausa da Manhã (5 min)</h4>
                    {myTodayRecord?.morningBreakEnd && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[8px] font-black uppercase">
                        Concluída
                      </span>
                    )}
                    {isMorningBreakActive && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-[8px] font-black uppercase animate-pulse">
                        Em Andamento
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                    Período Matutino • Você escolhe o horário
                  </p>
                </div>
              </div>

              {myTodayRecord?.morningBreakStart && (
                <button
                  type="button"
                  onClick={() => handleResetBreak('morning')}
                  className="text-slate-400 hover:text-rose-500 p-1.5 rounded-lg hover:bg-white transition-colors cursor-pointer"
                  title="Redefinir ou cancelar pausa da manhã"
                >
                  <RefreshCw size={13} />
                </button>
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-slate-200/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Registro</span>
                <span className="text-sm sm:text-base font-black text-slate-800">
                  {myTodayRecord?.morningBreakStart ? (
                    <>
                      {myTodayRecord.morningBreakStart}
                      {myTodayRecord.morningBreakEnd ? ` – ${myTodayRecord.morningBreakEnd}` : ' (em andamento)'}
                    </>
                  ) : (
                    'Não realizada hoje'
                  )}
                </span>
              </div>

              <div>
                {myTodayRecord?.morningBreakEnd ? (
                  <div className="flex items-center space-x-1.5 text-emerald-600 bg-white px-3 py-1.5 rounded-xl border border-emerald-200 shadow-2xs">
                    <CheckCircle2 size={16} />
                    <span className="text-[10px] font-black uppercase tracking-wider">5 Minutos Concluídos</span>
                  </div>
                ) : isMorningBreakActive ? (
                  <button
                    type="button"
                    onClick={() => handleFinishBreak('morning')}
                    className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider shadow-md shadow-amber-500/20 transition-all flex items-center space-x-1.5 cursor-pointer font-bold"
                  >
                    <Check size={14} />
                    <span>Concluir ({formatSeconds(breakSecondsLeft)})</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmBreakModal('morning')}
                    className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider shadow-md shadow-amber-500/20 transition-all flex items-center space-x-1.5 cursor-pointer hover:scale-105 active:scale-95 font-bold"
                  >
                    <Timer size={14} />
                    <span>Iniciar Pausa Manhã (5m)</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Card Pausa da Tarde (5 min) */}
          <div className={`p-5 sm:p-6 rounded-[2rem] border transition-all ${
            myTodayRecord?.afternoonBreakEnd
              ? 'bg-emerald-50/40 border-emerald-200'
              : isAfternoonBreakActive
                ? 'bg-amber-50/60 border-amber-300 ring-2 ring-amber-400/30 shadow-md'
                : 'bg-slate-50/50 border-slate-200 hover:border-amber-300'
          }`}>
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                  myTodayRecord?.afternoonBreakEnd 
                    ? 'bg-emerald-500 text-white' 
                    : isAfternoonBreakActive 
                      ? 'bg-amber-500 text-white animate-pulse' 
                      : 'bg-indigo-100 text-indigo-700'
                }`}>
                  <Sunset size={22} />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h4 className="text-xs sm:text-sm font-black text-slate-900 uppercase">Pausa da Tarde (5 min)</h4>
                    {myTodayRecord?.afternoonBreakEnd && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[8px] font-black uppercase">
                        Concluída
                      </span>
                    )}
                    {isAfternoonBreakActive && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-[8px] font-black uppercase animate-pulse">
                        Em Andamento
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                    Período Vespertino • Você escolhe o horário
                  </p>
                </div>
              </div>

              {myTodayRecord?.afternoonBreakStart && (
                <button
                  type="button"
                  onClick={() => handleResetBreak('afternoon')}
                  className="text-slate-400 hover:text-rose-500 p-1.5 rounded-lg hover:bg-white transition-colors cursor-pointer"
                  title="Redefinir ou cancelar pausa da tarde"
                >
                  <RefreshCw size={13} />
                </button>
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-slate-200/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Registro</span>
                <span className="text-sm sm:text-base font-black text-slate-800">
                  {myTodayRecord?.afternoonBreakStart ? (
                    <>
                      {myTodayRecord.afternoonBreakStart}
                      {myTodayRecord.afternoonBreakEnd ? ` – ${myTodayRecord.afternoonBreakEnd}` : ' (em andamento)'}
                    </>
                  ) : (
                    'Não realizada hoje'
                  )}
                </span>
              </div>

              <div>
                {myTodayRecord?.afternoonBreakEnd ? (
                  <div className="flex items-center space-x-1.5 text-emerald-600 bg-white px-3 py-1.5 rounded-xl border border-emerald-200 shadow-2xs">
                    <CheckCircle2 size={16} />
                    <span className="text-[10px] font-black uppercase tracking-wider">5 Minutos Concluídos</span>
                  </div>
                ) : isAfternoonBreakActive ? (
                  <button
                    type="button"
                    onClick={() => handleFinishBreak('afternoon')}
                    className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider shadow-md shadow-amber-500/20 transition-all flex items-center space-x-1.5 cursor-pointer font-bold"
                  >
                    <Check size={14} />
                    <span>Concluir ({formatSeconds(breakSecondsLeft)})</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmBreakModal('afternoon')}
                    className="px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider shadow-md shadow-indigo-500/20 transition-all flex items-center space-x-1.5 cursor-pointer hover:scale-105 active:scale-95 font-bold"
                  >
                    <Timer size={14} />
                    <span>Iniciar Pausa Tarde (5m)</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* TIMELINE HORIZONTAL DA JORNADA ATUAL (COM PAUSAS DE 5 MINUTOS) */}
      <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 p-6 sm:p-8 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-xl bg-[#00A1E4]/10 text-[#00A1E4] flex items-center justify-center font-bold shrink-0">
              <Activity size={18} />
            </div>
            <div>
              <h3 className="text-xs font-black uppercase text-slate-800 tracking-tight">Timeline da Jornada de Hoje</h3>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest">Sequência de batidas e pausas regulamentares</p>
            </div>
          </div>
          <span className="text-[10px] font-bold text-slate-500 uppercase bg-slate-50 px-3 py-1 rounded-full border border-slate-100">
            Seg-Qui: 08:00–18:00 | Sex: 08:00–17:00 (Pausas livres de 5m)
          </span>
        </div>

        <div className="relative pt-4 pb-2">
          {/* Connector Line */}
          <div className="absolute top-1/2 left-8 right-8 h-1 bg-slate-100 -translate-y-1/2 rounded-full z-0 hidden lg:block" />

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 relative z-10">
            {[
              { 
                title: '1. Entrada', 
                time: myTodayRecord?.entry, 
                isDone: !!myTodayRecord?.entry, 
                isCurrent: nextPunchType === 'entry',
                icon: <LogIn size={16} />
              },
              { 
                title: '2. Pausa Manhã (5m)', 
                time: myTodayRecord?.morningBreakStart 
                  ? `${myTodayRecord.morningBreakStart}${myTodayRecord.morningBreakEnd ? ` - ${myTodayRecord.morningBreakEnd}` : ' (Ativa)'}`
                  : undefined, 
                isDone: !!myTodayRecord?.morningBreakEnd, 
                isCurrent: isMorningBreakActive,
                icon: <Sun size={16} />
              },
              { 
                title: '3. Almoço (Saída)', 
                time: myTodayRecord?.lunchStart, 
                isDone: !!myTodayRecord?.lunchStart, 
                isCurrent: nextPunchType === 'lunchStart' && !isMorningBreakActive,
                icon: <Coffee size={16} />
              },
              { 
                title: '4. Almoço (Volta)', 
                time: myTodayRecord?.lunchReturn, 
                isDone: !!myTodayRecord?.lunchReturn, 
                isCurrent: nextPunchType === 'lunchReturn',
                icon: <RefreshCw size={16} />
              },
              { 
                title: '5. Pausa Tarde (5m)', 
                time: myTodayRecord?.afternoonBreakStart 
                  ? `${myTodayRecord.afternoonBreakStart}${myTodayRecord.afternoonBreakEnd ? ` - ${myTodayRecord.afternoonBreakEnd}` : ' (Ativa)'}`
                  : undefined, 
                isDone: !!myTodayRecord?.afternoonBreakEnd, 
                isCurrent: isAfternoonBreakActive,
                icon: <Sunset size={16} />
              },
              { 
                title: '6. Saída Final', 
                time: myTodayRecord?.exit, 
                isDone: !!myTodayRecord?.exit, 
                isCurrent: nextPunchType === 'exit' && !isAfternoonBreakActive,
                icon: <LogOut size={16} />
              }
            ].map((step, idx) => (
              <div key={idx} className="flex flex-col items-center text-center p-3 rounded-2xl bg-white border border-slate-100 shadow-2xs">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all border-2 shadow-sm ${
                  step.isDone 
                    ? 'bg-emerald-500 border-emerald-500 text-white' 
                    : step.isCurrent 
                      ? 'bg-white border-amber-500 text-amber-500 ring-4 ring-amber-400/20 animate-pulse' 
                      : 'bg-slate-50 border-slate-200 text-slate-300'
                }`}>
                  {step.isDone ? <Check size={18} /> : step.icon}
                </div>
                <span className="text-[10px] font-black text-slate-700 uppercase tracking-tight mt-2">{step.title}</span>
                <span className={`text-[10px] font-bold mt-0.5 truncate max-w-full ${step.isDone ? 'text-emerald-600' : step.isCurrent ? 'text-amber-500 font-black' : 'text-slate-400'}`}>
                  {step.time || (step.isCurrent ? 'Em Andamento' : 'Disponível')}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* NOVA SEÇÃO: RESUMO DO MÊS (6 CARDS HORIZONTAIS) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-xl bg-[#00A1E4] text-white flex items-center justify-center shadow-md shadow-[#00A1E4]/30">
              <BarChart3 size={18} />
            </div>
            <div>
              <h2 className="text-lg font-black text-white uppercase tracking-tight">Resumo do Mês</h2>
              <p className="text-[10px] text-white/50 font-bold uppercase tracking-widest">Indicadores de desempenho do colaborador em tempo real</p>
            </div>
          </div>
          <div className="flex items-center space-x-1.5 bg-[#00A1E4]/10 px-3 py-1 rounded-full border border-[#00A1E4]/20">
            <button 
              onClick={handlePrevMonth} 
              title="Mês anterior"
              className="text-[#00A1E4] hover:text-white transition-colors"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="text-[10px] font-black uppercase tracking-widest text-[#00A1E4] px-1">
              {reportMonth}
            </span>
            <button 
              onClick={handleNextMonth} 
              title="Próximo mês"
              className="text-[#00A1E4] hover:text-white transition-colors"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          {/* 1. Banco de Horas */}
          <div 
            onClick={() => setActiveMetricModal('banco')}
            className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-lg hover:border-[#00A1E4] transition-all cursor-pointer group relative overflow-hidden"
          >
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Banco de Horas</span>
              <div className={`p-1.5 rounded-lg ${monthlyStats.isBankPositive ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                {monthlyStats.isBankPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              </div>
            </div>
            <div className="mt-3">
              <h3 className={`text-xl font-black tracking-tight ${monthlyStats.isBankPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                {monthlyStats.formattedBank}
              </h3>
              <span className={`inline-block mt-1 text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${monthlyStats.isBankPositive ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                {monthlyStats.isBankPositive ? 'Saldo Positivo' : 'Saldo Negativo'}
              </span>
            </div>
            <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[8px] font-black uppercase text-[#00A1E4] opacity-80 group-hover:opacity-100 transition-opacity">
              <span>Ver detalhes</span>
              <ChevronRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>

          {/* 2. Horas Extras */}
          <div 
            onClick={() => setActiveMetricModal('overtime')}
            className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-lg hover:border-blue-400 transition-all cursor-pointer group relative overflow-hidden"
          >
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Horas Extras</span>
              <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
                <Flame size={14} />
              </div>
            </div>
            <div className="mt-3">
              <h3 className="text-xl font-black text-blue-600 tracking-tight">
                {monthlyStats.formattedOvertime}
              </h3>
              <span className="inline-block mt-1 text-[8px] font-black uppercase px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                Acumuladas
              </span>
            </div>
            <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[8px] font-black uppercase text-blue-600 opacity-80 group-hover:opacity-100 transition-opacity">
              <span>Ver detalhes</span>
              <ChevronRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>

          {/* 3. Atrasos */}
          <div 
            onClick={() => setActiveMetricModal('atrasos')}
            className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-lg hover:border-amber-400 transition-all cursor-pointer group relative overflow-hidden"
          >
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Atrasos</span>
              <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
                <Clock size={14} />
              </div>
            </div>
            <div className="mt-3">
              <h3 className="text-xl font-black text-amber-600 tracking-tight">
                {monthlyStats.delayCount}
              </h3>
              <p className="text-[9px] font-bold text-slate-400 mt-1 truncate">
                {monthlyStats.delayMins} min acumulados
              </p>
            </div>
            <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[8px] font-black uppercase text-amber-600 opacity-80 group-hover:opacity-100 transition-opacity">
              <span>Ver detalhes</span>
              <ChevronRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>

          {/* 4. Faltas */}
          <div 
            onClick={() => setActiveMetricModal('faltas')}
            className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-lg hover:border-rose-400 transition-all cursor-pointer group relative overflow-hidden"
          >
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Faltas</span>
              <div className="p-1.5 rounded-lg bg-rose-50 text-rose-600">
                <AlertCircle size={14} />
              </div>
            </div>
            <div className="mt-3">
              <h3 className="text-xl font-black text-rose-600 tracking-tight">
                {monthlyStats.absenceCount}
              </h3>
              <span className={`inline-block mt-1 text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${
                monthlyStats.absenceCount === 0 
                  ? 'bg-emerald-50 text-emerald-700' 
                  : monthlyStats.unjustifiedAbsenceCount > 0 
                    ? 'bg-rose-50 text-rose-700' 
                    : 'bg-amber-50 text-amber-700'
              }`}>
                {monthlyStats.absenceCount === 0 
                  ? 'Sem Faltas' 
                  : monthlyStats.unjustifiedAbsenceCount > 0 
                    ? `${monthlyStats.unjustifiedAbsenceCount} Injustificada(s)` 
                    : `${monthlyStats.justifiedAbsenceCount} Justificada(s)`}
              </span>
            </div>
            <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[8px] font-black uppercase text-rose-600 opacity-80 group-hover:opacity-100 transition-opacity">
              <span>Ver detalhes</span>
              <ChevronRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>

          {/* 5. Dias Trabalhados */}
          <div 
            onClick={() => setActiveMetricModal('dias')}
            className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-lg hover:border-emerald-400 transition-all cursor-pointer group relative overflow-hidden"
          >
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Dias Trabalhados</span>
              <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                <CalendarDays size={14} />
              </div>
            </div>
            <div className="mt-3">
              <h3 className="text-xl font-black text-emerald-600 tracking-tight">
                {monthlyStats.daysWorked}
              </h3>
              <span className="inline-block mt-1 text-[8px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                Dias Ativos
              </span>
            </div>
            <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[8px] font-black uppercase text-emerald-600 opacity-80 group-hover:opacity-100 transition-opacity">
              <span>Ver detalhes</span>
              <ChevronRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>

          {/* 6. Presença */}
          <div 
            onClick={() => setActiveMetricModal('presenca')}
            className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-lg hover:border-emerald-400 transition-all cursor-pointer group relative overflow-hidden"
          >
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Presença</span>
              <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                <Award size={14} />
              </div>
            </div>
            <div className="mt-3">
              <h3 className="text-xl font-black text-emerald-600 tracking-tight">
                {monthlyStats.presenceRate}%
              </h3>
              <span className="inline-block mt-1 text-[8px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                Pontualidade
              </span>
            </div>
            <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[8px] font-black uppercase text-emerald-600 opacity-80 group-hover:opacity-100 transition-opacity">
              <span>Ver detalhes</span>
              <ChevronRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>
        </div>
      </div>

      {/* ÍNDICE GERAL DE DESEMPENHO (CARD MAIOR) */}
      <div className="bg-gradient-to-br from-white to-slate-50 p-6 sm:p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-3 max-w-xl">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-[#00A1E4] text-white flex items-center justify-center shadow-lg shadow-[#00A1E4]/30">
                <ShieldCheck size={20} />
              </div>
              <div>
                <span className="text-[10px] font-black text-[#00A1E4] uppercase tracking-widest">Índice Geral de Assiduidade</span>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Meu Desempenho</h3>
              </div>
            </div>

            <div className="flex items-center space-x-4 pt-1">
              <div className="flex items-baseline space-x-1">
                <span className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight">{monthlyStats.score}</span>
                <span className="text-sm font-bold text-slate-400">/100</span>
              </div>

              <div className="flex flex-col space-y-1">
                <div className="flex text-amber-400 space-x-0.5">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star key={s} size={18} fill="currentColor" />
                  ))}
                </div>
                <span className="text-xs font-black text-emerald-600 uppercase tracking-wider">
                  {monthlyStats.score >= 90 ? 'Excelente' : monthlyStats.score >= 75 ? 'Bom' : 'Atenção Necessária'}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full lg:w-auto">
            <div className="flex items-center space-x-2.5 bg-white p-3.5 px-4 rounded-xl border border-slate-100 shadow-2xs">
              <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                <Check size={14} />
              </div>
              <span className="text-xs font-bold text-slate-700">
                {monthlyStats.absenceCount === 0 ? 'Sem faltas injustificadas' : `${monthlyStats.absenceCount} falta registrada`}
              </span>
            </div>

            <div className="flex items-center space-x-2.5 bg-white p-3.5 px-4 rounded-xl border border-slate-100 shadow-2xs">
              <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                <Check size={14} />
              </div>
              <span className="text-xs font-bold text-slate-700">
                Apenas {monthlyStats.delayCount} atraso{monthlyStats.delayCount !== 1 ? 's' : ''}
              </span>
            </div>

            <div className="flex items-center space-x-2.5 bg-white p-3.5 px-4 rounded-xl border border-slate-100 shadow-2xs">
              <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                <Check size={14} />
              </div>
              <span className="text-xs font-bold text-slate-700">
                Banco {monthlyStats.isBankPositive ? 'positivo' : 'em acompanhamento'} ({monthlyStats.formattedBank})
              </span>
            </div>

            <div className="flex items-center space-x-2.5 bg-white p-3.5 px-4 rounded-xl border border-slate-100 shadow-2xs">
              <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                <Check size={14} />
              </div>
              <span className="text-xs font-bold text-slate-700">
                Jornada dentro do esperado
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* FEEDBACK INTELIGENTE & PENDÊNCIAS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Feedback Inteligente */}
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white p-6 rounded-[2rem] shadow-lg shadow-emerald-500/10 flex items-start space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0">
            <Sparkles size={24} className="text-white" />
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-white/70">Feedback Inteligente</span>
            <h4 className="text-base font-black tracking-tight">
              {monthlyStats.delayCount === 0 
                ? '🎉 Você está há 15 dias sem atrasos! Parabéns!'
                : monthlyStats.isBankPositive
                  ? '👏 Seu banco de horas está positivo neste mês.'
                  : `⚠ Você acumulou ${monthlyStats.delayMins} minutos de atraso.`
              }
            </h4>
            <p className="text-xs text-white/80 font-medium leading-relaxed pt-1">
              {monthlyStats.isBankPositive
                ? 'Sua pontualidade e consistência estão garantindo um ótimo aproveitamento da jornada de trabalho.'
                : 'Mantenha o alinhamento com a equipe e busque evitar pequenos atrasos nos próximos registros.'
              }
            </p>
          </div>
        </div>

        {/* Pendências */}
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-start space-x-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
            monthlyStats.incompleteCount > 0 ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'
          }`}>
            {monthlyStats.incompleteCount > 0 ? <AlertTriangle size={24} /> : <CheckCircle size={24} />}
          </div>
          <div className="space-y-2 flex-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Pendências da Jornada</span>
            <h4 className="text-base font-black tracking-tight text-slate-900">
              {monthlyStats.incompleteCount > 0 
                ? `⚠ Existe${monthlyStats.incompleteCount > 1 ? 'm' : ''} ${monthlyStats.incompleteCount} registro${monthlyStats.incompleteCount > 1 ? 's' : ''} incompleto${monthlyStats.incompleteCount > 1 ? 's' : ''}:`
                : '✅ Nenhuma pendência encontrada.'
              }
            </h4>
            <p className="text-xs text-slate-500 font-medium leading-relaxed">
              {monthlyStats.incompleteCount > 0
                ? 'Clique no dia abaixo para visualizar os detalhes do ponto e solicitar a correção ao RH:'
                : 'Todos os seus pontos batidos no mês estão sincronizados e válidos no sistema.'
              }
            </p>

            {monthlyStats.incompleteDays && monthlyStats.incompleteDays.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {monthlyStats.incompleteDays.map((incDay) => (
                  <button
                    key={incDay.dateStr}
                    onClick={() => {
                      const matchingCalDay = calendarDays.days.find(d => d.dateStr === incDay.dateStr);
                      if (matchingCalDay) {
                        setSelectedCalendarDay({
                          dateStr: matchingCalDay.dateStr,
                          formattedDate: matchingCalDay.formattedDate,
                          entry: matchingCalDay.rec?.entry || '--:--',
                          lunchStart: matchingCalDay.rec?.lunchStart || '--:--',
                          lunchReturn: matchingCalDay.rec?.lunchReturn || '--:--',
                          exit: matchingCalDay.rec?.exit || '--:--',
                          workedHours: matchingCalDay.stats.formattedWorked,
                          balance: matchingCalDay.stats.formattedBalance,
                          status: matchingCalDay.statusLabel,
                          statusType: matchingCalDay.statusType,
                          isHoliday: matchingCalDay.isHoliday,
                          holidayName: matchingCalDay.holidayName,
                          isCustomHoliday: !!customHolidays[matchingCalDay.dateStr],
                          justificationReason: matchingCalDay.rec?.justificationReason,
                          hasMedicalCertificate: matchingCalDay.rec?.hasMedicalCertificate,
                          medicalCertificateAttachment: matchingCalDay.rec?.medicalCertificateAttachment
                        });
                      } else {
                        setSelectedCalendarDay({
                          dateStr: incDay.dateStr,
                          formattedDate: incDay.formattedDate,
                          entry: incDay.rec?.entry || '--:--',
                          lunchStart: incDay.rec?.lunchStart || '--:--',
                          lunchReturn: incDay.rec?.lunchReturn || '--:--',
                          exit: incDay.rec?.exit || '--:--',
                          workedHours: 'Ponto Incompleto',
                          balance: '--:--',
                          status: 'Inconsistência',
                          statusType: 'incomplete',
                          justificationReason: incDay.rec?.justificationReason,
                          hasMedicalCertificate: incDay.rec?.hasMedicalCertificate,
                          medicalCertificateAttachment: incDay.rec?.medicalCertificateAttachment
                        });
                      }
                    }}
                    className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-xl text-xs font-black transition-all flex items-center space-x-2 shadow-2xs hover:scale-[1.02] active:scale-95 cursor-pointer"
                  >
                    <AlertTriangle size={14} className="text-amber-600 shrink-0" />
                    <span>{incDay.formattedDate}</span>
                    <span className="text-[10px] bg-amber-200/70 text-amber-900 px-1.5 py-0.5 rounded-md font-bold uppercase ml-1">
                      Ver Detalhes
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CALENDÁRIO INTELIGENTE MENSAL */}
      <div className="bg-white p-6 sm:p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center">
              <CalendarDays size={20} />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Calendário Inteligente</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status diário detalhado do mês atual</p>
            </div>
          </div>

          {/* Legenda de cores */}
          <div className="flex flex-wrap items-center gap-3 text-[10px] font-bold text-slate-600">
            <div className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span>🟢 Dia normal</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <span>🟡 Atraso</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              <span>🔵 Hora extra</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
              <span>🔴 Falta</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#8B5CF6]" />
              <span>🟣 Feriado</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
              <span>⚪ Folga</span>
            </div>
          </div>
        </div>

        {/* Grid do Calendário */}
        <div className="grid grid-cols-7 gap-2 sm:gap-3">
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((dayName, idx) => (
            <div key={`${dayName}-${idx}`} className="text-center text-[10px] font-black text-slate-400 uppercase tracking-widest py-1">
              {dayName}
            </div>
          ))}

          {/* Espaços vazios para alinhar o primeiro dia do mês ao dia da semana correto */}
          {Array.from({ length: calendarDays.firstDayOfWeek }).map((_, i) => (
            <div key={`empty-padding-${i}`} className="p-3 rounded-2xl border border-transparent bg-slate-50/20 opacity-30 h-20" />
          ))}

          {calendarDays.days.map((day) => (
            <button
              key={day.dateStr}
              onClick={() => {
                setSelectedCalendarDay({
                  dateStr: day.dateStr,
                  formattedDate: day.formattedDate,
                  entry: day.rec?.entry || '--:--',
                  lunchStart: day.rec?.lunchStart || '--:--',
                  lunchReturn: day.rec?.lunchReturn || '--:--',
                  exit: day.rec?.exit || '--:--',
                  morningBreak: day.rec?.morningBreakStart ? `${day.rec.morningBreakStart}${day.rec.morningBreakEnd ? ` - ${day.rec.morningBreakEnd}` : ' (Ativa)'}` : '--:--',
                  afternoonBreak: day.rec?.afternoonBreakStart ? `${day.rec.afternoonBreakStart}${day.rec.afternoonBreakEnd ? ` - ${day.rec.afternoonBreakEnd}` : ' (Ativa)'}` : '--:--',
                  workedHours: day.stats.formattedWorked,
                  balance: day.stats.formattedBalance,
                  status: day.statusLabel,
                  statusType: day.statusType,
                  isHoliday: day.isHoliday,
                  holidayName: day.holidayName,
                  isCustomHoliday: !!customHolidays[day.dateStr],
                  justificationReason: day.rec?.justificationReason,
                  hasMedicalCertificate: day.rec?.hasMedicalCertificate,
                  medicalCertificateAttachment: day.rec?.medicalCertificateAttachment
                });
              }}
              className={`p-3 rounded-2xl border text-left transition-all hover:scale-105 flex flex-col justify-between h-20 relative group ${
                day.isHoliday
                  ? 'bg-purple-50/80 border-purple-200 text-purple-900 shadow-2xs hover:border-purple-400'
                  : day.isWeekend 
                    ? 'bg-slate-50/60 border-slate-100 text-slate-400' 
                    : 'bg-white border-slate-100 hover:border-[#00A1E4] hover:shadow-md'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className={`text-xs font-black ${day.isHoliday ? 'text-purple-900' : 'text-slate-800'}`}>
                  {day.dayNumber}
                </span>
                <span className={`w-2.5 h-2.5 rounded-full ${day.dotColor}`} />
              </div>

              <div className="mt-1">
                <p className={`text-[8px] font-bold uppercase truncate ${day.isHoliday ? 'text-purple-600' : 'text-slate-400'}`}>
                  {day.rec?.justificationReason ? '📄 Justificado' : day.statusLabel}
                </p>
                {day.rec?.entry && (
                  <p className="text-[9px] font-black text-slate-700">{day.rec.entry}</p>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* MODAL DE DETALHES DO DIA E GESTÃO DE FOLGAS / FERIADOS */}
      {selectedCalendarDay && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-fadeIn">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 overflow-hidden space-y-0">
            {/* Header */}
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-[#00A1E4]">
                  <Calendar size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black tracking-tight uppercase">
                    Detalhes do Dia {selectedCalendarDay.formattedDate}
                  </h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                    {selectedCalendarDay.dateStr}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedCalendarDay(null);
                  setShowAddHolidayForm(false);
                  setCustomHolidayInput('');
                }}
                className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
              {/* Status Badge */}
              <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <span className="text-xs font-black uppercase text-slate-500">Status no Calendário</span>
                <span className={`px-3 py-1 rounded-full text-xs font-black uppercase ${
                  selectedCalendarDay.isHoliday
                    ? 'bg-purple-100 text-purple-700 border border-purple-200'
                    : selectedCalendarDay.statusType === 'absence'
                      ? 'bg-red-100 text-red-700 border border-red-200'
                      : selectedCalendarDay.statusType === 'delay'
                        ? 'bg-amber-100 text-amber-700 border border-amber-200'
                        : selectedCalendarDay.statusType === 'overtime'
                          ? 'bg-blue-100 text-blue-700 border border-blue-200'
                          : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                }`}>
                  {selectedCalendarDay.status}
                </span>
              </div>

              {/* Holiday Details notice */}
              {selectedCalendarDay.isHoliday && (
                <div className="p-4 rounded-2xl bg-purple-50 border border-purple-100 flex items-start space-x-3 text-purple-900">
                  <Sparkles size={20} className="text-purple-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h5 className="text-xs font-black uppercase">Dia Sinalizado como Feriado / Folga</h5>
                    <p className="text-xs text-purple-700 font-medium">
                      {selectedCalendarDay.holidayName || 'Feriado cadastrado no sistema.'} Este dia é isento de faltas e não desconta do indicador de presença ou banco de horas.
                    </p>
                  </div>
                </div>
              )}

              {/* Punch Records Grid */}
              <div className="space-y-2">
                <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">Batidas de Ponto e Pausas Regulamentares</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-center">
                    <span className="text-[9px] font-black uppercase text-slate-400 block">Entrada</span>
                    <span className="text-sm font-black text-slate-800">{selectedCalendarDay.entry}</span>
                  </div>
                  <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200/60 text-center">
                    <span className="text-[9px] font-black uppercase text-amber-700 block">Pausa Manhã (5m)</span>
                    <span className="text-xs font-black text-amber-900">{selectedCalendarDay.morningBreak || '--:--'}</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-center">
                    <span className="text-[9px] font-black uppercase text-slate-400 block">Saída Almoço</span>
                    <span className="text-sm font-black text-slate-800">{selectedCalendarDay.lunchStart}</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-center">
                    <span className="text-[9px] font-black uppercase text-slate-400 block">Volta Almoço</span>
                    <span className="text-sm font-black text-slate-800">{selectedCalendarDay.lunchReturn}</span>
                  </div>
                  <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200/60 text-center">
                    <span className="text-[9px] font-black uppercase text-amber-700 block">Pausa Tarde (5m)</span>
                    <span className="text-xs font-black text-amber-900">{selectedCalendarDay.afternoonBreak || '--:--'}</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-center">
                    <span className="text-[9px] font-black uppercase text-slate-400 block">Saída</span>
                    <span className="text-sm font-black text-slate-800">{selectedCalendarDay.exit}</span>
                  </div>
                </div>
              </div>

              {/* Total & Balance */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <span className="text-[10px] font-black uppercase text-slate-400 block">Horas Trabalhadas</span>
                  <span className="text-lg font-black text-slate-900">{selectedCalendarDay.workedHours}</span>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <span className="text-[10px] font-black uppercase text-slate-400 block">Saldo do Dia</span>
                  <span className="text-lg font-black text-emerald-600">{selectedCalendarDay.balance}</span>
                </div>
              </div>

              {/* Exibição de Justificativa e Atestado Médico se existirem */}
              {(selectedCalendarDay.justificationReason || selectedCalendarDay.hasMedicalCertificate) && (
                <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200/80 space-y-3">
                  <div className="flex items-center space-x-2 text-amber-900">
                    <FileText size={18} className="text-amber-600 shrink-0" />
                    <h5 className="text-xs font-black uppercase tracking-wide">Justificativa e Atestado Registrados</h5>
                  </div>

                  {selectedCalendarDay.justificationReason && (
                    <div className="space-y-1">
                      <span className="text-[10px] font-black uppercase text-amber-700 block">Motivo Informado:</span>
                      <p className="text-xs font-bold text-slate-800 bg-white p-3 rounded-xl border border-amber-200/60 leading-relaxed">
                        "{selectedCalendarDay.justificationReason}"
                      </p>
                    </div>
                  )}

                  {selectedCalendarDay.hasMedicalCertificate && (
                    <div className="space-y-2 pt-2 border-t border-amber-200/60">
                      <div className="flex items-center justify-between text-xs font-black text-emerald-800">
                        <span>Atestado Médico: SIM</span>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px]">Anexo no Banco</span>
                      </div>
                      {selectedCalendarDay.medicalCertificateAttachment ? (
                        <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-emerald-200 shadow-2xs">
                          <div className="flex items-center space-x-2 truncate">
                            <FileCheck size={18} className="text-emerald-600 shrink-0" />
                            <div className="truncate">
                              <p className="text-xs font-bold text-slate-800 truncate">
                                {selectedCalendarDay.medicalCertificateAttachment.name}
                              </p>
                              {selectedCalendarDay.medicalCertificateAttachment.size && (
                                <p className="text-[10px] text-slate-400 font-medium">
                                  {selectedCalendarDay.medicalCertificateAttachment.size}
                                </p>
                              )}
                            </div>
                          </div>
                          <a
                            href={selectedCalendarDay.medicalCertificateAttachment.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-black uppercase transition-all shrink-0 flex items-center space-x-1"
                          >
                            <Download size={12} />
                            <span>Ver Atestado</span>
                          </a>
                        </div>
                      ) : (
                        <p className="text-xs text-amber-800 font-medium italic">
                          Atestado marcado como existente, porém nenhum arquivo foi anexado.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Gestão de Feriado/Folga Especial (Supervisor & Owner) */}
              {canManageHolidays && (
                <div className="pt-4 border-t border-slate-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-700">
                      Gestão de Folgas (Supervisor & Owner)
                    </span>
                  </div>

                  {customHolidays[selectedCalendarDay.dateStr] ? (
                    <div className="p-4 bg-purple-50 rounded-2xl border border-purple-200 flex flex-col space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-[10px] font-black text-purple-600 uppercase">Folga Customizada Cadastrada</span>
                          <p className="text-xs font-black text-purple-900 mt-0.5">
                            {customHolidays[selectedCalendarDay.dateStr]}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          handleRemoveCustomHoliday(selectedCalendarDay.dateStr);
                          setSelectedCalendarDay(null);
                        }}
                        className="w-full py-2.5 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-xs font-black uppercase transition-all shadow-sm flex items-center justify-center space-x-2"
                      >
                        <Trash2 size={14} />
                        <span>Remover Folga deste Dia</span>
                      </button>
                    </div>
                  ) : (
                    <div>
                      {!showAddHolidayForm ? (
                        <button
                          onClick={() => {
                            setShowAddHolidayForm(true);
                            setCustomHolidayInput('Feriado Municipal / Folga Concedida');
                          }}
                          className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl text-xs font-black uppercase transition-all shadow-md shadow-purple-500/20 flex items-center justify-center space-x-2"
                        >
                          <Plus size={16} />
                          <span>Adicionar Folga / Feriado Municipal Neste Dia</span>
                        </button>
                      ) : (
                        <div className="p-4 bg-purple-50 rounded-2xl border border-purple-200 space-y-3">
                          <label className="block text-xs font-black uppercase text-purple-900">
                            Descrição da Folga / Feriado:
                          </label>
                          <input
                            type="text"
                            value={customHolidayInput}
                            onChange={(e) => setCustomHolidayInput(e.target.value)}
                            placeholder="Ex: Feriado Municipal, Aniversário da Cidade, Folga Empresa"
                            className="w-full px-4 py-2.5 bg-white border border-purple-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-400"
                          />
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => {
                                handleSaveCustomHoliday(selectedCalendarDay.dateStr, customHolidayInput);
                                setSelectedCalendarDay(null);
                              }}
                              className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-black uppercase transition-all shadow-sm"
                            >
                              Salvar Folga
                            </button>
                            <button
                              onClick={() => setShowAddHolidayForm(false)}
                              className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-black uppercase transition-all"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 text-right">
              <button
                onClick={() => {
                  setSelectedCalendarDay(null);
                  setShowAddHolidayForm(false);
                }}
                className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black uppercase transition-all"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SEÇÃO DE GRÁFICOS INTERATIVOS (RECHARTS) */}
      <div className="bg-white p-6 sm:p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-[#00A1E4]/10 text-[#00A1E4] flex items-center justify-center">
              <Activity size={20} />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Gráficos de Acompanhamento</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Evolução do banco de horas e horas trabalhadas</p>
            </div>
          </div>

          <div className="flex items-center bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setActiveChartTab('daily')}
              className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${
                activeChartTab === 'daily' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Horas Diárias
            </button>
            <button
              onClick={() => setActiveChartTab('bank')}
              className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${
                activeChartTab === 'bank' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Evolução Banco
            </button>
            <button
              onClick={() => setActiveChartTab('compare')}
              className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${
                activeChartTab === 'compare' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Comparativo Mensal
            </button>
          </div>
        </div>

        {/* Exibição dos Gráficos */}
        <div className="h-72 w-full pt-4">
          <ResponsiveContainer width="100%" height="100%">
            {activeChartTab === 'daily' ? (
              <BarChart data={chartData30Days} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }} axisLine={false} tickLine={false} domain={[0, 12]} />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-slate-900 text-white p-3 rounded-xl text-xs space-y-1 shadow-xl">
                          <p className="font-black border-b border-white/10 pb-1">{data.day} - {data.status}</p>
                          <p>Horas Trabalhadas: <span className="font-black text-[#00A1E4]">{data.horas}h</span></p>
                          <p>Saldo do Dia: <span className="font-black text-emerald-400">{data.saldo >= 0 ? `+${data.saldo}` : data.saldo}h</span></p>
                          {data.atraso > 0 && <p className="text-amber-400">Atraso: {data.atraso} min</p>}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="horas" radius={[6, 6, 0, 0]}>
                  {chartData30Days.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.saldo > 0 ? '#00A1E4' : entry.atraso > 0 ? '#f59e0b' : '#10b981'} />
                  ))}
                </Bar>
              </BarChart>
            ) : activeChartTab === 'bank' ? (
              <AreaChart data={chartData30Days} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="bankGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }} axisLine={false} tickLine={false} />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-slate-900 text-white p-3 rounded-xl text-xs space-y-1 shadow-xl">
                          <p className="font-black border-b border-white/10 pb-1">{data.day}</p>
                          <p>Acumulado Banco: <span className="font-black text-emerald-400">+{data.bancoAcumulado}h</span></p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area type="monotone" dataKey="bancoAcumulado" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#bankGradient)" />
              </AreaChart>
            ) : (
              <BarChart data={comparisonData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="metric" tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }} axisLine={false} tickLine={false} />
                <Tooltip />
                <Bar dataKey="esteMes" name="Este Mês" fill="#00A1E4" radius={[6, 6, 0, 0]} />
                <Bar dataKey="mesPassado" name="Mês Passado" fill="#cbd5e1" radius={[6, 6, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* HISTÓRICO INTELIGENTE DE PONTOS (TABELA MELHORADA) */}
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-6 sm:px-8 py-5 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
           <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-[#00A1E4]/10 text-[#00A1E4] rounded-xl flex items-center justify-center">
                <Users size={20} />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">
                  {isPrivileged ? 'Gestão de Equipe e Histórico Inteligente' : 'Seu Histórico de Registros'}
                </h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                  Listagem completa com calculo automático do saldo
                </p>
              </div>
           </div>

           <div className="flex items-center space-x-2 w-full sm:w-auto">
              <span className="text-xs font-black text-slate-500 uppercase tracking-wider hidden sm:inline">Mês:</span>
              <div className="relative w-full sm:w-auto">
                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-[#00A1E4]" size={16} />
                <input 
                  type="month" 
                  value={historyMonth} 
                  onChange={(e) => setHistoryMonth(e.target.value)}
                  className="w-full sm:w-auto pl-12 pr-6 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-800 focus:outline-none focus:ring-4 focus:ring-slate-100 transition-all cursor-pointer" 
                />
              </div>
           </div>
        </div>

        {/* Responsive Table View */}
        <div className="overflow-x-auto">
           <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/60 border-b border-slate-100">
                   <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Colaborador</th>
                   <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Entrada</th>
                   <th className="px-3 py-4 text-[10px] font-black text-amber-600 uppercase tracking-widest text-center">Pausa M. (5m)</th>
                   <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Almoço (S)</th>
                   <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Almoço (V)</th>
                   <th className="px-3 py-4 text-[10px] font-black text-amber-600 uppercase tracking-widest text-center">Pausa T. (5m)</th>
                   <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Saída</th>
                   <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Horas Trabalhadas</th>
                   <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Saldo do Dia</th>
                   <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                   <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Atestado / Justificativa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={11} className="py-20 text-center">
                       <Loader2 className="animate-spin mx-auto text-[#00A1E4] mb-2" />
                       <p className="text-[10px] font-black uppercase text-slate-400">Sincronizando Histórico...</p>
                    </td>
                  </tr>
                ) : tableRecords.length > 0 ? tableRecords.map((rec) => {
                  const stats = calculateRecordStats(rec);
                  return (
                    <tr key={rec.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3">
                          <img 
                            src={rec.userAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(rec.userName)}&background=random`} 
                            className="w-9 h-9 rounded-xl object-cover border border-slate-200" 
                            alt=""
                            referrerPolicy="no-referrer"
                          />
                          <div>
                            <span className="text-xs font-black text-slate-800 uppercase tracking-tight block">{rec.userName}</span>
                            <span className="text-[9px] font-bold text-slate-400 uppercase">{formatBrazilianDateWithWeekday(rec.date)}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center text-xs font-bold text-slate-600">{rec.entry || '--:--'}</td>
                      <td className="px-3 py-4 text-center text-xs font-bold text-amber-700 bg-amber-50/20">
                        {rec.morningBreakStart ? `${rec.morningBreakStart}${rec.morningBreakEnd ? ` - ${rec.morningBreakEnd}` : ''}` : '--:--'}
                      </td>
                      <td className="px-4 py-4 text-center text-xs font-bold text-slate-600">{rec.lunchStart || '--:--'}</td>
                      <td className="px-4 py-4 text-center text-xs font-bold text-slate-600">{rec.lunchReturn || '--:--'}</td>
                      <td className="px-3 py-4 text-center text-xs font-bold text-amber-700 bg-amber-50/20">
                        {rec.afternoonBreakStart ? `${rec.afternoonBreakStart}${rec.afternoonBreakEnd ? ` - ${rec.afternoonBreakEnd}` : ''}` : '--:--'}
                      </td>
                      <td className="px-4 py-4 text-center text-xs font-bold text-slate-600">{rec.exit || '--:--'}</td>
                      <td className="px-4 py-4 text-center text-xs font-black text-slate-800">{stats.formattedWorked}</td>
                      <td className={`px-4 py-4 text-center text-xs font-black ${stats.balanceMins > 0 ? 'text-emerald-600' : stats.balanceMins < 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                        {stats.formattedBalance}
                      </td>
                      <td className="px-6 py-4 text-center">{getStatusBadge(rec.status, rec)}</td>
                      <td className="px-4 py-4 text-center">
                        {rec.justificationReason || rec.hasMedicalCertificate ? (
                          <button
                            type="button"
                            onClick={() => setSelectedRecordJustification(rec)}
                            className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-[10px] font-black uppercase transition-all flex items-center space-x-1.5 mx-auto shadow-2xs hover:scale-105 cursor-pointer"
                            title="Clique para ver o atestado médico ou justificativa"
                          >
                            <FileText size={13} className="text-amber-600" />
                            <span>{rec.hasMedicalCertificate ? 'Ver Atestado' : 'Ver Motivo'}</span>
                          </button>
                        ) : (
                          <span className="text-slate-300 text-xs">-</span>
                        )}
                      </td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={11} className="py-20 text-center">
                       <div className="flex flex-col items-center opacity-30">
                          <Clock size={44} className="mb-3 text-slate-400" />
                          <p className="text-xs font-black uppercase tracking-widest text-slate-500">Nenhum registro encontrado para este mês</p>
                       </div>
                    </td>
                  </tr>
                )}
              </tbody>
           </table>
        </div>
      </div>

      {/* MODAL OBRIGATÓRIO DE JUSTIFICATIVA DE FALTA / ATRASO */}
      {currentPendingDay && !isLoading && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-fadeIn">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 overflow-hidden relative">
            {/* Top Banner Accent */}
            <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 p-6 text-white">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0">
                  <AlertTriangle size={26} className="text-white" />
                </div>
                <div>
                  <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-[10px] font-black uppercase tracking-wider">
                    Atenção Obrigatória
                  </span>
                  <h3 className="text-lg font-black tracking-tight leading-snug mt-0.5">
                    Justificativa de Falta / Ponto Não Marcado
                  </h3>
                </div>
              </div>
            </div>

            {/* Form Body */}
            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              {/* Date Notice */}
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200/60 flex items-start space-x-3 text-amber-900">
                <AlertCircle size={20} className="text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs font-medium space-y-1">
                  <p className="font-black text-amber-950 uppercase">
                    Registro Pendente do Dia: <span className="text-[#00A1E4] text-sm font-black">{currentPendingDay.formattedDate}</span>
                  </p>
                  <p className="text-slate-600 leading-relaxed">
                    Identificamos ausência de marcação de ponto ou falta registrada nesta data. Informe o motivo do atraso/ausência e marque se possui atestado para salvar no banco de dados.
                  </p>
                </div>
              </div>

              {/* Success Banner if set */}
              {justificationSuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center space-x-2 animate-fadeIn">
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                  <span>{justificationSuccess}</span>
                </div>
              )}

              {/* Input 1: Motivo do atraso/falta */}
              <div className="space-y-1.5">
                <label className="block text-xs font-black uppercase text-slate-700 tracking-wider">
                  Motivo do Atraso ou Falta <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={justificationReasonInput}
                  onChange={(e) => setJustificationReasonInput(e.target.value)}
                  placeholder="Descreva detalhadamente o motivo (ex: consulta médica, imprevisto pessoal, problema de saúde, serviço externo...)"
                  className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#00A1E4] focus:bg-white transition-all placeholder:text-slate-400"
                />
              </div>

              {/* Input 2: Possui Atestado? (Sim / Não) */}
              <div className="space-y-2">
                <label className="block text-xs font-black uppercase text-slate-700 tracking-wider">
                  Tem Atestado Médico?
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setHasAtestadoInput(false);
                      setAtestadoAttachmentInput(null);
                    }}
                    className={`py-3 px-4 rounded-2xl border text-xs font-black uppercase transition-all flex items-center justify-center space-x-2 ${
                      !hasAtestadoInput
                        ? 'bg-slate-900 text-white border-slate-900 shadow-md'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span>Não</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setHasAtestadoInput(true)}
                    className={`py-3 px-4 rounded-2xl border text-xs font-black uppercase transition-all flex items-center justify-center space-x-2 ${
                      hasAtestadoInput
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/20'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Paperclip size={14} />
                    <span>Sim (Tem Atestado)</span>
                  </button>
                </div>
              </div>

              {/* Input 3: File Attachment (if Has Atestado is true) */}
              {hasAtestadoInput && (
                <div className="p-4 bg-emerald-50/60 rounded-2xl border border-emerald-200 space-y-3 animate-fadeIn">
                  <label className="block text-xs font-black uppercase text-emerald-900">
                    Anexar Foto ou Arquivo do Atestado <span className="text-red-500">*</span>
                  </label>

                  {atestadoAttachmentInput ? (
                    <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-emerald-300 shadow-2xs">
                      <div className="flex items-center space-x-3 truncate">
                        <FileCheck size={20} className="text-emerald-600 shrink-0" />
                        <div className="truncate">
                          <p className="text-xs font-black text-slate-800 truncate">{atestadoAttachmentInput.name}</p>
                          <p className="text-[10px] text-slate-400 font-bold">{atestadoAttachmentInput.size}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setAtestadoAttachmentInput(null)}
                        className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                        title="Remover anexo"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center p-5 bg-white border-2 border-dashed border-emerald-300 rounded-2xl cursor-pointer hover:border-emerald-500 hover:bg-emerald-50/30 transition-all group">
                      <Upload size={24} className="text-emerald-600 group-hover:scale-110 transition-transform mb-1" />
                      <span className="text-xs font-black text-slate-700">Clique para selecionar foto ou PDF</span>
                      <span className="text-[10px] font-bold text-slate-400 mt-0.5">JPG, PNG, PDF até 10MB</span>
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={handleAtestadoUpload}
                        className="hidden"
                      />
                    </label>
                  )}
                  {isUploadingAtestado && (
                    <div className="flex items-center justify-center space-x-2 text-xs font-bold text-emerald-700">
                      <Loader2 size={16} className="animate-spin" />
                      <span>Processando arquivo...</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center space-x-3">
              <button
                type="button"
                onClick={() => setDismissedJustificationDates(prev => [...prev, currentPendingDay.dateStr])}
                className="px-4 py-3 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-2xl text-xs font-black uppercase transition-all"
                title="Adiar preenchimento nesta sessão"
              >
                Responder Depois
              </button>

              <button
                type="button"
                onClick={handleSaveJustification}
                disabled={
                  isSubmittingJustification ||
                  !justificationReasonInput.trim() ||
                  (hasAtestadoInput && !atestadoAttachmentInput)
                }
                className="flex-1 py-3.5 bg-[#00A1E4] hover:bg-[#0081b8] text-white rounded-2xl text-xs font-black uppercase transition-all shadow-md shadow-[#00A1E4]/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                {isSubmittingJustification ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Salvando...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle size={16} />
                    <span>Salvar Justificativa</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE VISUALIZAÇÃO / DOWNLOAD DE ATESTADO E JUSTIFICATIVA */}
      {selectedRecordJustification && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-fadeIn">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 overflow-hidden relative">
            {/* Header */}
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <FileText size={22} />
                </div>
                <div>
                  <h3 className="text-base font-black tracking-tight uppercase">
                    Justificativa & Atestado Médico
                  </h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                    {selectedRecordJustification.userName} • {selectedRecordJustification.date}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedRecordJustification(null)}
                className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              {/* Motivo informado */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                  Motivo Informado pelo Colaborador
                </span>
                <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs font-bold text-slate-800 leading-relaxed">
                  "{selectedRecordJustification.justificationReason || 'Nenhum motivo fornecido.'}"
                </div>
              </div>

              {/* Status do Atestado */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                <span className="text-xs font-black uppercase text-slate-600">Possui Atestado Médico?</span>
                <span className={`px-3 py-1 rounded-full text-xs font-black uppercase ${
                  selectedRecordJustification.hasMedicalCertificate
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    : 'bg-slate-200 text-slate-600'
                }`}>
                  {selectedRecordJustification.hasMedicalCertificate ? 'Sim (Atestado Anexado)' : 'Não'}
                </span>
              </div>

              {/* Arquivo de Atestado Anexado */}
              {selectedRecordJustification.hasMedicalCertificate && selectedRecordJustification.medicalCertificateAttachment ? (
                <div className="space-y-3 p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl">
                  <div className="flex items-center space-x-3">
                    <FileCheck size={24} className="text-emerald-600 shrink-0" />
                    <div className="truncate">
                      <p className="text-xs font-black text-slate-800 truncate">
                        {selectedRecordJustification.medicalCertificateAttachment.name}
                      </p>
                      {selectedRecordJustification.medicalCertificateAttachment.size && (
                        <p className="text-[10px] font-bold text-slate-400">
                          {selectedRecordJustification.medicalCertificateAttachment.size}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Prévia da imagem se for imagem */}
                  {selectedRecordJustification.medicalCertificateAttachment.url && (
                    selectedRecordJustification.medicalCertificateAttachment.type === 'image' ||
                    selectedRecordJustification.medicalCertificateAttachment.url.startsWith('data:image/')
                  ) && (
                    <div className="mt-2 rounded-xl overflow-hidden border border-emerald-200 bg-white max-h-60 flex items-center justify-center p-2">
                      <img
                        src={selectedRecordJustification.medicalCertificateAttachment.url}
                        alt="Atestado Médico"
                        className="max-h-52 object-contain rounded-lg"
                      />
                    </div>
                  )}

                  {/* Botão para visualizar / baixar o atestado */}
                  <a
                    href={selectedRecordJustification.medicalCertificateAttachment.url}
                    download={selectedRecordJustification.medicalCertificateAttachment.name}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-emerald-600/20 flex items-center justify-center space-x-2 cursor-pointer"
                  >
                    <Download size={16} />
                    <span>Visualizar / Baixar Atestado Anexado</span>
                  </a>
                </div>
              ) : selectedRecordJustification.hasMedicalCertificate ? (
                <p className="text-xs text-amber-700 italic font-bold">
                  O colaborador informou ter atestado médico, porém nenhum arquivo foi anexado.
                </p>
              ) : null}
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 text-right">
              <button
                onClick={() => setSelectedRecordJustification(null)}
                className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black uppercase transition-all cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL INTELIGENTE DE BOAS-VINDAS E CONFIGURAÇÃO DE DATA DE INÍCIO */}
      {showFirstTimeWelcomeModal && (
        <div className="fixed inset-0 z-[170] flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 sm:p-6 animate-fadeIn">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden relative flex flex-col animate-in zoom-in-95 duration-300">
            {/* Header */}
            <div className="p-6 sm:p-8 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white flex items-center justify-between relative overflow-hidden">
              <div className="absolute right-0 top-0 translate-x-6 -translate-y-6 w-36 h-36 bg-[#00A1E4]/25 rounded-full blur-2xl pointer-events-none" />
              <div className="flex items-center space-x-4 relative z-10">
                <div className="w-14 h-14 rounded-2xl bg-[#00A1E4]/20 text-[#00A1E4] border border-[#00A1E4]/30 flex items-center justify-center shrink-0 shadow-lg shadow-[#00A1E4]/10">
                  <PartyPopper size={28} className="animate-bounce" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-[#00A1E4] px-2.5 py-0.5 rounded-full bg-[#00A1E4]/10 border border-[#00A1E4]/20">
                      Primeiro Acesso ao Ponto
                    </span>
                  </div>
                  <h3 className="text-xl font-black tracking-tight uppercase text-white mt-1">
                    Boas-vindas à VEC!
                  </h3>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="p-6 sm:p-8 space-y-6">
              <div className="space-y-2">
                <h4 className="text-sm font-black text-slate-800 uppercase tracking-wide flex items-center space-x-2">
                  <Sparkles size={16} className="text-[#00A1E4]" />
                  <span>Olá, {(user.name || (user.email?.toLowerCase().includes('yasmin') ? 'Yasmin Vitória' : 'Colaborador(a)')).split(' ')[0]}!</span>
                </h4>
                <p className="text-xs font-semibold text-slate-600 leading-relaxed">
                  Identificamos que este é o seu primeiro acesso ao ponto eletrônico. Para que seu calendário, banco de horas e frequência fiquem 100% corretos, informe a sua <strong>data de início na empresa</strong>:
                </p>
              </div>

              {/* Data selector */}
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  Qual foi o seu primeiro dia de trabalho na empresa?
                </label>
                <div className="relative">
                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-[#00A1E4]" size={18} />
                  <input
                    type="date"
                    value={firstTimeStartDate}
                    onChange={(e) => setFirstTimeStartDate(e.target.value)}
                    max={getLocalDateString(new Date())}
                    className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-[#00A1E4]/10 focus:border-[#00A1E4] transition-all cursor-pointer"
                  />
                </div>
                <p className="text-[10px] text-slate-400 font-semibold">
                  Exemplo: caso tenha começado hoje ou em dias anteriores desta semana/mês, selecione o dia exato.
                </p>
              </div>

              {/* Smart Zero retroactive penalty card */}
              <div className="p-4 rounded-2xl bg-sky-50/80 border border-sky-200 space-y-2">
                <div className="flex items-start space-x-2.5">
                  <ShieldCheck size={18} className="text-[#00A1E4] shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <span className="text-[11px] font-black text-sky-950 uppercase tracking-wide block">
                      Proteção Inteligente de Ponto VEC
                    </span>
                    <p className="text-[11px] font-medium text-sky-900 leading-snug">
                      Ao selecionar esta data, <strong>o ponto passa a contar exclusivamente a partir dela</strong>. O sistema não cobrará justificativas nem gerará avisos de falta de dias anteriores à sua chegada.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={handleConfirmFirstTimeStartDate}
                disabled={isSavingFirstTimeStartDate || !firstTimeStartDate}
                className="w-full py-4 bg-[#00A1E4] hover:bg-[#0081b8] text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all shadow-xl shadow-[#00A1E4]/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 cursor-pointer hover:scale-[1.01] active:scale-[0.99]"
              >
                {isSavingFirstTimeStartDate ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>Configurando seu Ponto...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={18} />
                    <span>Confirmar Data e Começar</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL RELATÓRIO MENSAL DP */}
      <MonthlyReportDpModal
        isOpen={isDpReportModalOpen}
        onClose={() => setIsDpReportModalOpen(false)}
        currentUser={user}
        allUsers={allUsers}
        records={records}
        customHolidays={customHolidays}
      />

      {/* MODAL DETALHAMENTO DE INDICADORES (BANCO DE HORAS, EXTRAS, ATRASOS, FALTAS, DIAS, PRESENÇA) */}
      {metricModalDetails && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 sm:p-6 animate-fadeIn">
          <div className="bg-white w-full max-w-3xl rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden relative max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="p-6 sm:p-8 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                  metricModalDetails.type === 'banco'
                    ? (metricModalDetails.isPositive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400')
                    : metricModalDetails.type === 'overtime'
                      ? 'bg-blue-500/20 text-blue-400'
                      : metricModalDetails.type === 'atrasos'
                        ? 'bg-amber-500/20 text-amber-400'
                        : metricModalDetails.type === 'faltas'
                          ? 'bg-rose-500/20 text-rose-400'
                          : 'bg-emerald-500/20 text-emerald-400'
                }`}>
                  {metricModalDetails.type === 'banco' && <BarChart3 size={24} />}
                  {metricModalDetails.type === 'overtime' && <Flame size={24} />}
                  {metricModalDetails.type === 'atrasos' && <Clock size={24} />}
                  {metricModalDetails.type === 'faltas' && <AlertCircle size={24} />}
                  {metricModalDetails.type === 'dias' && <CalendarDays size={24} />}
                  {metricModalDetails.type === 'presenca' && <Award size={24} />}
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-[#00A1E4]">
                      {metricModalDetails.monthName}
                    </span>
                    <span className="text-[10px] text-white/40">•</span>
                    <span className="text-[10px] font-bold text-white/60 uppercase">
                      {user.name}
                    </span>
                  </div>
                  <h3 className="text-xl font-black tracking-tight uppercase text-white mt-0.5">
                    {metricModalDetails.title}
                  </h3>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <div className="text-right hidden sm:block">
                  <span className="text-[9px] font-black uppercase tracking-widest text-white/50 block">Valor Atual</span>
                  <span className={`text-2xl font-black ${
                    metricModalDetails.type === 'banco'
                      ? (metricModalDetails.isPositive ? 'text-emerald-400' : 'text-rose-400')
                      : 'text-white'
                  }`}>
                    {metricModalDetails.currentValue}
                  </span>
                </div>
                <button
                  onClick={() => setActiveMetricModal(null)}
                  className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all cursor-pointer"
                >
                  <X size={22} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 sm:p-8 space-y-6 overflow-y-auto custom-scrollbar flex-1">
              {/* Summary Explanation Banner */}
              <div className={`p-5 rounded-2xl border ${
                metricModalDetails.type === 'banco'
                  ? (metricModalDetails.isPositive ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950' : 'bg-rose-50/80 border-rose-200 text-rose-950')
                  : 'bg-slate-50 border-slate-200 text-slate-900'
              }`}>
                <div className="flex items-start space-x-3">
                  <Info size={20} className="shrink-0 mt-0.5 text-[#00A1E4]" />
                  <div className="space-y-1">
                    <h4 className="text-xs font-black uppercase tracking-wide">Como funciona este cálculo?</h4>
                    <p className="text-xs font-medium leading-relaxed opacity-90">
                      {metricModalDetails.summaryText}
                    </p>
                  </div>
                </div>

                {/* KPI Extra summary for Banco de Horas */}
                {metricModalDetails.type === 'banco' && (
                  <div className="mt-4 pt-4 border-t border-slate-200/60 grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-white/80 p-3 rounded-xl border border-slate-100">
                      <span className="text-[9px] font-black uppercase text-slate-400 block">Total Débitos</span>
                      <span className="text-sm font-black text-rose-600">{metricModalDetails.negativeMinsText}</span>
                    </div>
                    <div className="bg-white/80 p-3 rounded-xl border border-slate-100">
                      <span className="text-[9px] font-black uppercase text-slate-400 block">Total Créditos</span>
                      <span className="text-sm font-black text-emerald-600">{metricModalDetails.positiveMinsText}</span>
                    </div>
                    <div className="bg-white/80 p-3 rounded-xl border border-slate-100">
                      <span className="text-[9px] font-black uppercase text-slate-400 block">Dias com Débito</span>
                      <span className="text-sm font-black text-slate-800">{metricModalDetails.negativeCount} dia(s)</span>
                    </div>
                    <div className="bg-white/80 p-3 rounded-xl border border-slate-100">
                      <span className="text-[9px] font-black uppercase text-slate-400 block">Dias com Crédito</span>
                      <span className="text-sm font-black text-slate-800">{metricModalDetails.positiveCount} dia(s)</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Day-by-Day Table / Breakdown List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center space-x-2">
                    <Calendar size={14} className="text-[#00A1E4]" />
                    <span>Registros Diários e Impacto ({metricModalDetails.items.length})</span>
                  </h4>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">
                    Jornada Padrão: 08:00–18:00 (9h/dia)
                  </span>
                </div>

                {metricModalDetails.items.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    <CheckCircle2 size={32} className="mx-auto text-emerald-500 mb-2" />
                    <p className="text-xs font-bold text-slate-600 uppercase">Nenhum evento registrado nesta categoria no mês.</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {metricModalDetails.items.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-4 bg-white rounded-2xl border border-slate-100 shadow-2xs hover:border-[#00A1E4]/30 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-black text-slate-900 uppercase">
                              {item.formattedDate}
                            </span>
                            {item.stats.statusBadge && (
                              <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                                {item.stats.statusBadge}
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-medium text-slate-600">
                            {item.reason}
                          </p>
                          <div className="flex items-center space-x-3 text-[10px] font-bold text-slate-400 pt-0.5">
                            <span>Entrada: {item.rec?.entry || '--:--'}</span>
                            <span>•</span>
                            <span>Almoço: {item.rec?.lunchStart || '--:--'} às {item.rec?.lunchReturn || '--:--'}</span>
                            <span>•</span>
                            <span>Saída: {item.rec?.exit || '--:--'}</span>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          {item.balMins !== undefined && (
                            <span className={`text-sm font-black ${
                              item.balMins > 0 ? 'text-emerald-600' : item.balMins < 0 ? 'text-rose-600' : 'text-slate-400'
                            }`}>
                              {formatMinutesToHours(item.balMins, true)}
                            </span>
                          )}
                          <span className="block text-[9px] font-bold text-slate-400 uppercase">
                            Trabalhado: {item.stats.formattedWorked}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
              <span className="text-[10px] font-bold text-slate-400 uppercase">
                Valores calculados em tempo real de acordo com as baterias de ponto salvas
              </span>
              <button
                onClick={() => setActiveMetricModal(null)}
                className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black uppercase transition-all cursor-pointer shadow-md"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TimeClock;
