import React, { useState, useMemo, useCallback } from 'react';
import { 
  Users, 
  CheckCircle2, 
  Clock, 
  Coffee, 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown,
  Award, 
  Activity, 
  FileText, 
  Download, 
  FileSpreadsheet, 
  Search, 
  X, 
  ChevronRight, 
  ChevronLeft,
  CalendarDays,
  Calendar,
  Edit3, 
  AlertCircle, 
  BarChart3, 
  ArrowUpRight, 
  ArrowDownRight, 
  Sparkles, 
  Printer, 
  Lock, 
  RefreshCw, 
  Upload,
  History,
  Paperclip,
  Loader2,
  Info,
  UserX,
  EyeOff,
  RotateCcw
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
  PieChart, 
  Pie, 
  Cell, 
  Legend 
} from 'recharts';
import { User, UserStatus, UserRole, PunchRecord, Attachment } from '../types';
import { supabase } from '../lib/supabase';
import { getUserStartDate, isDateBeforeUserAdmission } from '../lib/userDateUtils';
import { MonthlyReportDpModal } from './MonthlyReportDpModal';

export interface ResolvedAlert {
  id: string;
  alertId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  title: string;
  type: 'critical' | 'warning' | 'info';
  message: string;
  date: string;
  resolvedAt: string;
  resolvedBy: string;
  resolutionType: 'JUSTIFIED' | 'CORRECTED';
  justificationText?: string;
  hasCertificate?: boolean;
  attachmentName?: string;
  entry?: string;
  exit?: string;
}

interface ExecutiveDashboardProps {
  user: User;
  allUsers: User[];
  records: PunchRecord[];
  onRefreshData: () => Promise<void>;
  onUpdatePunch?: (record: PunchRecord) => Promise<void>;
  onBack: () => void;
}

export const ExecutiveTimeClockDashboard: React.FC<ExecutiveDashboardProps> = ({
  user,
  allUsers,
  records,
  onRefreshData,
  onUpdatePunch,
  onBack
}) => {
  const isSupervisor = (user.role || '').toUpperCase() === 'SUPERVISOR';
  const isOwner = (user.role || '').toUpperCase() === 'OWNER' || (user.role || '').toUpperCase() === 'ADMIN' || (user.role || '').toUpperCase() === 'ADMINISTRATIVO' || (user.role || '').toUpperCase() === 'ADMINISTRADOR';

  // --- FILTROS RÁPIDOS STATE ---
  const [empresaFilter, setEmpresaFilter] = useState<string>('Todas');
  const [filialFilter, setFilialFilter] = useState<string>('Todas');
  const [departamentoFilter, setDepartamentoFilter] = useState<string>('Todos');
  const [equipeFilter, setEquipeFilter] = useState<string>('Todas');
  const [supervisorFilter, setSupervisorFilter] = useState<string>('Todos');
  const [cargoFilter, setCargoFilter] = useState<string>('Todos');
  const [escalaFilter, setEscalaFilter] = useState<string>('Todas');
  const [statusFilter, setStatusFilter] = useState<string>('Todos');
  const [periodoFilter, setPeriodoFilter] = useState<string>('Mês Atual');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);

  // --- DRAWER DO COLABORADOR E CALENDÁRIO INTELIGENTE ---
  const [selectedEmployeeForDrawer, setSelectedEmployeeForDrawer] = useState<User | null>(null);
  const [drawerReportMonth, setDrawerReportMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<{
    dateStr: string;
    formattedDate: string;
    entry: string;
    lunchStart: string;
    lunchReturn: string;
    exit: string;
    workedHours: string;
    balance: string;
    status: string;
    statusType: 'normal' | 'delay' | 'overtime' | 'absence' | 'off' | 'incomplete' | 'upcoming';
    isHoliday?: boolean;
    holidayName?: string | null;
    justificationReason?: string;
    hasMedicalCertificate?: boolean;
    medicalCertificateAttachment?: Attachment;
  } | null>(null);

  // Custom holidays from localStorage
  const [customHolidays] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('vecgroup_custom_holidays');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  // --- CONTROLE DE USUÁRIOS EXCLUÍDOS / OCULTOS DO RELÓGIO DE PONTO ---
  const [excludedUserIds, setExcludedUserIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('vecgroup_timeclock_excluded_user_ids');
      const list: string[] = saved ? JSON.parse(saved) : [];
      // Garantir que Yasmin, Rafael Pasqual, Sabrina Sena e Maria Bonini nunca sejam excluídos por padrão ou cache antigo
      return list.filter(id => {
        const lower = id.toLowerCase();
        return !lower.includes('yasmin') && 
               !lower.includes('rafael') && 
               !lower.includes('pasqual') && 
               !lower.includes('sabrina') && 
               !lower.includes('sena') &&
               !lower.includes('bonini');
      });
    } catch {
      return [];
    }
  });
  const [isExcludedModalOpen, setIsExcludedModalOpen] = useState<boolean>(false);

  const excludedUsersList = useMemo(() => {
    return allUsers.filter(u => 
      excludedUserIds.includes(u.id) || (u.email && excludedUserIds.includes(u.email.toLowerCase()))
    );
  }, [allUsers, excludedUserIds]);

  const handleExcludeUserFromTimeClock = (targetUser: User) => {
    if (window.confirm(`Deseja remover ${targetUser.name} da lista do relógio de ponto? O colaborador não constará mais no monitoramento e nos relatórios de ponto.`)) {
      const updated = Array.from(new Set([...excludedUserIds, targetUser.id, targetUser.email.toLowerCase()]));
      setExcludedUserIds(updated);
      localStorage.setItem('vecgroup_timeclock_excluded_user_ids', JSON.stringify(updated));
      showToast(`${targetUser.name} foi removido(a) da lista do relógio de ponto.`);
      if (selectedEmployeeForDrawer?.id === targetUser.id) {
        setSelectedEmployeeForDrawer(null);
      }
    }
  };

  const handleRestoreUserToTimeClock = (idOrEmail: string, userName?: string) => {
    const updated = excludedUserIds.filter(id => id !== idOrEmail && id !== idOrEmail.toLowerCase());
    setExcludedUserIds(updated);
    localStorage.setItem('vecgroup_timeclock_excluded_user_ids', JSON.stringify(updated));
    showToast(`${userName || 'Colaborador'} foi restaurado(a) ao relógio de ponto.`);
  };

  const handleClearAllExcludedUsers = () => {
    if (window.confirm("Deseja restaurar todos os colaboradores removidos de volta ao relógio de ponto?")) {
      setExcludedUserIds([]);
      localStorage.removeItem('vecgroup_timeclock_excluded_user_ids');
      showToast("Todos os colaboradores foram restaurados ao relógio de ponto.");
      setIsExcludedModalOpen(false);
    }
  };

  // Calculate Easter Sunday for holiday detection
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

  const getBrazilianHoliday = (dateStr: string): string | null => {
    if (!dateStr) return null;
    const [y, m, d] = dateStr.split('-').map(Number);
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
    if (fixedHolidays[monthDay]) return fixedHolidays[monthDay];

    const easter = getEasterSunday(y);
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
    return variableHolidays[dateStr] || null;
  };

  const getHolidayInfo = (dateStr: string): string | null => {
    if (customHolidays[dateStr]) return customHolidays[dateStr];
    return getBrazilianHoliday(dateStr);
  };

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

  const calculateRecordStatsForDrawer = (rec?: PunchRecord, dateStr?: string) => {
    if (!rec && !dateStr) {
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

    const recDateStr = rec?.date || dateStr || '';
    const recDate = recDateStr ? new Date(recDateStr + 'T12:00:00') : new Date();
    const dayOfWeek = recDate.getDay();
    const isFriday = dayOfWeek === 5;
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    const expectedEntryMins = 480; // 08:00
    const expectedLunchStartMins = 720; // 12:00
    const expectedLunchReturnMins = 780; // 13:00
    const expectedExitMins = isFriday ? 1020 : 1080; // 17:00 / 18:00
    const expectedWorkMins = isWeekend ? 0 : isFriday ? 480 : 540;

    const entryMins = parseToMinutes(rec?.entry);
    const lunchStartMins = parseToMinutes(rec?.lunchStart);
    const lunchReturnMins = parseToMinutes(rec?.lunchReturn);
    let exitMins = parseToMinutes(rec?.exit);

    const now = new Date();
    const nowMins = now.getHours() * 60 + now.getMinutes();
    const todayDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const isPastDay = recDateStr < todayDateStr;
    const isToday = recDateStr === todayDateStr;

    // Ignore exit punch if it is in the future relative to current time on today
    if (isToday && exitMins !== null && exitMins > nowMins) {
      exitMins = null;
    }

    const applyTolerance = (mins: number | null, targetMins: number, tolerance: number = 15): number | null => {
      if (mins === null) return null;
      if (Math.abs(mins - targetMins) <= tolerance) return targetMins;
      return mins;
    };

    const effectiveEntryMins = applyTolerance(entryMins, expectedEntryMins);
    const effectiveLunchStartMins = applyTolerance(lunchStartMins, expectedLunchStartMins);
    const effectiveLunchReturnMins = applyTolerance(lunchReturnMins, expectedLunchReturnMins);
    const effectiveExitMins = applyTolerance(exitMins, expectedExitMins);

    const hasJustification = !!(rec?.justificationReason && rec.justificationReason.trim());
    const hasMedicalCert = !!rec?.hasMedicalCertificate;

    let delayMins = 0;
    if (entryMins !== null && entryMins > expectedEntryMins + 15) {
      delayMins = entryMins - expectedEntryMins;
    }

    let workedMins = 0;
    let isIncomplete = false;

    const isPunchesIncomplete = isPastDay && (
      (effectiveEntryMins !== null && exitMins === null) ||
      (effectiveLunchStartMins !== null && effectiveLunchReturnMins === null)
    );

    if (isPunchesIncomplete && !hasJustification && !hasMedicalCert) {
      isIncomplete = true;
    }

    if (hasMedicalCert) {
      workedMins = expectedWorkMins;
    } else {
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
        const now = new Date();
        const nowMins = now.getHours() * 60 + now.getMinutes();
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

    let rawBalanceMins = 0;
    if (hasMedicalCert) {
      rawBalanceMins = 0;
    } else if (isToday && !effectiveExitMins) {
      // Dia de hoje ainda em andamento: não gera débito das horas restantes do turno!
      rawBalanceMins = workedMins > expectedWorkMins ? (workedMins - expectedWorkMins) : 0;
    } else {
      rawBalanceMins = workedMins - expectedWorkMins;
      if (Math.abs(rawBalanceMins) <= 15) rawBalanceMins = 0;
    }

    const balanceMins = rawBalanceMins;
    const overtimeMins = balanceMins > 0 ? balanceMins : 0;

    let statusBadge = rec?.status || 'OK';
    let statusType: 'normal' | 'delay' | 'overtime' | 'absence' | 'off' | 'incomplete' | 'upcoming' = 'normal';

    if (hasMedicalCert) {
      statusBadge = 'Atestado';
      statusType = 'normal';
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
    } else if (rec?.status === 'Ausente' || workedMins === 0) {
      statusBadge = 'Falta';
      statusType = 'absence';
    } else if (rec?.entry) {
      statusBadge = 'Trabalhando';
      statusType = 'normal';
    }

    return {
      workedMins,
      balanceMins,
      delayMins,
      overtimeMins,
      isAbsence: rec?.status === 'Ausente',
      isIncomplete,
      formattedWorked: formatMinutesToHours(workedMins),
      formattedBalance: formatMinutesToHours(balanceMins, true),
      statusBadge,
      statusType
    };
  };

  const formattedDrawerMonth = useMemo(() => {
    const [y, m] = drawerReportMonth.split('-').map(Number);
    const dateObj = new Date(y, m - 1, 1);
    return dateObj.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase();
  }, [drawerReportMonth]);

  const handlePrevDrawerMonth = () => {
    const [y, m] = drawerReportMonth.split('-').map(Number);
    const prevDate = new Date(y, m - 2, 1);
    setDrawerReportMonth(`${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`);
  };

  const handleNextDrawerMonth = () => {
    const [y, m] = drawerReportMonth.split('-').map(Number);
    const nextDate = new Date(y, m, 1);
    setDrawerReportMonth(`${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`);
  };

  const drawerCalendarDays = useMemo(() => {
    if (!selectedEmployeeForDrawer) return { firstDayOfWeek: 0, days: [] };

    const [y, m] = drawerReportMonth.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const firstDayOfWeek = new Date(y, m - 1, 1).getDay();
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

      const rec = records.find(r => r.userId === selectedEmployeeForDrawer.id && r.date === dateStr);
      const stats = calculateRecordStatsForDrawer(rec, dateStr);

      let statusType: 'normal' | 'delay' | 'overtime' | 'absence' | 'off' | 'incomplete' | 'upcoming' = 'normal';
      let statusLabel = 'Dia Normal';
      let dotColor = 'bg-emerald-500';

      const isPastDay = isPastMonth || (isCurrentMonth && d < todayDay);
      const isToday = isCurrentMonth && d === todayDay;
      const isBeforeAdmission = isDateBeforeUserAdmission(dateStr, selectedEmployeeForDrawer, records);

      if (isBeforeAdmission) {
        statusType = 'off';
        statusLabel = 'Não cadastrado / Não admitido';
        dotColor = 'bg-slate-200';
      } else if (isHoliday) {
        statusType = 'off';
        statusLabel = `Feriado: ${holidayName}`;
        dotColor = 'bg-[#8B5CF6]';
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
  }, [selectedEmployeeForDrawer, drawerReportMonth, records, customHolidays]);

  // --- MODAIS DE AÇÃO E HISTÓRICO DE ALERTAS ---
  const [alertsTab, setAlertsTab] = useState<'active' | 'history'>('active');

  const [resolvedAlerts, setResolvedAlerts] = useState<ResolvedAlert[]>(() => {
    try {
      const saved = localStorage.getItem('vecgroup_resolved_alerts');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const [editPunchRecord, setEditPunchRecord] = useState<{
    user: User;
    date: string;
    alertId?: string;
    alertTitle?: string;
    record?: PunchRecord;
  } | null>(null);
  const [editDate, setEditDate] = useState<string>('');
  const [editEntry, setEditEntry] = useState<string>('08:00');
  const [editLunchStart, setEditLunchStart] = useState<string>('12:00');
  const [editLunchReturn, setEditLunchReturn] = useState<string>('13:00');
  const [editExit, setEditExit] = useState<string>('18:00');
  const [editJustificationReason, setEditJustificationReason] = useState<string>('');
  const [editPunchError, setEditPunchError] = useState<string | null>(null);
  const [isSavingEditPunch, setIsSavingEditPunch] = useState<boolean>(false);

  const [justificationModalRecord, setJustificationModalRecord] = useState<{
    user: User;
    date: string;
    alertId?: string;
    alertTitle?: string;
    record?: PunchRecord;
  } | null>(null);
  const [justificationDate, setJustificationDate] = useState<string>('');
  const [justificationText, setJustificationText] = useState<string>('');
  const [hasCertificate, setHasCertificate] = useState<boolean>(false);
  const [justificationAttachment, setJustificationAttachment] = useState<Attachment | null>(null);
  const [justificationModalError, setJustificationModalError] = useState<string | null>(null);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState<boolean>(false);
  const [isSavingJustification, setIsSavingJustification] = useState<boolean>(false);

  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [kpiDetailModal, setKpiDetailModal] = useState<'banco' | 'horas_extras' | 'registros' | 'atraso' | null>(null);
  const [selectedDashboardKpiModal, setSelectedDashboardKpiModal] = useState<'ativos' | 'presentes' | 'almoco' | 'ausentes' | 'atrasados' | 'extras' | 'banco' | null>(null);
  const [kpiModalSearch, setKpiModalSearch] = useState<string>('');

  // Period filter for charts
  const [chartPeriod, setChartPeriod] = useState<'Hoje' | 'Semana' | 'Mês' | 'Ano'>('Hoje');
  const [activeChartMetric, setActiveChartMetric] = useState<'banco' | 'extras' | 'atrasos' | 'presenca'>('banco');

  const showToast = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(null), 3500);
  };

  // Get current date string (YYYY-MM-DD)
  const todayStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  // Selected date for dashboard evaluation (allows inspecting any date/month)
  const [selectedDashboardDate, setSelectedDashboardDate] = useState<string>(todayStr);

  const handlePrevDashboardDay = () => {
    const [y, m, d] = selectedDashboardDate.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    dateObj.setDate(dateObj.getDate() - 1);
    setSelectedDashboardDate(`${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`);
  };

  const handleNextDashboardDay = () => {
    const [y, m, d] = selectedDashboardDate.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    dateObj.setDate(dateObj.getDate() + 1);
    setSelectedDashboardDate(`${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`);
  };

  const formattedSelectedDashboardDateLabel = useMemo(() => {
    const [y, m, d] = selectedDashboardDate.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    return dateObj.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
  }, [selectedDashboardDate]);

  const handleOpenEditModal = (targetUser: User, dateStr?: string, alertId?: string, alertTitle?: string) => {
    const d = dateStr || todayStr;
    const existingRec = records.find(r => isUserMatch(r, targetUser) && matchesDate(r.date, d));
    setEditPunchRecord({
      user: targetUser,
      date: d,
      alertId,
      alertTitle,
      record: existingRec
    });
    setEditDate(d);
    setEditEntry(existingRec?.entry || '');
    setEditLunchStart(existingRec?.lunchStart || '');
    setEditLunchReturn(existingRec?.lunchReturn || '');
    setEditExit(existingRec?.exit || '');
    setEditJustificationReason(existingRec?.justificationReason || '');
    setEditPunchError(null);
  };

  const handleDateChangeInEditModal = (newDate: string) => {
    setEditDate(newDate);
    setEditPunchError(null);
    if (editPunchRecord) {
      const existingRec = records.find(r => isUserMatch(r, editPunchRecord.user) && matchesDate(r.date, newDate));
      setEditEntry(existingRec?.entry || '');
      setEditLunchStart(existingRec?.lunchStart || '');
      setEditLunchReturn(existingRec?.lunchReturn || '');
      setEditExit(existingRec?.exit || '');
      setEditJustificationReason(existingRec?.justificationReason || '');
    }
  };

  const handleOpenJustificationModal = (targetUser: User, dateStr?: string, alertId?: string, alertTitle?: string) => {
    const d = dateStr || todayStr;
    const existingRec = records.find(r => isUserMatch(r, targetUser) && matchesDate(r.date, d));
    setJustificationModalRecord({
      user: targetUser,
      date: d,
      alertId,
      alertTitle,
      record: existingRec
    });
    setJustificationDate(d);
    setJustificationText(existingRec?.justificationReason || '');
    setHasCertificate(existingRec?.hasMedicalCertificate || false);
    setJustificationAttachment(existingRec?.medicalCertificateAttachment || null);
    setJustificationModalError(null);
  };

  const handleDateChangeInJustificationModal = (newDate: string) => {
    setJustificationDate(newDate);
    setJustificationModalError(null);
    if (justificationModalRecord) {
      const existingRec = records.find(r => isUserMatch(r, justificationModalRecord.user) && matchesDate(r.date, newDate));
      setJustificationText(existingRec?.justificationReason || '');
      setHasCertificate(existingRec?.hasMedicalCertificate || false);
      setJustificationAttachment(existingRec?.medicalCertificateAttachment || null);
    }
  };

  const handleModalAttachmentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setJustificationModalError("O arquivo do atestado é muito grande. O tamanho máximo permitido é 10MB.");
      return;
    }

    setJustificationModalError(null);
    setIsUploadingAttachment(true);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setJustificationAttachment({
        id: `att-${Date.now()}`,
        name: file.name,
        url: dataUrl,
        type: file.type.includes('image') ? 'image' : file.type.includes('pdf') ? 'pdf' : 'document',
        size: `${(file.size / 1024).toFixed(0)} KB`,
        createdAt: new Date().toISOString()
      });
      setIsUploadingAttachment(false);
    };
    reader.onerror = () => {
      setJustificationModalError("Erro ao processar o arquivo anexado.");
      setIsUploadingAttachment(false);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveEditPunch = async () => {
    if (!editPunchRecord || isSavingEditPunch) return;
    setEditPunchError(null);

    const targetUser = editPunchRecord.user;
    const targetDate = editDate || editPunchRecord.date || todayStr;

    // Se o usuário não preencheu motivo específico, utiliza motivo padrão amigável para não travar
    const effectiveJustification = editJustificationReason.trim() || 'Ajuste manual de marcação de ponto pelo gestor';

    // Validação estrita de horários futuros
    const now = new Date();
    const curTodayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const nowMins = now.getHours() * 60 + now.getMinutes();

    if (targetDate > curTodayStr) {
      setEditPunchError("Não é possível registrar ou alterar pontos para datas futuras.");
      return;
    }

    if (targetDate === curTodayStr) {
      const checkFuture = (val?: string, fieldName?: string) => {
        if (!val || !val.includes(':')) return null;
        const [h, m] = val.split(':').map(Number);
        if (isNaN(h) || isNaN(m)) return null;
        const totalMins = h * 60 + m;
        if (totalMins > nowMins) {
          const nowFormatted = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
          return `O horário de ${fieldName} (${val}) é superior ao horário atual de hoje (${nowFormatted}).`;
        }
        return null;
      };

      const errEntry = checkFuture(editEntry, 'Entrada');
      const errLunchStart = checkFuture(editLunchStart, 'Saída para Almoço');
      const errLunchReturn = checkFuture(editLunchReturn, 'Retorno do Almoço');
      const errExit = checkFuture(editExit, 'Saída Final');

      const firstErr = errEntry || errLunchStart || errLunchReturn || errExit;
      if (firstErr) {
        setEditPunchError(`Impossível registrar ponto no futuro! ${firstErr}`);
        return;
      }
    }

    setIsSavingEditPunch(true);
    try {
      const existing = records.find(r => isUserMatch(r, targetUser) && matchesDate(r.date, targetDate));

      let updatedStatus: PunchRecord['status'] = 'Presente';
      if (editExit) updatedStatus = 'Finalizado';
      else if (editLunchStart && !editLunchReturn) updatedStatus = 'Almoço';
      else if (editEntry) updatedStatus = 'Presente';
      else if (existing?.status) updatedStatus = existing.status;

      const updatedPunch: PunchRecord = {
        id: existing?.id || `p-${targetUser.id}-${targetDate}`,
        userId: targetUser.id,
        userName: targetUser.name,
        userAvatar: targetUser.avatar,
        date: targetDate,
        entry: editEntry || undefined,
        lunchStart: editLunchStart || undefined,
        lunchReturn: editLunchReturn || undefined,
        exit: editExit || undefined,
        status: updatedStatus,
        justificationReason: effectiveJustification,
        hasMedicalCertificate: existing?.hasMedicalCertificate,
        medicalCertificateAttachment: existing?.medicalCertificateAttachment
      };

      // 1. Salvar no backup local (localStorage)
      try {
        const stored = localStorage.getItem('vecgroup_punches_backup');
        const localList: PunchRecord[] = stored ? JSON.parse(stored) : [];
        const updatedLocal = [updatedPunch, ...localList.filter(r => !(r.userId === targetUser.id && r.date === targetDate))];
        localStorage.setItem('vecgroup_punches_backup', JSON.stringify(updatedLocal));
      } catch (e) {
        console.warn("Erro ao salvar no localStorage local:", e);
      }

      // 2. Salvar via callback ou Supabase
      try {
        if (onUpdatePunch) {
          await onUpdatePunch(updatedPunch);
        } else {
          await supabase.punches.upsert(updatedPunch);
        }
      } catch (err) {
        console.error("Erro ao salvar ponto no Supabase:", err);
      }

      // 3. Salvar alerta resolvido no histórico
      const alertIdToResolve = editPunchRecord.alertId || `edit-${targetUser.id}-${targetDate}`;
      const newResolved: ResolvedAlert = {
        id: `res-${Date.now()}`,
        alertId: alertIdToResolve,
        userId: targetUser.id,
        userName: targetUser.name,
        userAvatar: targetUser.avatar,
        title: editPunchRecord.alertTitle || 'Ponto Corrigido',
        type: 'info',
        message: `Horários atualizados: Entrada (${editEntry || '--:--'}), Saída (${editExit || '--:--'}). Motivo: ${effectiveJustification}`,
        date: targetDate,
        resolvedAt: new Date().toISOString(),
        resolvedBy: user.name,
        resolutionType: 'CORRECTED',
        entry: editEntry,
        exit: editExit,
        justificationText: effectiveJustification
      };

      const updatedHistory = [newResolved, ...resolvedAlerts.filter(r => r.alertId !== alertIdToResolve)];
      setResolvedAlerts(updatedHistory);
      localStorage.setItem('vecgroup_resolved_alerts', JSON.stringify(updatedHistory));

      await onRefreshData();
      setEditPunchRecord(null);
      showToast(`Marcação de ponto de ${targetUser.name} salva com sucesso!`);
    } catch (err) {
      console.error("Erro ao salvar alteração de ponto:", err);
      setEditPunchError("Ocorreu um erro ao salvar as alterações. Por favor, tente novamente.");
    } finally {
      setIsSavingEditPunch(false);
    }
  };

  const handleSaveJustificationModal = async () => {
    if (!justificationModalRecord || isSavingJustification) return;
    setJustificationModalError(null);

    if (!justificationText.trim()) {
      setJustificationModalError("Por favor, preencha o motivo da justificativa.");
      return;
    }
    if (hasCertificate && !justificationAttachment) {
      setJustificationModalError("Por favor, anexe a foto ou arquivo do atestado médico.");
      return;
    }

    setIsSavingJustification(true);
    try {
      const targetUser = justificationModalRecord.user;
      const targetDate = justificationDate || justificationModalRecord.date || todayStr;
      const existing = records.find(r => isUserMatch(r, targetUser) && matchesDate(r.date, targetDate));

      const updatedPunch: PunchRecord = {
        id: existing?.id || `p-${targetUser.id}-${targetDate}`,
        userId: targetUser.id,
        userName: targetUser.name,
        userAvatar: targetUser.avatar,
        date: targetDate,
        entry: existing?.entry,
        lunchStart: existing?.lunchStart,
        lunchReturn: existing?.lunchReturn,
        exit: existing?.exit,
        status: existing?.status || 'Justificado',
        justificationReason: justificationText.trim(),
        hasMedicalCertificate: hasCertificate,
        medicalCertificateAttachment: justificationAttachment || existing?.medicalCertificateAttachment
      };

      // 1. Salvar no backup local (localStorage)
      try {
        const stored = localStorage.getItem('vecgroup_punches_backup');
        const localList: PunchRecord[] = stored ? JSON.parse(stored) : [];
        const updatedLocal = [updatedPunch, ...localList.filter(r => !(r.userId === targetUser.id && r.date === targetDate))];
        localStorage.setItem('vecgroup_punches_backup', JSON.stringify(updatedLocal));
      } catch (e) {
        console.warn("Erro ao salvar no localStorage local:", e);
      }

      // 2. Salvar via callback ou Supabase
      try {
        if (onUpdatePunch) {
          await onUpdatePunch(updatedPunch);
        } else {
          await supabase.punches.upsert(updatedPunch);
        }
      } catch (err) {
        console.error("Erro ao salvar justificativa no Supabase:", err);
      }

      // 3. Salvar alerta resolvido no histórico
      const alertIdToResolve = justificationModalRecord.alertId || `just-${targetUser.id}-${targetDate}`;
      const newResolved: ResolvedAlert = {
        id: `res-${Date.now()}`,
        alertId: alertIdToResolve,
        userId: targetUser.id,
        userName: targetUser.name,
        userAvatar: targetUser.avatar,
        title: justificationModalRecord.alertTitle || 'Justificativa Registrada',
        type: 'warning',
        message: justificationText.trim(),
        date: targetDate,
        resolvedAt: new Date().toISOString(),
        resolvedBy: user.name,
        resolutionType: 'JUSTIFIED',
        justificationText: justificationText.trim(),
        hasCertificate: hasCertificate,
        attachmentName: justificationAttachment?.name
      };

      const updatedHistory = [newResolved, ...resolvedAlerts.filter(r => r.alertId !== alertIdToResolve)];
      setResolvedAlerts(updatedHistory);
      localStorage.setItem('vecgroup_resolved_alerts', JSON.stringify(updatedHistory));

      await onRefreshData();
      setJustificationModalRecord(null);
      setJustificationText('');
      setHasCertificate(false);
      setJustificationAttachment(null);
      showToast(`Justificativa de ${targetUser.name} registrada e alerta resolvido com sucesso!`);
    } catch (err) {
      console.error("Erro ao salvar justificativa:", err);
      setJustificationModalError("Ocorreu um erro ao salvar a justificativa. Por favor, tente novamente.");
    } finally {
      setIsSavingJustification(false);
    }
  };

  const handleApproveUserJustificationAlert = async (alertItem: {
    id: string;
    title: string;
    message: string;
    justificationReason?: string;
    hasCertificate?: boolean;
    attachment?: { name: string; url: string };
    user: User;
    date: string;
  }) => {
    const newResolved: ResolvedAlert = {
      id: `res-${Date.now()}`,
      alertId: alertItem.id,
      userId: alertItem.user.id,
      userName: alertItem.user.name,
      userAvatar: alertItem.user.avatar,
      title: alertItem.title,
      type: 'info',
      message: alertItem.justificationReason || alertItem.message,
      date: alertItem.date,
      resolvedAt: new Date().toISOString(),
      resolvedBy: user.name,
      resolutionType: 'JUSTIFIED',
      justificationText: alertItem.justificationReason || 'Aprovado pelo gestor',
      hasCertificate: alertItem.hasCertificate,
      attachmentName: alertItem.attachment?.name
    };

    const updatedHistory = [newResolved, ...resolvedAlerts.filter(r => r.alertId !== alertItem.id)];
    setResolvedAlerts(updatedHistory);
    localStorage.setItem('vecgroup_resolved_alerts', JSON.stringify(updatedHistory));
    showToast(`Justificativa de ${alertItem.user.name} aprovada com sucesso!`);
  };

  const handleDismissAlert = (alertId: string, alertUser: User, alertTitle: string, alertDate: string) => {
    const newResolved: ResolvedAlert = {
      id: `res-${Date.now()}`,
      alertId: alertId,
      userId: alertUser.id,
      userName: alertUser.name,
      userAvatar: alertUser.avatar,
      title: alertTitle,
      type: 'info',
      message: 'Alerta arquivado pelo gestor',
      date: alertDate,
      resolvedAt: new Date().toISOString(),
      resolvedBy: user.name,
      resolutionType: 'CORRECTED'
    };

    const updatedHistory = [newResolved, ...resolvedAlerts.filter(r => r.alertId !== alertId)];
    setResolvedAlerts(updatedHistory);
    localStorage.setItem('vecgroup_resolved_alerts', JSON.stringify(updatedHistory));
    showToast('Alerta arquivado com sucesso.');
  };

  // Helper functions to identify eligible active employees for the timeclock
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

  const normalizeName = (s?: string) => {
    return (s || '')
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  };

  const isUserMatch = (r: PunchRecord, targetUser: User) => {
    if (!r || !targetUser) return false;
    if (r.userId && targetUser.id && String(r.userId).trim() === String(targetUser.id).trim()) return true;
    if (r.userId && targetUser.id && String(r.userId).toLowerCase().trim() === String(targetUser.id).toLowerCase().trim()) return true;
    if (targetUser.email) {
      const userEmail = targetUser.email.toLowerCase().trim();
      if (r.userId && String(r.userId).toLowerCase().trim() === userEmail) return true;
      if ((r as any).userEmail && String((r as any).userEmail).toLowerCase().trim() === userEmail) return true;
    }
    if (r.userName && targetUser.name) {
      const rName = normalizeName(r.userName);
      const uName = normalizeName(targetUser.name);
      if (rName === uName && rName.length > 2) return true;

      // Unify Rafael Pasqual (e.g. WELERSON RAFAEL GOMES PASQUAL and RAFAEL PASQUAL)
      const rIsRafael = rName.includes('rafael') && rName.includes('pasqual');
      const uIsRafael = uName.includes('rafael') && uName.includes('pasqual');
      if (rIsRafael && uIsRafael) return true;

      // Unify Sabrina Sena
      const rIsSabrina = rName.includes('sabrina') && rName.includes('sena');
      const uIsSabrina = uName.includes('sabrina') && uName.includes('sena');
      if (rIsSabrina && uIsSabrina) return true;

      // Se r.userId existe e não bate com targetUser (ex: ID de outro usuário), não fazer match por substring
      if (r.userId && targetUser.id && String(r.userId).toLowerCase().trim() !== String(targetUser.id).toLowerCase().trim()) {
        return false;
      }

      // Evita colisão entre Maria ("maria") e Maria Bonini ("mariabonini" ou "maria bonini")
      const isMariaExact1 = rName === 'maria';
      const isMariaExact2 = uName === 'maria';
      const isBonini1 = rName.includes('bonini');
      const isBonini2 = uName.includes('bonini');
      if ((isMariaExact1 && isBonini2) || (isMariaExact2 && isBonini1)) {
        return false;
      }

      if (rName.length > 3 && uName.length > 3 && (rName.includes(uName) || uName.includes(rName))) {
        if (rName === 'maria' || uName === 'maria') return false;
        return true;
      }
    }
    return false;
  };

  const matchesDate = (d1?: string, d2?: string) => {
    if (!d1 || !d2) return false;
    const clean1 = String(d1).trim().split('T')[0];
    const clean2 = String(d2).trim().split('T')[0];
    return clean1 === clean2;
  };

  const isRafaelOrSabrina = (u: User) => {
    const normalize = (str?: string) => (str || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const nameNorm = normalize(u.name);
    const emailNorm = normalize(u.email);
    const isRafael = nameNorm.includes('rafael') && (nameNorm.includes('pasqual') || emailNorm.includes('rafael') || emailNorm.includes('pasqual'));
    const isSabrina = nameNorm.includes('sabrina') && (nameNorm.includes('sena') || emailNorm.includes('sabrina') || emailNorm.includes('sena'));
    return isRafael || isSabrina;
  };

  const isAdministratorUser = (u: User) => {
    const roleUpper = (u.role || '').toUpperCase();
    const roleLower = (u.role || '').toLowerCase();
    const deptLower = (u.department || '').toLowerCase();
    return (
      roleUpper === 'ADMIN' ||
      roleUpper === 'ADMINISTRATIVO' ||
      roleUpper === 'ADMINISTRADOR' ||
      roleLower.includes('admin') ||
      deptLower.includes('admin') ||
      deptLower.includes('diretoria')
    );
  };

  const isEligibleUser = (u: User) => {
    if (!u) return false;

    // Se for especificamente Rafael Pasqual ou Sabrina Sena, sempre incluir
    if (isRafaelOrSabrina(u)) return true;

    // Check if explicitly excluded from time clock list by manager
    if (excludedUserIds.includes(u.id) || (u.email && excludedUserIds.includes(u.email.toLowerCase()))) {
      return false;
    }

    // 1. Must be active (ignore inactive, pending, blocked)
    const statusStr = (u.status || '').toUpperCase();
    const isActive = !statusStr || statusStr === 'ATIVO' || statusStr === 'ACTIVE' || u.status === UserStatus.ACTIVE;
    if (!isActive) return false;

    // 2. Name, Email, Role or Dept must NOT contain "parceiro" or "parceira"
    if (isPartnerUser(u)) return false;

    // 3. Exclude external salespeople who do not clock in (e.g. erica@vecgroup.com.br)
    if (isExternalSalesperson(u)) return false;

    // 4. Perfil Administrador (Administrativo / Administrador) sempre elegível para o ponto
    if (isAdministratorUser(u)) return true;

    // 5. Exclude OWNER, SUPERVISOR, ADVOGADO explicitly from punch lists
    const roleUpper = (u.role || '').toUpperCase();
    if (roleUpper === 'OWNER' || roleUpper === 'SUPERVISOR' || roleUpper === 'ADVOGADO') return false;

    // 6. Allow all active internal team members, consultants, salespeople and administrators
    return true;
  };

  // Base eligible users (Active, non-partner, Vendedor/Consultor/Administrativo)
  const baseEligibleUsers = useMemo(() => {
    const userMap = new Map<string, User>();

    const getUserKey = (u: Partial<User>) => {
      if (u.id) return `id:${u.id}`;
      if (u.email) return `email:${u.email.toLowerCase().trim()}`;
      if (u.name) return `name:${u.name.toLowerCase().trim()}`;
      return '';
    };

    const isAlreadyPresent = (target: Partial<User>) => {
      const targetId = target.id;
      const targetEmail = target.email?.toLowerCase().trim();
      const targetNormName = normalizeName(target.name);
      const targetHasRafael = (targetNormName.includes('rafael') && targetNormName.includes('pasqual')) || (targetEmail && targetEmail.includes('rafael') && targetEmail.includes('pasqual'));
      const targetHasSabrina = (targetNormName.includes('sabrina') && targetNormName.includes('sena')) || (targetEmail && targetEmail.includes('sabrina') && targetEmail.includes('sena'));

      for (const existing of userMap.values()) {
        if (targetId && existing.id && targetId === existing.id) return true;
        if (targetEmail && existing.email && targetEmail === existing.email.toLowerCase().trim()) return true;

        const existNorm = normalizeName(existing.name);
        const existEmail = (existing.email || '').toLowerCase().trim();

        // Se ambos têm emails cadastrados e são diferentes, são colaboradores distintos!
        if (targetEmail && existEmail && targetEmail !== existEmail) {
          if (targetHasRafael && (
            (existNorm.includes('rafael') && existNorm.includes('pasqual')) ||
            (existEmail.includes('rafael') && existEmail.includes('pasqual'))
          )) {
            return true;
          }
          if (targetHasSabrina && (
            (existNorm.includes('sabrina') && existNorm.includes('sena')) ||
            (existEmail.includes('sabrina') && existEmail.includes('sena'))
          )) {
            return true;
          }
          continue;
        }

        // Se ambos têm IDs cadastrados e são diferentes, não deduplicar
        if (targetId && existing.id && targetId !== existing.id) {
          if (targetHasRafael && (
            (existNorm.includes('rafael') && existNorm.includes('pasqual')) ||
            (existEmail.includes('rafael') && existEmail.includes('pasqual'))
          )) {
            return true;
          }
          if (targetHasSabrina && (
            (existNorm.includes('sabrina') && existNorm.includes('sena')) ||
            (existEmail.includes('sabrina') && existEmail.includes('sena'))
          )) {
            return true;
          }
          continue;
        }

        // Check if both are Rafael Pasqual (e.g. WELERSON RAFAEL GOMES PASQUAL vs RAFAEL PASQUAL)
        if (targetHasRafael && (
          (existNorm.includes('rafael') && existNorm.includes('pasqual')) ||
          (existEmail.includes('rafael') && existEmail.includes('pasqual'))
        )) {
          return true;
        }

        // Check if both are Sabrina Sena
        if (targetHasSabrina && (
          (existNorm.includes('sabrina') && existNorm.includes('sena')) ||
          (existEmail.includes('sabrina') && existEmail.includes('sena'))
        )) {
          return true;
        }

        // Evita colisão entre Maria e Maria Bonini
        const isMariaExact1 = existNorm === 'maria';
        const isMariaExact2 = targetNormName === 'maria';
        const isBonini1 = existNorm.includes('bonini');
        const isBonini2 = targetNormName.includes('bonini');
        if ((isMariaExact1 && isBonini2) || (isMariaExact2 && isBonini1)) {
          continue;
        }

        if (targetNormName && existing.name) {
          if (existNorm === targetNormName) return true;
        }
      }
      return false;
    };

    // 1. Add all users from props
    (allUsers || []).forEach(u => {
      if (u && isEligibleUser(u) && !isAlreadyPresent(u)) {
        const key = getUserKey(u) || `user-${userMap.size}`;
        userMap.set(key, u);
      }
    });

    // 2. Discover any additional users who have records in time records (only if not already in userMap)
    (records || []).forEach(r => {
      if (r.userId || r.userName) {
        const matchedFromAll = (allUsers || []).find(u => isUserMatch(r, u));
        if (matchedFromAll && isEligibleUser(matchedFromAll) && !isAlreadyPresent(matchedFromAll)) {
          const key = getUserKey(matchedFromAll) || `user-${userMap.size}`;
          userMap.set(key, matchedFromAll);
        }
      }
    });

    // 3. Garantir que a consultora Yasmin Vitória esteja sempre presente
    const yasminEmail = 'yasminvitoria@vecgroup.com.br';
    const hasYasmin = isAlreadyPresent({ email: yasminEmail, name: 'YASMIN VITÓRIA' });

    if (!hasYasmin) {
      const yasminUser: User = {
        id: 'yasminvitoria-user-id',
        name: 'YASMIN VITÓRIA',
        email: yasminEmail,
        role: UserRole.VENDEDOR,
        status: UserStatus.ACTIVE,
        department: 'GERAL',
        avatar: 'https://i.imgur.com/m4WqE5P.png'
      };
      if (isEligibleUser(yasminUser)) {
        userMap.set(`email:${yasminEmail}`, yasminUser);
      }
    }

    // 4. Garantir que Rafael Pasqual e Sabrina Sena estejam presentes (apenas se nenhum colaborador correspondente existir)
    const hasRafael = isAlreadyPresent({ name: 'RAFAEL PASQUAL', email: 'rafael@vecgroup.com.br' });
    if (!hasRafael) {
      const rafaelUser: User = {
        id: 'rafael-pasqual-user-id',
        name: 'RAFAEL PASQUAL',
        email: 'rafael@vecgroup.com.br',
        role: UserRole.ADMIN_ALT,
        status: UserStatus.ACTIVE,
        department: 'Administrativo',
        avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150'
      };
      userMap.set('email:rafael@vecgroup.com.br', rafaelUser);
    }

    const hasSabrina = isAlreadyPresent({ name: 'SABRINA SENA', email: 'sabrina@vecgroup.com.br' });
    if (!hasSabrina) {
      const sabrinaUser: User = {
        id: 'sabrina-sena-user-id',
        name: 'SABRINA SENA',
        email: 'sabrina@vecgroup.com.br',
        role: UserRole.ADMIN_ALT,
        status: UserStatus.ACTIVE,
        department: 'Administrativo',
        avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150'
      };
      userMap.set('email:sabrina@vecgroup.com.br', sabrinaUser);
    }

    // Deduplicação final: se houver o colaborador real com registros (ex: Welerson Rafael Gomes Pasqual),
    // remove qualquer usuário placeholder temporário (ex: 'rafael-pasqual-user-id')
    const rawList = Array.from(userMap.values());
    const hasRealRafael = rawList.some(u => 
      u.id !== 'rafael-pasqual-user-id' && 
      (normalizeName(u.name).includes('rafael') && normalizeName(u.name).includes('pasqual'))
    );
    const listWithoutDupRafael = hasRealRafael ? rawList.filter(u => u.id !== 'rafael-pasqual-user-id') : rawList;

    const hasRealSabrina = listWithoutDupRafael.some(u => 
      u.id !== 'sabrina-sena-user-id' && 
      (normalizeName(u.name).includes('sabrina') && normalizeName(u.name).includes('sena'))
    );
    const finalCleanList = hasRealSabrina ? listWithoutDupRafael.filter(u => u.id !== 'sabrina-sena-user-id') : listWithoutDupRafael;

    return finalCleanList;
  }, [allUsers, records, excludedUserIds]);

  // Filtered users applying UI search and dropdown filters
  const filteredUsers = useMemo(() => {
    return baseEligibleUsers.filter(u => {
      // Supervisor department restriction
      if (isSupervisor && user.department && u.department) {
        const supDept = user.department.toLowerCase().trim();
        const empDept = u.department.toLowerCase().trim();
        const isSupervisorDept = supDept.includes('supervis') || supDept.includes('geral') || supDept.includes('vendas') || supDept.includes('comercial');
        const isSalesDept = empDept.includes('vendas') || empDept.includes('comercial') || empDept.includes('vendedor') || empDept.includes('geral');
        
        if (supDept !== empDept && !(isSupervisorDept && isSalesDept)) {
          return false;
        }
      }

      // Search term
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchesName = u.name.toLowerCase().includes(term);
        const matchesEmail = u.email.toLowerCase().includes(term);
        if (!matchesName && !matchesEmail) return false;
      }

      // Department & Role filters
      if (departamentoFilter !== 'Todos' && u.department && u.department !== departamentoFilter) return false;
      if (cargoFilter !== 'Todos' && u.role && u.role !== cargoFilter) return false;

      return true;
    });
  }, [baseEligibleUsers, isSupervisor, user.department, searchTerm, departamentoFilter, cargoFilter]);

  const departamentosOptions = useMemo(() => {
    const set = new Set<string>();
    baseEligibleUsers.forEach(u => { if (u.department) set.add(u.department); });
    return ['Todos', ...Array.from(set)];
  }, [baseEligibleUsers]);

  const cargosOptions = useMemo(() => {
    const set = new Set<string>();
    baseEligibleUsers.forEach(u => { if (u.role) set.add(u.role); });
    return ['Todos', ...Array.from(set)];
  }, [baseEligibleUsers]);

  // Helper for available distinct months in records for explicit filtering
  const availableMonths = useMemo(() => {
    const monthsSet = new Set<string>();
    const now = new Date();
    const curMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    monthsSet.add(curMonthStr);

    records.forEach(r => {
      if (r.date && r.date.length >= 7) {
        monthsSet.add(r.date.substring(0, 7));
      }
    });

    return Array.from(monthsSet).sort().reverse();
  }, [records]);

  // Helper to format Month/Year in Portuguese (e.g. "Agosto/2026")
  const formatMonthLabel = (yearMonthStr: string) => {
    if (!yearMonthStr || !yearMonthStr.includes('-')) return yearMonthStr;
    const [y, m] = yearMonthStr.split('-').map(Number);
    const dateObj = new Date(y, m - 1, 1);
    const mName = dateObj.toLocaleDateString('pt-BR', { month: 'long' });
    return `${mName.charAt(0).toUpperCase() + mName.slice(1)}/${y}`;
  };

  // Helper to test if a record date matches the selected period
  const isDateInPeriod = useCallback((dateStr?: string) => {
    if (!dateStr) return false;
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth() + 1;
    const curMonthStr = `${curYear}-${String(curMonth).padStart(2, '0')}`;

    if (periodoFilter === 'Mês Atual' || periodoFilter === 'Mês' || !periodoFilter) {
      return dateStr.startsWith(curMonthStr);
    }

    if (periodoFilter === 'Hoje') {
      return dateStr === todayStr;
    }

    if (periodoFilter === 'Esta Semana') {
      const dayOfWeek = now.getDay();
      const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(now);
      monday.setDate(now.getDate() + diffToMonday);
      monday.setHours(0, 0, 0, 0);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);

      const d = new Date(dateStr + 'T12:00:00');
      return d >= monday && d <= sunday;
    }

    if (periodoFilter === 'Últimos 2 Meses') {
      const past = new Date(curYear, curMonth - 2, 1);
      const pastStr = `${past.getFullYear()}-${String(past.getMonth() + 1).padStart(2, '0')}-01`;
      return dateStr >= pastStr && dateStr.substring(0, 7) <= curMonthStr;
    }

    if (periodoFilter === 'Últimos 3 Meses') {
      const past = new Date(curYear, curMonth - 3, 1);
      const pastStr = `${past.getFullYear()}-${String(past.getMonth() + 1).padStart(2, '0')}-01`;
      return dateStr >= pastStr && dateStr.substring(0, 7) <= curMonthStr;
    }

    if (periodoFilter === 'Últimos 4 Meses') {
      const past = new Date(curYear, curMonth - 4, 1);
      const pastStr = `${past.getFullYear()}-${String(past.getMonth() + 1).padStart(2, '0')}-01`;
      return dateStr >= pastStr && dateStr.substring(0, 7) <= curMonthStr;
    }

    if (periodoFilter === 'Últimos 6 Meses') {
      const past = new Date(curYear, curMonth - 6, 1);
      const pastStr = `${past.getFullYear()}-${String(past.getMonth() + 1).padStart(2, '0')}-01`;
      return dateStr >= pastStr && dateStr.substring(0, 7) <= curMonthStr;
    }

    if (periodoFilter === 'Últimos 12 Meses' || periodoFilter === 'Ano') {
      const past = new Date(curYear, curMonth - 12, 1);
      const pastStr = `${past.getFullYear()}-${String(past.getMonth() + 1).padStart(2, '0')}-01`;
      return dateStr >= pastStr && dateStr.substring(0, 7) <= curMonthStr;
    }

    if (periodoFilter.startsWith('month:')) {
      const targetMonth = periodoFilter.replace('month:', '');
      return dateStr.startsWith(targetMonth);
    }

    if (periodoFilter === 'Todo o Histórico') {
      return true;
    }

    return dateStr.startsWith(curMonthStr);
  }, [periodoFilter, todayStr]);

  // Map today's real punch status for each active employee
  const userStatusMap = useMemo(() => {
    const map = new Map<string, {
      record?: PunchRecord;
      status: 'Trabalhando' | 'Em Almoço' | 'Em Pausa (5m)' | 'Atrasado' | 'Ausente' | 'Folga' | 'Finalizado';
      entry: string;
      workedTime: string;
      delayMins: number;
      bankMins: number;
      overtimeMins: number;
    }>();

    // Helper: calculate total bank minutes for a user for selected period (defaults to current month)
    const calculateUserBankMins = (targetUser: User) => {
      const userRecs = records.filter(r => isUserMatch(r, targetUser) && r.date && isDateInPeriod(r.date));
      if (userRecs.length === 0) return 0;

      return userRecs.reduce((sum, r) => {
        return sum + calculateRecordStatsForDrawer(r, r.date).balanceMins;
      }, 0);
    };

    const targetDate = selectedDashboardDate || todayStr;

    filteredUsers.forEach((u) => {
      const rec = records.find(r => isUserMatch(r, u) && matchesDate(r.date, targetDate));
      const bankMins = calculateUserBankMins(u);

      if (rec) {
        const now = new Date();
        const nowMins = (now.getHours() * 60) + now.getMinutes();

        let effectiveExit = rec.exit;
        if (targetDate === todayStr && effectiveExit) {
          const [xH, xM] = effectiveExit.split(':').map(Number);
          if (!isNaN(xH) && !isNaN(xM) && (xH * 60 + xM) > nowMins) {
            effectiveExit = undefined;
          }
        }

        let st: 'Trabalhando' | 'Em Almoço' | 'Em Pausa (5m)' | 'Atrasado' | 'Ausente' | 'Folga' | 'Finalizado' = 'Trabalhando';
        if (effectiveExit) st = 'Finalizado';
        else if (rec.lunchStart && !rec.lunchReturn) st = 'Em Almoço';
        else if ((rec.morningBreakStart && !rec.morningBreakEnd) || (rec.afternoonBreakStart && !rec.afternoonBreakEnd)) st = 'Em Pausa (5m)';
        else if (rec.status === 'Ausente') st = 'Ausente';
        else if (rec.entry) {
          const [eH, eM] = rec.entry.split(':').map(Number);
          const entryMins = eH * 60 + eM;
          if (entryMins > 8 * 60 + 15) st = 'Atrasado';
        }

        let delayMins = 0;
        if (rec.entry) {
          const [eH, eM] = rec.entry.split(':').map(Number);
          const entryMins = eH * 60 + eM;
          if (entryMins > 8 * 60 + 15) delayMins = entryMins - (8 * 60);
        }

        let workedMins = 0;
        if (rec.entry) {
          const [eH, eM] = rec.entry.split(':').map(Number);
          let endMins = 18 * 60;
          if (effectiveExit) {
            const [xH, xM] = effectiveExit.split(':').map(Number);
            endMins = xH * 60 + (isNaN(xM) ? 0 : xM);
          } else if (targetDate === todayStr) {
            endMins = Math.min(nowMins, 18 * 60);
          }
          workedMins = Math.max(0, endMins - (eH * 60 + eM));
        }

        const workedH = Math.floor(workedMins / 60);
        const workedM = workedMins % 60;
        const workedTimeStr = `${String(workedH).padStart(2, '0')}h ${String(workedM).padStart(2, '0')}m`;
        const overtimeMins = Math.max(0, workedMins - 480);

        map.set(u.id, {
          record: rec,
          status: st,
          entry: rec.entry || '--:--',
          workedTime: workedTimeStr,
          delayMins,
          bankMins,
          overtimeMins
        });
      } else {
        map.set(u.id, {
          status: 'Ausente',
          entry: '--:--',
          workedTime: '00h 00m',
          delayMins: 0,
          bankMins,
          overtimeMins: 0
        });
      }
    });

    return map;
  }, [filteredUsers, records, selectedDashboardDate, todayStr]);

  // Apply status filter to list
  const displayedUsers = useMemo(() => {
    if (statusFilter === 'Todos') return filteredUsers;
    return filteredUsers.filter(u => {
      const st = userStatusMap.get(u.id)?.status;
      return st?.toLowerCase() === statusFilter.toLowerCase();
    });
  }, [filteredUsers, statusFilter, userStatusMap]);

  // --- KPI CALCULATIONS ---
  const kpiData = useMemo(() => {
    let totalAtivos = filteredUsers.length;
    let presentes = 0;
    let emAlmoco = 0;
    let ausentes = 0;
    let atrasados = 0;
    let totalOvertimeMins = 0;
    let totalBankMins = 0;

    userStatusMap.forEach(st => {
      if (st.status === 'Trabalhando' || st.status === 'Finalizado') presentes++;
      else if (st.status === 'Em Almoço') emAlmoco++;
      else if (st.status === 'Ausente') ausentes++;
      else if (st.status === 'Atrasado') {
        presentes++;
        atrasados++;
      }

      totalOvertimeMins += st.overtimeMins;
      totalBankMins += st.bankMins;
    });

    const formatMins = (mins: number) => {
      const sign = mins >= 0 ? '+' : '-';
      const abs = Math.abs(mins);
      const h = Math.floor(abs / 60);
      const m = Math.round(abs % 60);
      return `${sign}${h}h ${m < 10 ? '0' : ''}${m}m`;
    };

    return {
      totalAtivos,
      presentes,
      emAlmoco,
      ausentes,
      atrasados,
      horasExtrasHoje: `${(totalOvertimeMins / 60).toFixed(1)}h`,
      bancoHorasGeral: formatMins(totalBankMins)
    };
  }, [filteredUsers, userStatusMap]);

  // --- DRILL-DOWN RELATION DATA FOR TOP KPIS ---
  const dashboardKpiRelationData = useMemo(() => {
    if (!selectedDashboardKpiModal) return null;

    const targetDate = selectedDashboardDate || todayStr;
    const isSelectedDateToday = targetDate === todayStr;

    const formatBank = (mins: number) => {
      const sign = mins > 0 ? '+' : mins < 0 ? '-' : '';
      const abs = Math.abs(mins);
      const h = Math.floor(abs / 60);
      const m = Math.round(abs % 60);
      return `${sign}${h}h ${m < 10 ? '0' : ''}${m}m`;
    };

    let items: Array<{
      user: User;
      status: string;
      statusColor: string;
      entryTime: string;
      exitTime: string;
      lunchSpan: string;
      workedTime: string;
      delayMins: number;
      overtimeMins: number;
      bankMins: number;
      bankFormatted: string;
      highlightLabel: string;
      highlightValue: string;
      highlightColor: string;
      secondaryInfo: string;
      record?: PunchRecord;
    }> = [];

    filteredUsers.forEach(u => {
      const stObj = userStatusMap.get(u.id);
      const rec = stObj?.record;
      const status = stObj?.status || 'Ausente';
      const entryTime = rec?.entry || '--:--';
      const exitTime = rec?.exit || '--:--';
      const lunchSpan = (rec?.lunchStart ? `${rec.lunchStart}${rec.lunchReturn ? ' às ' + rec.lunchReturn : ' (em andamento)'}` : '--:--');
      const workedTime = stObj?.workedTime || '00h 00m';
      const delayMins = stObj?.delayMins || 0;
      const overtimeMins = stObj?.overtimeMins || 0;
      const bankMins = stObj?.bankMins || 0;
      const bankFormatted = formatBank(bankMins);

      let statusColor = 'bg-slate-100 text-slate-700 border-slate-200';
      if (status === 'Trabalhando') statusColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
      else if (status === 'Em Almoço') statusColor = 'bg-amber-50 text-amber-700 border-amber-200';
      else if (status === 'Atrasado') statusColor = 'bg-orange-50 text-orange-700 border-orange-200';
      else if (status === 'Ausente') statusColor = 'bg-rose-50 text-rose-700 border-rose-200';
      else if (status === 'Finalizado') statusColor = 'bg-blue-50 text-blue-700 border-blue-200';

      if (selectedDashboardKpiModal === 'ativos') {
        items.push({
          user: u,
          status,
          statusColor,
          entryTime,
          exitTime,
          lunchSpan,
          workedTime,
          delayMins,
          overtimeMins,
          bankMins,
          bankFormatted,
          highlightLabel: 'Status de Hoje',
          highlightValue: status,
          highlightColor: statusColor,
          secondaryInfo: `Entrada: ${entryTime} • Jornada: ${workedTime} • Banco: ${bankFormatted}`,
          record: rec
        });
      } else if (selectedDashboardKpiModal === 'presentes') {
        if (status === 'Trabalhando' || status === 'Atrasado' || status === 'Finalizado' || (rec && rec.entry)) {
          items.push({
            user: u,
            status,
            statusColor,
            entryTime,
            exitTime,
            lunchSpan,
            workedTime,
            delayMins,
            overtimeMins,
            bankMins,
            bankFormatted,
            highlightLabel: 'Horário de Entrada',
            highlightValue: entryTime,
            highlightColor: 'text-emerald-700 font-black',
            secondaryInfo: `Status: ${status} • Almoço: ${lunchSpan} • Saída: ${exitTime} • Total: ${workedTime}`,
            record: rec
          });
        }
      } else if (selectedDashboardKpiModal === 'almoco') {
        if (status === 'Em Almoço' || (rec?.lunchStart && !rec?.lunchReturn)) {
          const now = new Date();
          const nowMins = now.getHours() * 60 + now.getMinutes();
          let elapsedLunch = 0;
          if (rec?.lunchStart) {
            const [lH, lM] = rec.lunchStart.split(':').map(Number);
            if (!isNaN(lH) && !isNaN(lM)) {
              elapsedLunch = Math.max(0, nowMins - (lH * 60 + lM));
            }
          }
          items.push({
            user: u,
            status: 'Em Almoço',
            statusColor: 'bg-amber-50 text-amber-700 border-amber-200',
            entryTime,
            exitTime,
            lunchSpan: rec?.lunchStart || '--:--',
            workedTime,
            delayMins,
            overtimeMins,
            bankMins,
            bankFormatted,
            highlightLabel: 'Saída para Almoço',
            highlightValue: rec?.lunchStart || '--:--',
            highlightColor: 'text-amber-700 font-black',
            secondaryInfo: isSelectedDateToday ? `Tempo em pausa: ~${elapsedLunch} min (retorno previsto em 1h)` : `Intervalo iniciado às ${rec?.lunchStart}`,
            record: rec
          });
        }
      } else if (selectedDashboardKpiModal === 'ausentes') {
        if (status === 'Ausente' || !rec || !rec.entry) {
          items.push({
            user: u,
            status: 'Ausente',
            statusColor: 'bg-rose-50 text-rose-700 border-rose-200',
            entryTime: '--:--',
            exitTime: '--:--',
            lunchSpan: '--',
            workedTime: '00h 00m',
            delayMins: 0,
            overtimeMins: 0,
            bankMins,
            bankFormatted,
            highlightLabel: 'Situação',
            highlightValue: 'Sem marcação de entrada',
            highlightColor: 'text-rose-700 font-black',
            secondaryInfo: `Carga esperada: 8h/dia • Contato: ${u.email} ${u.phone ? '• Tel: ' + u.phone : ''}`,
            record: rec
          });
        }
      } else if (selectedDashboardKpiModal === 'atrasados') {
        if (delayMins > 0 || status === 'Atrasado') {
          items.push({
            user: u,
            status: 'Atrasado',
            statusColor: 'bg-orange-50 text-orange-700 border-orange-200',
            entryTime,
            exitTime,
            lunchSpan,
            workedTime,
            delayMins,
            overtimeMins,
            bankMins,
            bankFormatted,
            highlightLabel: 'Atraso Registrado',
            highlightValue: `+${delayMins} min`,
            highlightColor: 'text-orange-700 font-black',
            secondaryInfo: `Entrada às ${entryTime} (tolerância limite era 08:15)`,
            record: rec
          });
        }
      } else if (selectedDashboardKpiModal === 'extras') {
        if (overtimeMins > 0) {
          const extraH = Math.floor(overtimeMins / 60);
          const extraM = overtimeMins % 60;
          const overtimeStr = `+${extraH}h ${extraM < 10 ? '0' : ''}${extraM}m`;
          items.push({
            user: u,
            status,
            statusColor,
            entryTime,
            exitTime,
            lunchSpan,
            workedTime,
            delayMins,
            overtimeMins,
            bankMins,
            bankFormatted,
            highlightLabel: 'Horas Extras Hoje',
            highlightValue: overtimeStr,
            highlightColor: 'text-blue-700 font-black',
            secondaryInfo: `Jornada total: ${workedTime} • Entrada: ${entryTime} • Saída: ${exitTime}`,
            record: rec
          });
        }
      } else if (selectedDashboardKpiModal === 'banco') {
        items.push({
          user: u,
          status,
          statusColor,
          entryTime,
          exitTime,
          lunchSpan,
          workedTime,
          delayMins,
          overtimeMins,
          bankMins,
          bankFormatted,
          highlightLabel: 'Saldo Banco de Horas',
          highlightValue: bankFormatted,
          highlightColor: bankMins > 0 ? 'text-emerald-700 font-black' : bankMins < 0 ? 'text-rose-700 font-black' : 'text-slate-600 font-black',
          secondaryInfo: bankMins > 0 ? 'Crédito Positivo de Horas' : bankMins < 0 ? 'Débito Negativo de Horas' : 'Saldo Zerado / Regular',
          record: rec
        });
      }
    });

    if (selectedDashboardKpiModal === 'banco') {
      items.sort((a, b) => b.bankMins - a.bankMins);
    } else if (selectedDashboardKpiModal === 'atrasados') {
      items.sort((a, b) => b.delayMins - a.delayMins);
    } else if (selectedDashboardKpiModal === 'extras') {
      items.sort((a, b) => b.overtimeMins - a.overtimeMins);
    } else {
      items.sort((a, b) => a.user.name.localeCompare(b.user.name));
    }

    const rawTotalCount = items.length;

    if (kpiModalSearch) {
      const s = kpiModalSearch.toLowerCase().trim();
      items = items.filter(it => 
        it.user.name.toLowerCase().includes(s) ||
        (it.user.email && it.user.email.toLowerCase().includes(s)) ||
        (it.user.department && it.user.department.toLowerCase().includes(s)) ||
        (it.user.role && it.user.role.toLowerCase().includes(s))
      );
    }

    const meta: Record<string, { title: string; subtitle: string; badge: string; color: string; icon: any }> = {
      ativos: {
        title: 'Relação: Colaboradores Ativos',
        subtitle: `Relação completa de todos os colaboradores ativos e monitorados (${rawTotalCount} pessoas)`,
        badge: `${rawTotalCount} Colaboradores`,
        color: 'border-slate-300 text-slate-800 bg-slate-100',
        icon: Users
      },
      presentes: {
        title: 'Relação: Presentes Hoje',
        subtitle: `Colaboradores com registro de ponto confirmado na data ${targetDate.split('-').reverse().join('/')} (${rawTotalCount} presentes)`,
        badge: `${rawTotalCount} Presentes`,
        color: 'border-emerald-300 text-emerald-800 bg-emerald-50',
        icon: CheckCircle2
      },
      almoco: {
        title: 'Relação: Em Horário de Almoço',
        subtitle: `Colaboradores que registraram saída para intervalo e estão em pausa (${rawTotalCount} pessoas)`,
        badge: `${rawTotalCount} Em Almoço`,
        color: 'border-amber-300 text-amber-800 bg-amber-50',
        icon: Coffee
      },
      ausentes: {
        title: 'Relação: Ausentes Hoje',
        subtitle: `Colaboradores ativos sem registro de entrada na data ${targetDate.split('-').reverse().join('/')} (${rawTotalCount} ausentes)`,
        badge: `${rawTotalCount} Ausentes`,
        color: 'border-rose-300 text-rose-800 bg-rose-50',
        icon: AlertTriangle
      },
      atrasados: {
        title: 'Relação: Atrasados Hoje',
        subtitle: `Colaboradores que registraram entrada após 08:15 (tolerância de 15min) (${rawTotalCount} ocorrências)`,
        badge: `${rawTotalCount} Atrasados`,
        color: 'border-orange-300 text-orange-800 bg-orange-50',
        icon: Clock
      },
      extras: {
        title: 'Relação: Horas Extras Hoje',
        subtitle: `Colaboradores com jornada excedente além de 8h na data ${targetDate.split('-').reverse().join('/')} (${rawTotalCount} pessoas)`,
        badge: `${rawTotalCount} com Horas Extras`,
        color: 'border-blue-300 text-blue-800 bg-blue-50',
        icon: TrendingUp
      },
      banco: {
        title: 'Relação: Banco de Horas Consolidado',
        subtitle: `Detalhamento individual do saldo acumulado no período selecionado (${rawTotalCount} colaboradores)`,
        badge: `Total: ${kpiData.bancoHorasGeral}`,
        color: 'border-purple-300 text-purple-800 bg-purple-50',
        icon: Award
      }
    };

    return {
      type: selectedDashboardKpiModal,
      rawTotalCount,
      ...meta[selectedDashboardKpiModal],
      items
    };
  }, [selectedDashboardKpiModal, filteredUsers, userStatusMap, selectedDashboardDate, todayStr, kpiModalSearch, kpiData.bancoHorasGeral]);

  // --- DONUT DATA (OCUPAÇÃO DA EQUIPE) ---
  const occupancyData = useMemo(() => {
    let trabalhando = 0;
    let emAlmoco = 0;
    let foraExpediente = 0;
    let ausentes = 0;

    userStatusMap.forEach(st => {
      if (st.status === 'Trabalhando' || st.status === 'Atrasado') trabalhando++;
      else if (st.status === 'Em Almoço') emAlmoco++;
      else if (st.status === 'Ausente') ausentes++;
      else foraExpediente++;
    });

    return [
      { name: 'Trabalhando', value: trabalhando, color: '#10b981' },
      { name: 'Em Almoço', value: emAlmoco, color: '#f59e0b' },
      { name: 'Ausentes / Não Iniciou', value: ausentes, color: '#ef4444' },
      { name: 'Fora do Expediente', value: foraExpediente, color: '#64748b' }
    ].filter(d => d.value > 0);
  }, [userStatusMap]);

  // --- ENTRADAS POR HORÁRIO CHART DATA (Real entries count) ---
  const hourlyEntriesData = useMemo(() => {
    const hoursMap: Record<string, { quantidade: number; atrasos: number }> = {
      '07h': { quantidade: 0, atrasos: 0 },
      '08h': { quantidade: 0, atrasos: 0 },
      '09h': { quantidade: 0, atrasos: 0 },
      '10h': { quantidade: 0, atrasos: 0 },
      '11h': { quantidade: 0, atrasos: 0 },
    };

    userStatusMap.forEach(st => {
      if (st.entry && st.entry !== '--:--') {
        const hour = parseInt(st.entry.split(':')[0], 10);
        const key = hour < 8 ? '07h' : hour === 8 ? '08h' : hour === 9 ? '09h' : hour === 10 ? '10h' : '11h';
        if (hoursMap[key]) {
          hoursMap[key].quantidade += 1;
          if (st.delayMins > 0) hoursMap[key].atrasos += 1;
        }
      }
    });

    return Object.entries(hoursMap).map(([hora, val]) => ({
      hora,
      quantidade: val.quantidade,
      atrasos: val.atrasos
    }));
  }, [userStatusMap]);

  // Helper para verificar se a data do alerta pertence ao mês atual ou ao mês anterior
  const isCurrentOrPreviousMonth = (dateStr: string): boolean => {
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
  };

  // --- SMART ALERTS (SOLICITAÇÕES DE JUSTIFICATIVA E PENDÊNCIAS REAIS) ---
  const rawSmartAlerts = useMemo(() => {
    const alerts: Array<{
      id: string;
      type: 'critical' | 'warning' | 'info';
      title: string;
      message: string;
      justificationReason?: string;
      hasCertificate?: boolean;
      attachment?: { name: string; url: string };
      user: User;
      time: string;
      date: string;
      isUserRequest?: boolean;
    }> = [];

    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTotalMins = currentHour * 60 + currentMinute;
    const isWeekend = now.getDay() === 0; // Domingo
    const isTodayHoliday = Boolean(getHolidayInfo(todayStr));

    filteredUsers.forEach((u) => {
      // 1. Solicitações de Justificativa / Atestados enviados pelos colaboradores no mês atual ou anterior
      const userJustifications = records.filter(r => 
        isUserMatch(r, u) && 
        Boolean(r.justificationReason && r.justificationReason.trim()) &&
        isCurrentOrPreviousMonth(r.date)
      );

      userJustifications.forEach(rec => {
        const isCert = Boolean(rec.hasMedicalCertificate || rec.medicalCertificateAttachment);
        alerts.push({
          id: rec.id ? `solicitacao-${rec.id}` : `solicitacao-${u.id}-${rec.date}`,
          type: isCert ? 'warning' : 'info',
          title: isCert ? 'Atestado Médico / Justificativa Enviada' : 'Solicitação de Justificativa de Ponto',
          message: `${u.name} enviou uma justificativa para o dia ${rec.date.split('-').reverse().slice(0, 2).join('/')}.`,
          justificationReason: rec.justificationReason,
          hasCertificate: isCert,
          attachment: rec.medicalCertificateAttachment ? {
            name: rec.medicalCertificateAttachment.name,
            url: rec.medicalCertificateAttachment.url
          } : undefined,
          user: u,
          time: rec.date,
          date: rec.date,
          isUserRequest: true
        });
      });

      // 2. Marcação de saída esquecida/pendente em dia anterior (entrada batida, sem saída e sem justificativa)
      const pastUnclosedRecords = records.filter(r => 
        isUserMatch(r, u) && 
        !matchesDate(r.date, todayStr) && 
        r.entry && 
        !r.exit &&
        !r.justificationReason &&
        isCurrentOrPreviousMonth(r.date)
      );

      pastUnclosedRecords.forEach(rec => {
        if (isDateBeforeUserAdmission(rec.date, u, records)) return;
        alerts.push({
          id: rec.id ? `pendente-${rec.id}` : `pendente-${u.id}-${rec.date}`,
          type: 'warning',
          title: 'Saída Não Registrada em Dia Anterior',
          message: `${u.name} registrou entrada às ${rec.entry} no dia ${rec.date.split('-').reverse().slice(0, 2).join('/')}, mas não finalizou a batida de saída.`,
          user: u,
          time: rec.date,
          date: rec.date,
          isUserRequest: false
        });
      });

      // 3. Ausência de Entrada Hoje (apenas em dia útil e após o horário limite 08:30)
      const stData = userStatusMap.get(u.id);
      if (!isWeekend && !isTodayHoliday && currentTotalMins >= 8 * 60 + 30) {
        if (!isDateBeforeUserAdmission(todayStr, u, records) && stData?.status === 'Ausente' && !records.some(r => isUserMatch(r, u) && matchesDate(r.date, todayStr) && r.justificationReason)) {
          alerts.push({
            id: `ausente-${u.id}-${todayStr}`,
            type: 'critical',
            title: 'Ausência de Entrada Hoje',
            message: `${u.name} ainda não registrou a entrada de hoje (${todayStr.split('-').reverse().slice(0, 2).join('/')}).`,
            user: u,
            time: 'Hoje',
            date: todayStr,
            isUserRequest: false
          });
        }
      }
    });

    return alerts;
  }, [filteredUsers, userStatusMap, records, todayStr, customHolidays]);

  const activeSmartAlerts = useMemo(() => {
    const resolvedIds = new Set(resolvedAlerts.map(r => r.alertId));
    const seenIds = new Set<string>();

    return rawSmartAlerts.filter(alert => {
      if (seenIds.has(alert.id)) return false;
      seenIds.add(alert.id);

      // 0. Apenas exibe alertas referentes ao mês atual ou mês anterior
      if (!isCurrentOrPreviousMonth(alert.date)) return false;

      // 1. Alerta explicitamente resolvido no histórico
      if (resolvedIds.has(alert.id)) return false;

      // 2. Colaborador possui justificativa salva para a data do alerta
      const userRec = records.find(r => r.userId === alert.user.id && r.date === alert.date);
      if (userRec?.justificationReason) return false;

      // 3. Se for alerta de atraso, verificar se o ponto foi corrigido para dentro do horário normal
      if (alert.id.startsWith('atraso-') && userRec?.entry) {
        const [eH, eM] = userRec.entry.split(':').map(Number);
        if (eH * 60 + eM <= 8 * 60 + 15) return false;
      }

      // 4. Se for saída pendente, verificar se a saída foi preenchida
      if (alert.id.startsWith('pendente-') && userRec?.exit) return false;

      // 5. Se for ausência, verificar se a entrada foi registrada
      if (alert.id.startsWith('ausente-') && userRec?.entry) return false;

      return true;
    });
  }, [rawSmartAlerts, resolvedAlerts, records]);

  // --- RANKING TOP 5 (DERIVADO DO BANCO REAL E DO PERÍODO SELECIONADO) ---
  const rankings = useMemo(() => {
    if (filteredUsers.length === 0) {
      return {
        topAssiduidade: [],
        topHorasExtras: [],
        topBancoNegativo: [],
        topAtrasos: []
      };
    }

    const usersWithStats = filteredUsers.map(u => {
      const st = userStatusMap.get(u.id);
      const userRecs = records.filter(r => isUserMatch(r, u) && r.date && isDateInPeriod(r.date));
      const totalPunches = userRecs.length;
      const totalDelays = userRecs.filter(r => {
        if (!r.entry) return false;
        const [eH, eM] = r.entry.split(':').map(Number);
        return (eH * 60 + eM) > (8 * 60 + 15);
      }).length;

      const periodOvertimeMins = userRecs.reduce((sum, r) => {
        return sum + calculateRecordStatsForDrawer(r, r.date).overtimeMins;
      }, 0);
      const periodBankMins = userRecs.reduce((sum, r) => {
        return sum + calculateRecordStatsForDrawer(r, r.date).balanceMins;
      }, 0);

      return {
        user: u,
        bankMins: periodBankMins,
        overtimeMins: periodOvertimeMins,
        delayMins: st?.delayMins || 0,
        totalDelays,
        totalPunches
      };
    });

    const topAssiduidade = [...usersWithStats]
      .sort((a, b) => b.totalPunches - a.totalPunches)
      .slice(0, 5)
      .map(item => ({
        user: item.user,
        val: `${item.totalPunches} registros`
      }));

    const topHorasExtras = [...usersWithStats]
      .sort((a, b) => b.overtimeMins - a.overtimeMins)
      .slice(0, 5)
      .map(item => ({
        user: item.user,
        val: `+${(item.overtimeMins / 60).toFixed(1)}h`
      }));

    const topBancoNegativo = [...usersWithStats]
      .sort((a, b) => a.bankMins - b.bankMins)
      .filter(item => item.bankMins < 0)
      .slice(0, 5)
      .map(item => ({
        user: item.user,
        val: `${(item.bankMins / 60).toFixed(1)}h`
      }));

    const topAtrasos = [...usersWithStats]
      .sort((a, b) => b.totalDelays - a.totalDelays)
      .filter(item => item.totalDelays > 0)
      .slice(0, 5)
      .map(item => ({
        user: item.user,
        val: `${item.totalDelays} atraso${item.totalDelays > 1 ? 's' : ''}`
      }));

    return {
      topAssiduidade,
      topHorasExtras,
      topBancoNegativo,
      topAtrasos
    };
  }, [filteredUsers, userStatusMap, records, isDateInPeriod]);

  // --- ANALYTICAL CHARTS DATA ---
  const analyticalChartData = useMemo(() => {
    const now = new Date();

    const computeBucketStats = (dateStrings: string[]) => {
      let totalBankMins = 0;
      let totalOvertimeMins = 0;
      let totalDelayCount = 0;
      let totalWorkedCount = 0;
      let totalExpectedEntries = 0;

      dateStrings.forEach(dateStr => {
        const d = new Date(dateStr + 'T12:00:00');
        const dayOfWeek = d.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        filteredUsers.forEach(u => {
          if (!isWeekend) totalExpectedEntries++;
          const rec = records.find(r => r.userId === u.id && r.date === dateStr);
          if (rec) {
            const stats = calculateRecordStatsForDrawer(rec, dateStr);
            totalBankMins += stats.balanceMins;
            totalOvertimeMins += stats.overtimeMins;
            if (stats.delayMins > 0) totalDelayCount++;
            if (stats.workedMins > 0) totalWorkedCount++;
          }
        });
      });

      const banco = Number((totalBankMins / 60).toFixed(1));
      const extras = Number((totalOvertimeMins / 60).toFixed(1));
      const atrasos = totalDelayCount;
      const presenca = totalExpectedEntries > 0
        ? Math.min(100, Math.round((totalWorkedCount / totalExpectedEntries) * 100))
        : 100;

      return { banco, extras, atrasos, presenca };
    };

    if (chartPeriod === 'Hoje') {
      const list = [];
      const daysShort = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(now.getDate() - i);
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const label = `${daysShort[d.getDay()]} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
        const stats = computeBucketStats([dateStr]);
        list.push({ label, ...stats });
      }
      return list;
    }

    if (chartPeriod === 'Semana') {
      const list = [];
      const daysShort = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
      const dayOfWeek = now.getDay();
      const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date();
      monday.setDate(now.getDate() + diffToMonday);

      for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const label = `${daysShort[d.getDay()]} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
        const stats = computeBucketStats([dateStr]);
        list.push({ label, ...stats });
      }
      return list;
    }

    if (chartPeriod === 'Mês') {
      const list = [];
      const year = now.getFullYear();
      const month = now.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();

      const weekRanges = [
        { name: 'Sem 1 (1-7)', start: 1, end: 7 },
        { name: 'Sem 2 (8-14)', start: 8, end: 14 },
        { name: 'Sem 3 (15-21)', start: 15, end: 21 },
        { name: 'Sem 4 (22-28)', start: 22, end: 28 },
      ];
      if (daysInMonth > 28) {
        weekRanges.push({ name: `Sem 5 (29-${daysInMonth})`, start: 29, end: daysInMonth });
      }

      weekRanges.forEach(w => {
        const datesInWeek: string[] = [];
        for (let day = w.start; day <= Math.min(w.end, daysInMonth); day++) {
          datesInWeek.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
        }
        const stats = computeBucketStats(datesInWeek);
        list.push({ label: w.name, ...stats });
      });

      return list;
    }

    if (chartPeriod === 'Ano') {
      const list = [];
      const monthShort = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      const year = now.getFullYear();

      for (let m = 0; m < 12; m++) {
        const daysInM = new Date(year, m + 1, 0).getDate();
        const datesInMonth: string[] = [];
        for (let day = 1; day <= daysInM; day++) {
          datesInMonth.push(`${year}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
        }
        const stats = computeBucketStats(datesInMonth);
        list.push({ label: monthShort[m], ...stats });
      }

      return list;
    }

    return [];
  }, [chartPeriod, filteredUsers, records]);

  return (
    <div className="space-y-8 animate-fadeIn pb-20">
      {/* TOAST NOTICE */}
      {actionNotice && (
        <div className="fixed top-6 right-6 z-[200] bg-slate-900 border border-[#00A1E4] text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center space-x-3 animate-bounce">
          <Sparkles className="text-[#00A1E4] shrink-0" size={20} />
          <span className="text-xs font-black tracking-wide">{actionNotice}</span>
        </div>
      )}

      {/* HEADER PRINCIPAL / IDENTIFICAÇÃO DO PERFIL */}
      <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-6 sm:p-8 text-white relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#00A1E4]/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-center space-x-4">
            <button
              onClick={onBack}
              className="p-3 bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white rounded-2xl transition-all cursor-pointer group shrink-0"
              title="Voltar"
            >
              <X size={20} className="group-hover:scale-110 transition-transform" />
            </button>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                  isOwner ? 'bg-[#00A1E4]/20 text-[#00A1E4] border border-[#00A1E4]/40' : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                }`}>
                  {isOwner ? 'Painel Executivo Global' : 'Painel de Gestão da Supervisão'}
                </span>
                <span className="text-slate-400 text-xs font-bold">• VECGROUP RH</span>
                <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center space-x-1">
                  <Calendar size={12} className="inline mr-1" />
                  <span>Data do Ponto: {formattedSelectedDashboardDateLabel}</span>
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight mt-1">
                Dashboard de Controle de Ponto
              </h1>
              <p className="text-xs text-slate-400 font-medium">
                {isSupervisor 
                  ? `Visão focada na gestão da sua equipe (${user.department || 'Seu Departamento'})` 
                  : 'Visão corporativa integrada de todas as unidades, filiais e departamentos'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {excludedUsersList.length > 0 && (
              <button
                onClick={() => setIsExcludedModalOpen(true)}
                className="px-4 py-2.5 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 rounded-xl text-xs font-black uppercase tracking-wider text-rose-300 hover:text-white transition-all flex items-center space-x-2 cursor-pointer shadow-sm"
                title="Visualizar e gerenciar colaboradores removidos do relógio de ponto"
              >
                <UserX size={15} />
                <span>Ocultos ({excludedUsersList.length})</span>
              </button>
            )}

            <button
              onClick={() => onRefreshData().then(() => showToast('Dados do banco sincronizados com sucesso!'))}
              className="px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-black uppercase tracking-wider text-slate-200 hover:text-white transition-all flex items-center space-x-2 cursor-pointer"
            >
              <RefreshCw size={15} />
              <span>Atualizar Dados</span>
            </button>
          </div>
        </div>

        {/* BARRA DE FILTROS RÁPIDOS SUPERIOR */}
        <div className="mt-6 pt-6 border-t border-slate-800 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9 gap-2.5">
          {/* Data de Consulta / Dia do Dashboard */}
          <div className="col-span-2 sm:col-span-2 lg:col-span-2">
            <label className="text-[9px] font-black text-[#00A1E4] uppercase tracking-widest block mb-1 flex items-center justify-between">
              <span>📅 Data do Dashboard</span>
              {selectedDashboardDate !== todayStr && (
                <button 
                  onClick={() => setSelectedDashboardDate(todayStr)}
                  className="text-[9px] underline hover:text-white font-bold cursor-pointer text-amber-400"
                >
                  Voltar p/ Hoje
                </button>
              )}
            </label>
            <div className="flex items-center space-x-1">
              <button
                onClick={handlePrevDashboardDay}
                title="Dia Anterior"
                className="p-2 bg-slate-800/80 hover:bg-slate-700 border border-slate-700/80 rounded-xl text-slate-300 hover:text-white transition-all cursor-pointer shrink-0"
              >
                <ChevronLeft size={14} />
              </button>
              <input
                type="date"
                value={selectedDashboardDate}
                onChange={(e) => setSelectedDashboardDate(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-800/80 border border-slate-700/80 rounded-xl text-[11px] font-black text-white focus:outline-none focus:border-[#00A1E4]"
              />
              <button
                onClick={handleNextDashboardDay}
                title="Próximo Dia"
                className="p-2 bg-slate-800/80 hover:bg-slate-700 border border-slate-700/80 rounded-xl text-slate-300 hover:text-white transition-all cursor-pointer shrink-0"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>

          {/* Empresa */}
          <div>
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Empresa</label>
            <select
              disabled={isSupervisor}
              value={empresaFilter}
              onChange={(e) => setEmpresaFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700/80 rounded-xl text-[11px] font-bold text-slate-200 focus:outline-none focus:border-[#00A1E4]"
            >
              <option value="Todas">Todas</option>
              <option value="VECGROUP Matriz">VECGROUP Matriz</option>
            </select>
          </div>

          {/* Filial */}
          <div>
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Filial</label>
            <select
              disabled={isSupervisor}
              value={filialFilter}
              onChange={(e) => setFilialFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700/80 rounded-xl text-[11px] font-bold text-slate-200 focus:outline-none focus:border-[#00A1E4]"
            >
              <option value="Todas">Todas</option>
            </select>
          </div>

          {/* Departamento */}
          <div>
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Departamento</label>
            <select
              disabled={isSupervisor}
              value={departamentoFilter}
              onChange={(e) => setDepartamentoFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700/80 rounded-xl text-[11px] font-bold text-slate-200 focus:outline-none focus:border-[#00A1E4]"
            >
              {departamentosOptions.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          {/* Cargo */}
          <div>
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Cargo</label>
            <select
              value={cargoFilter}
              onChange={(e) => setCargoFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700/80 rounded-xl text-[11px] font-bold text-slate-200 focus:outline-none focus:border-[#00A1E4]"
            >
              {cargosOptions.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Escala */}
          <div>
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Escala</label>
            <select
              value={escalaFilter}
              onChange={(e) => setEscalaFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700/80 rounded-xl text-[11px] font-bold text-slate-200 focus:outline-none focus:border-[#00A1E4]"
            >
              <option value="Todas">Todas</option>
              <option value="5x2">5x2 (08h-18h)</option>
              <option value="6x1">6x1 (09h-18h)</option>
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Status Ponto</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700/80 rounded-xl text-[11px] font-bold text-slate-200 focus:outline-none focus:border-[#00A1E4]"
            >
              <option value="Todos">Todos</option>
              <option value="Trabalhando">Trabalhando</option>
              <option value="Em Almoço">Em Almoço</option>
              <option value="Atrasado">Atrasado</option>
              <option value="Ausente">Ausente</option>
            </select>
          </div>

          {/* Período */}
          <div>
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Período</label>
            <select
              value={periodoFilter}
              onChange={(e) => setPeriodoFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700/80 rounded-xl text-[11px] font-bold text-slate-200 focus:outline-none focus:border-[#00A1E4]"
            >
              <option value="Mês Atual">Mês Atual ({formatMonthLabel(todayStr.substring(0, 7))})</option>
              <option value="Hoje">Hoje</option>
              <option value="Esta Semana">Esta Semana</option>
              <option value="Últimos 2 Meses">Últimos 2 Meses</option>
              <option value="Últimos 3 Meses">Últimos 3 Meses</option>
              <option value="Últimos 4 Meses">Últimos 4 Meses</option>
              <option value="Últimos 6 Meses">Últimos 6 Meses</option>
              <option value="Últimos 12 Meses">Últimos 12 Meses (1 Ano)</option>
              <option value="Todo o Histórico">Todo o Histórico</option>
              
              {availableMonths.length > 0 && (
                <optgroup label="Filtrar por Mês Específico">
                  {availableMonths.map((mStr) => (
                    <option key={mStr} value={`month:${mStr}`}>
                      {formatMonthLabel(mStr)}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>
        </div>
      </div>

      {/* BARRA DE AÇÕES DE DEPARTAMENTO PESSOAL */}
      <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-none">
        <button
          onClick={() => setIsReportModalOpen(true)}
          className="px-6 py-3.5 bg-gradient-to-r from-[#00A1E4] via-[#003399] to-[#001f66] hover:from-[#0089c4] hover:to-[#002266] text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center space-x-3 shadow-lg shadow-[#00A1E4]/25 shrink-0 cursor-pointer border border-white/20 hover:scale-[1.02] active:scale-95"
        >
          <div className="w-7 h-7 rounded-xl bg-white/20 flex items-center justify-center">
            <FileSpreadsheet size={18} className="text-white" />
          </div>
          <div className="text-left">
            <span className="block text-[11px] font-black leading-tight">Baixar Relatório Mensal</span>
            <span className="block text-[9px] font-bold text-white/80 tracking-normal">Departamento Pessoal & Contabilidade</span>
          </div>
          <ChevronRight size={16} className="text-white/70 ml-1" />
        </button>

        <button
          onClick={() => showToast('Importador de arquivos AFD / CSV de relógio ponto pronto!')}
          className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all flex items-center space-x-2 border border-slate-700 shrink-0 cursor-pointer"
        >
          <Upload size={16} className="text-slate-400" />
          <span>Importar Marcações</span>
        </button>
      </div>

      {/* PRIMEIRA LINHA: CARDS GRANDES DE KPIS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
        {/* KPI 1 */}
        <div 
          onClick={() => { setSelectedDashboardKpiModal('ativos'); setKpiModalSearch(''); }}
          title="Clique para ver a relação de colaboradores ativos"
          className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-3 relative overflow-hidden group hover:border-[#00A1E4] hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer select-none"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Colaboradores Ativos</span>
            <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center group-hover:bg-blue-50 group-hover:text-[#00A1E4] transition-colors">
              <Users size={16} />
            </div>
          </div>
          <div>
            <span className="text-2xl font-black text-slate-900 block group-hover:text-[#00A1E4] transition-colors">{kpiData.totalAtivos}</span>
            <span className="text-[10px] font-black text-emerald-600 flex items-center mt-1">
              <CheckCircle2 size={12} className="mr-0.5" /> Apenas usuários ativos
            </span>
          </div>
          <div className="pt-2 border-t border-slate-50 flex items-center justify-between text-[9px] font-black text-slate-400 group-hover:text-[#00A1E4] transition-colors">
            <span>Ver relação</span>
            <ChevronRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>

        {/* KPI 2 */}
        <div 
          onClick={() => { setSelectedDashboardKpiModal('presentes'); setKpiModalSearch(''); }}
          title="Clique para ver a relação de presentes hoje"
          className="bg-white p-5 rounded-3xl border border-emerald-100 shadow-sm space-y-3 relative overflow-hidden group hover:border-emerald-500 hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer select-none"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-emerald-700 tracking-wider">Presentes Hoje</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-200 transition-colors">
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div>
            <span className="text-2xl font-black text-slate-900 block group-hover:text-emerald-700 transition-colors">{kpiData.presentes}</span>
            <span className="text-[10px] font-black text-emerald-600 flex items-center mt-1">
              <ArrowUpRight size={12} className="mr-0.5" /> Registros confirmados
            </span>
          </div>
          <div className="pt-2 border-t border-emerald-50 flex items-center justify-between text-[9px] font-black text-emerald-600/70 group-hover:text-emerald-700 transition-colors">
            <span>Ver relação</span>
            <ChevronRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>

        {/* KPI 3 */}
        <div 
          onClick={() => { setSelectedDashboardKpiModal('almoco'); setKpiModalSearch(''); }}
          title="Clique para ver quem está em almoço"
          className="bg-white p-5 rounded-3xl border border-amber-100 shadow-sm space-y-3 relative overflow-hidden group hover:border-amber-500 hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer select-none"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-amber-700 tracking-wider">Em Almoço</span>
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center group-hover:bg-amber-200 transition-colors">
              <Coffee size={16} />
            </div>
          </div>
          <div>
            <span className="text-2xl font-black text-slate-900 block group-hover:text-amber-700 transition-colors">{kpiData.emAlmoco}</span>
            <span className="text-[10px] font-black text-slate-400 flex items-center mt-1">
              Intervalo ativo
            </span>
          </div>
          <div className="pt-2 border-t border-amber-50 flex items-center justify-between text-[9px] font-black text-amber-600/70 group-hover:text-amber-700 transition-colors">
            <span>Ver relação</span>
            <ChevronRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>

        {/* KPI 4 */}
        <div 
          onClick={() => { setSelectedDashboardKpiModal('ausentes'); setKpiModalSearch(''); }}
          title="Clique para ver quem está ausente"
          className="bg-white p-5 rounded-3xl border border-rose-100 shadow-sm space-y-3 relative overflow-hidden group hover:border-rose-500 hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer select-none"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-rose-700 tracking-wider">Ausentes Hoje</span>
            <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center group-hover:bg-rose-200 transition-colors">
              <AlertTriangle size={16} />
            </div>
          </div>
          <div>
            <span className="text-2xl font-black text-slate-900 block group-hover:text-rose-700 transition-colors">{kpiData.ausentes}</span>
            <span className="text-[10px] font-black text-rose-600 flex items-center mt-1">
              Sem marcação de entrada
            </span>
          </div>
          <div className="pt-2 border-t border-rose-50 flex items-center justify-between text-[9px] font-black text-rose-600/70 group-hover:text-rose-700 transition-colors">
            <span>Ver relação</span>
            <ChevronRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>

        {/* KPI 5 */}
        <div 
          onClick={() => { setSelectedDashboardKpiModal('atrasados'); setKpiModalSearch(''); }}
          title="Clique para ver relação de atrasados hoje"
          className="bg-white p-5 rounded-3xl border border-orange-100 shadow-sm space-y-3 relative overflow-hidden group hover:border-orange-500 hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer select-none"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-orange-700 tracking-wider">Atrasados Hoje</span>
            <div className="w-8 h-8 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center group-hover:bg-orange-200 transition-colors">
              <Clock size={16} />
            </div>
          </div>
          <div>
            <span className="text-2xl font-black text-slate-900 block group-hover:text-orange-700 transition-colors">{kpiData.atrasados}</span>
            <span className="text-[10px] font-black text-orange-600 flex items-center mt-1">
              Após 08:15
            </span>
          </div>
          <div className="pt-2 border-t border-orange-50 flex items-center justify-between text-[9px] font-black text-orange-600/70 group-hover:text-orange-700 transition-colors">
            <span>Ver relação</span>
            <ChevronRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>

        {/* KPI 6 */}
        <div 
          onClick={() => { setSelectedDashboardKpiModal('extras'); setKpiModalSearch(''); }}
          title="Clique para ver quem realizou horas extras"
          className="bg-white p-5 rounded-3xl border border-blue-100 shadow-sm space-y-3 relative overflow-hidden group hover:border-blue-500 hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer select-none"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-blue-700 tracking-wider">Horas Extras</span>
            <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center group-hover:bg-blue-200 transition-colors">
              <TrendingUp size={16} />
            </div>
          </div>
          <div>
            <span className="text-2xl font-black text-slate-900 block group-hover:text-blue-700 transition-colors">{kpiData.horasExtrasHoje}</span>
            <span className="text-[10px] font-black text-blue-600 flex items-center mt-1">
              Hoje
            </span>
          </div>
          <div className="pt-2 border-t border-blue-50 flex items-center justify-between text-[9px] font-black text-blue-600/70 group-hover:text-blue-700 transition-colors">
            <span>Ver relação</span>
            <ChevronRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>

        {/* KPI 7 */}
        <div 
          onClick={() => { setSelectedDashboardKpiModal('banco'); setKpiModalSearch(''); }}
          title="Clique para ver detalhamento do banco de horas"
          className="bg-white p-5 rounded-3xl border border-purple-100 shadow-sm space-y-3 relative overflow-hidden group hover:border-purple-500 hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer select-none"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-purple-700 tracking-wider">Banco Geral</span>
            <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center group-hover:bg-purple-200 transition-colors">
              <Award size={16} />
            </div>
          </div>
          <div>
            <span className="text-2xl font-black text-slate-900 block group-hover:text-purple-700 transition-colors">{kpiData.bancoHorasGeral}</span>
            <span className="text-[10px] font-black text-purple-600 flex items-center mt-1">
              Consolidado
            </span>
          </div>
          <div className="pt-2 border-t border-purple-50 flex items-center justify-between text-[9px] font-black text-purple-600/70 group-hover:text-purple-700 transition-colors">
            <span>Ver relação</span>
            <ChevronRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>
      </div>

      {/* SEGUNDA LINHA: GRÁFICOS DE OCUPAÇÃO E ENTRADAS POR HORÁRIO */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* GRÁFICO DONUT DE OCUPAÇÃO */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Ocupação da Equipe em Tempo Real</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Distribuição atual dos colaboradores</p>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase">
              Ao Vivo
            </span>
          </div>

          <div className="h-64 relative flex items-center justify-center">
            {occupancyData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={occupancyData}
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {occupancyData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center text-slate-400 text-xs font-bold">Nenhum colaborador cadastrado</div>
            )}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-12 text-center pointer-events-none">
              <span className="text-2xl font-black text-slate-900 block">{kpiData.totalAtivos}</span>
              <span className="text-[9px] font-black uppercase text-slate-400">Total Equipe</span>
            </div>
          </div>
        </div>

        {/* GRÁFICO ENTRADAS POR HORÁRIO */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Entradas por Horário</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Picos de chegada e frequência de atrasos</p>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 text-[10px] font-black uppercase">
              Tolerância: 15 min
            </span>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlyEntriesData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="hora" tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }} />
                <Tooltip />
                <Bar dataKey="quantidade" name="Pontuais" fill="#10b981" radius={[6, 6, 0, 0]} />
                <Bar dataKey="atrasos" name="Com Atraso" fill="#f59e0b" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* TERCEIRA LINHA: PAINEL EQUIPE HOJE (CARDS DE COLABORADORES ATIVOS) */}
      <div className="bg-white rounded-[2.5rem] p-6 sm:p-8 border border-slate-100 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-[#00A1E4]/10 text-[#00A1E4] flex items-center justify-center">
              <Users size={20} />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Equipe Hoje ({displayedUsers.length})</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                Status individual em tempo real • Clique no card para abrir o espelho e histórico
              </p>
            </div>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Buscar colaborador ativo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#00A1E4]"
            />
          </div>
        </div>

        {/* GRID DE CARDS DOS COLABORADORES ATIVOS */}
        {displayedUsers.length === 0 ? (
          <div className="p-12 text-center bg-slate-50 border border-slate-100 rounded-2xl space-y-2">
            <Users className="mx-auto text-slate-300" size={32} />
            <p className="text-xs font-black text-slate-600 uppercase">Nenhum colaborador ativo encontrado</p>
            <p className="text-[10px] text-slate-400 font-medium">Verifique os filtros selecionados ou certifique-se de que existem colaboradores cadastrados com status ATIVO.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {displayedUsers.map((u, idx) => {
              const stData = userStatusMap.get(u.id) || {
                status: 'Ausente',
                entry: '--:--',
                workedTime: '00h 00m',
                delayMins: 0,
                bankMins: 0,
                overtimeMins: 0
              };

              const borderClass = stData.status === 'Trabalhando' 
                ? 'border-emerald-300 hover:border-emerald-500 shadow-emerald-500/5'
                : stData.status === 'Em Almoço'
                  ? 'border-amber-300 hover:border-amber-500 shadow-amber-500/5'
                  : stData.status === 'Atrasado'
                    ? 'border-orange-300 hover:border-orange-500 shadow-orange-500/5'
                    : 'border-slate-200 hover:border-slate-400 shadow-slate-500/5';

              return (
                <div
                  key={`${u.id || u.email || 'user'}-${idx}`}
                  onClick={() => setSelectedEmployeeForDrawer(u)}
                  className={`bg-white p-5 rounded-2xl border-2 ${borderClass} shadow-md transition-all hover:scale-[1.01] cursor-pointer relative group space-y-4`}
                >
                  {/* Header Card */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <img
                        src={u.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=random`}
                        alt={u.name}
                        referrerPolicy="no-referrer"
                        className="w-11 h-11 rounded-xl object-cover border border-slate-200"
                      />
                      <div>
                        <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight group-hover:text-[#00A1E4] transition-colors">
                          {u.name}
                        </h4>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">
                          {u.role || 'Colaborador'} • {u.department || 'Geral'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1.5">
                      <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${
                        stData.status === 'Trabalhando'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : stData.status === 'Em Almoço'
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : stData.status === 'Em Pausa (5m)'
                              ? 'bg-amber-100 text-amber-800 border border-amber-300 animate-pulse'
                              : stData.status === 'Atrasado'
                                ? 'bg-orange-100 text-orange-800 border border-orange-200'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}>
                        {stData.status}
                      </span>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleExcludeUserFromTimeClock(u);
                        }}
                        title="Remover colaborador da lista do relógio de ponto"
                        className="p-1 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      >
                        <UserX size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Grid de Informações do Ponto */}
                  <div className="grid grid-cols-2 gap-2 bg-slate-50/80 p-3 rounded-xl border border-slate-100">
                    <div>
                      <span className="text-[9px] font-black uppercase text-slate-400 block">Entrada Hoje</span>
                      <span className="text-xs font-black text-slate-800">{stData.entry}</span>
                    </div>
                    <div>
                      <span className="text-[9px] font-black uppercase text-slate-400 block">Tempo Trabalhado</span>
                      <span className="text-xs font-black text-slate-800">{stData.workedTime}</span>
                    </div>
                    <div>
                      <span className="text-[9px] font-black uppercase text-slate-400 block">Banco de Horas</span>
                      <span className={`text-xs font-black ${stData.bankMins >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {stData.bankMins >= 0 ? `+${(stData.bankMins / 60).toFixed(1)}h` : `${(stData.bankMins / 60).toFixed(1)}h`}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] font-black uppercase text-slate-400 block">Atraso Registrado</span>
                      <span className={`text-xs font-black ${stData.delayMins > 0 ? 'text-orange-600' : 'text-slate-400'}`}>
                        {stData.delayMins > 0 ? `${stData.delayMins} min` : 'Nenhum'}
                      </span>
                    </div>
                  </div>

                  {/* Footer do Card */}
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase pt-1">
                    <span>Horas extras: {(stData.overtimeMins / 60).toFixed(1)}h</span>
                    <span className="text-[#00A1E4] flex items-center group-hover:translate-x-1 transition-transform">
                      Ver Espelho completo <ChevronRight size={12} className="ml-0.5" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* QUARTA LINHA: PAINEL DE ALERTAS INTELIGENTES (BANCO REAL E HISTÓRICO) */}
      <div className="bg-white rounded-[2.5rem] p-6 sm:p-8 border border-slate-100 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center">
              <AlertCircle size={20} />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Alertas Inteligentes de Ponto</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                {alertsTab === 'active' 
                  ? 'Ocorrências ativas calculadas exclusivamente dos usuários ativos e registros reais'
                  : 'Histórico de ocorrências corrigidas e justificativas salvas no sistema'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 bg-slate-100 p-1.5 rounded-2xl">
            <button
              onClick={() => setAlertsTab('active')}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition-all flex items-center space-x-2 cursor-pointer ${
                alertsTab === 'active' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <AlertTriangle size={14} />
              <span>Ativas ({activeSmartAlerts.length})</span>
            </button>

            <button
              onClick={() => setAlertsTab('history')}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition-all flex items-center space-x-2 cursor-pointer ${
                alertsTab === 'history' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <History size={14} />
              <span>Ver Histórico ({resolvedAlerts.length})</span>
            </button>
          </div>
        </div>

        {alertsTab === 'active' ? (
          activeSmartAlerts.length === 0 ? (
            <div className="p-8 text-center bg-emerald-50/50 border border-emerald-100 rounded-2xl flex flex-col items-center justify-center space-y-2">
              <CheckCircle2 size={32} className="text-emerald-500" />
              <h4 className="text-xs font-black text-emerald-900 uppercase">Toda a equipe em conformidade</h4>
              <p className="text-[11px] text-emerald-700 font-medium">Nenhum alerta de atraso, ausência ou banco negativo para os colaboradores ativos no momento.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeSmartAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-4 sm:p-5 rounded-2xl border flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 transition-all shadow-2xs ${
                    alert.type === 'critical'
                      ? 'bg-rose-50/60 border-rose-200 text-rose-950'
                      : alert.type === 'warning'
                        ? 'bg-amber-50/60 border-amber-200 text-amber-950'
                        : 'bg-sky-50/60 border-sky-200 text-sky-950'
                  }`}
                >
                  <div className="flex items-start space-x-3.5 flex-1 min-w-0">
                    <img
                      src={alert.user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(alert.user.name)}`}
                      alt={alert.user.name}
                      referrerPolicy="no-referrer"
                      className="w-10 h-10 rounded-xl object-cover border border-slate-200 mt-0.5 shrink-0 shadow-2xs"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="text-xs font-black uppercase tracking-tight">{alert.title}</span>
                        {alert.isUserRequest && (
                          <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase bg-blue-600 text-white tracking-wider">
                            Solicitado pelo Colaborador
                          </span>
                        )}
                        {alert.hasCertificate && (
                          <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase bg-emerald-600 text-white tracking-wider">
                            Atestado Anexado
                          </span>
                        )}
                        <span className="text-[10px] font-bold text-slate-400">
                          • {alert.date.split('-').reverse().join('/')}
                        </span>
                      </div>
                      <p className="text-xs font-medium text-slate-700">{alert.message}</p>

                      {/* Exibição Clara do Motivo da Justificativa enviado pelo Usuário */}
                      {alert.justificationReason && (
                        <div className="mt-2.5 p-3 bg-white/90 border border-slate-200/80 rounded-xl text-slate-800 space-y-1.5 shadow-2xs">
                          <div className="flex items-center space-x-1.5 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                            <FileText size={12} className="text-[#00A1E4]" />
                            <span>Motivo informado pelo colaborador:</span>
                          </div>
                          <p className="text-xs font-semibold text-slate-900 italic">
                            "{alert.justificationReason}"
                          </p>
                          {alert.attachment && (
                            <div className="pt-1 flex items-center space-x-2">
                              <a
                                href={alert.attachment.url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center space-x-1 text-[11px] font-bold text-[#00A1E4] hover:underline"
                              >
                                <span>📄 Abrir Atestado/Anexo ({alert.attachment.name})</span>
                              </a>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Ações Rápidas */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0 self-end lg:self-center">
                    <button
                      onClick={() => setSelectedEmployeeForDrawer(alert.user)}
                      className="px-3 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-[10px] font-black uppercase transition-all shadow-2xs cursor-pointer flex items-center space-x-1"
                      title="Visualizar espelho completo do colaborador"
                    >
                      <Calendar size={13} />
                      <span>Ver Espelho</span>
                    </button>

                    {alert.isUserRequest ? (
                      <button
                        onClick={() => handleApproveUserJustificationAlert(alert)}
                        className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase transition-all shadow-2xs cursor-pointer flex items-center space-x-1"
                        title="Aprovar e arquivar no histórico"
                      >
                        <CheckCircle2 size={13} />
                        <span>Aprovar Justificativa</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleOpenJustificationModal(alert.user, alert.date, alert.id, alert.title)}
                        className="px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 rounded-xl text-[10px] font-black uppercase transition-all shadow-2xs cursor-pointer flex items-center space-x-1"
                      >
                        <FileText size={13} />
                        <span>Justificar</span>
                      </button>
                    )}

                    <button
                      onClick={() => handleOpenEditModal(alert.user, alert.date, alert.id, alert.title)}
                      className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-[10px] font-black uppercase transition-all shadow-2xs cursor-pointer flex items-center space-x-1"
                    >
                      <Edit3 size={13} />
                      <span>Corrigir Ponto ({alert.date.split('-').reverse().slice(0, 2).join('/')})</span>
                    </button>

                    {!alert.isUserRequest && (
                      <button
                        onClick={() => handleDismissAlert(alert.id, alert.user, alert.title, alert.date)}
                        className="p-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-xl text-[10px] font-black uppercase transition-all shadow-2xs cursor-pointer"
                        title="Dispensar / Arquivar este alerta"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          /* HISTÓRICO DE ALERTAS RESOLVIDOS */
          <div className="space-y-3">
            {resolvedAlerts.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 border border-slate-100 rounded-2xl flex flex-col items-center justify-center space-y-2">
                <History size={32} className="text-slate-300" />
                <h4 className="text-xs font-black text-slate-600 uppercase">Nenhum alerta no histórico</h4>
                <p className="text-[11px] text-slate-400 font-medium">Alertas corrigidos ou com justificativa salva aparecerão nesta seção.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between px-2 pb-1">
                  <span className="text-[10px] font-black uppercase text-slate-400">Total de {resolvedAlerts.length} itens no histórico</span>
                  <button
                    onClick={() => {
                      if (confirm("Deseja realmente limpar o histórico de alertas resolvidos?")) {
                        setResolvedAlerts([]);
                        localStorage.removeItem('vecgroup_resolved_alerts');
                        showToast('Histórico de alertas limpo.');
                      }
                    }}
                    className="text-[10px] font-black uppercase text-rose-600 hover:underline cursor-pointer"
                  >
                    Limpar Histórico
                  </button>
                </div>
                {resolvedAlerts.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 rounded-2xl border border-slate-200 bg-slate-50/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                  >
                    <div className="flex items-start space-x-3">
                      <img
                        src={item.userAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.userName)}`}
                        alt=""
                        referrerPolicy="no-referrer"
                        className="w-10 h-10 rounded-xl object-cover border border-slate-200 mt-0.5 shrink-0"
                      />
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-black text-slate-900 uppercase">{item.userName}</span>
                          <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase ${
                            item.resolutionType === 'JUSTIFIED' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {item.resolutionType === 'JUSTIFIED' ? 'Justificado' : 'Ponto Corrigido'}
                          </span>
                          <span className="text-[9px] font-bold text-slate-400">• Data do Ponto: {item.date}</span>
                        </div>
                        <p className="text-xs font-bold text-slate-700 mt-1">{item.title}: {item.message}</p>
                        {item.hasCertificate && (
                          <span className="inline-flex items-center space-x-1 text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md mt-1">
                            <Paperclip size={10} />
                            <span>Atestado Médico Anexado {item.attachmentName ? `(${item.attachmentName})` : ''}</span>
                          </span>
                        )}
                        <p className="text-[9px] text-slate-400 font-bold mt-1">
                          Resolvido por: {item.resolvedBy} em {new Date(item.resolvedAt).toLocaleDateString('pt-BR')} às {new Date(item.resolvedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 self-end sm:self-center">
                      <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl flex items-center space-x-1">
                        <CheckCircle2 size={12} className="text-emerald-500" />
                        <span>Resolvido</span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* QUINTA LINHA: RANKING TOP 5 (4 CARDS DERIVADOS DO BANCO REAL) */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {/* CARD 1: ASSIDUIDADE */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
            <Award className="text-amber-500" size={20} />
            <h4 className="text-xs font-black uppercase tracking-tight text-slate-900">🏆 Mais Registros</h4>
          </div>
          <div className="space-y-2.5">
            {rankings.topAssiduidade.length === 0 ? (
              <p className="text-xs text-slate-400 font-medium">Sem dados de assiduidade</p>
            ) : (
              rankings.topAssiduidade.map((item, idx) => (
                <div key={`rank-assid-${item.user.id || item.user.name}-${idx}`} className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="flex items-center space-x-2.5">
                    <span className="text-xs font-black text-slate-400 w-4">#{idx + 1}</span>
                    <img src={item.user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.user.name)}`} className="w-7 h-7 rounded-lg object-cover" alt="" referrerPolicy="no-referrer" />
                    <span className="text-xs font-black text-slate-800 truncate max-w-[110px]">{item.user.name}</span>
                  </div>
                  <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">{item.val}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* CARD 2: HORAS EXTRAS */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
            <TrendingUp className="text-blue-500" size={20} />
            <h4 className="text-xs font-black uppercase tracking-tight text-slate-900">⏰ Mais Horas Extras</h4>
          </div>
          <div className="space-y-2.5">
            {rankings.topHorasExtras.length === 0 ? (
              <p className="text-xs text-slate-400 font-medium">Sem horas extras registradas</p>
            ) : (
              rankings.topHorasExtras.map((item, idx) => (
                <div key={`rank-he-${item.user.id || item.user.name}-${idx}`} className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="flex items-center space-x-2.5">
                    <span className="text-xs font-black text-slate-400 w-4">#{idx + 1}</span>
                    <img src={item.user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.user.name)}`} className="w-7 h-7 rounded-lg object-cover" alt="" referrerPolicy="no-referrer" />
                    <span className="text-xs font-black text-slate-800 truncate max-w-[110px]">{item.user.name}</span>
                  </div>
                  <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">{item.val}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* CARD 3: BANCO NEGATIVO */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
            <TrendingDown className="text-rose-500" size={20} />
            <h4 className="text-xs font-black uppercase tracking-tight text-slate-900">📉 Maior Banco Negativo</h4>
          </div>
          <div className="space-y-2.5">
            {rankings.topBancoNegativo.length === 0 ? (
              <p className="text-xs text-slate-400 font-medium">Nenhum banco negativo acumulado</p>
            ) : (
              rankings.topBancoNegativo.map((item, idx) => (
                <div key={`rank-bn-${item.user.id || item.user.name}-${idx}`} className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="flex items-center space-x-2.5">
                    <span className="text-xs font-black text-slate-400 w-4">#{idx + 1}</span>
                    <img src={item.user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.user.name)}`} className="w-7 h-7 rounded-lg object-cover" alt="" referrerPolicy="no-referrer" />
                    <span className="text-xs font-black text-slate-800 truncate max-w-[110px]">{item.user.name}</span>
                  </div>
                  <span className="text-[10px] font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md">{item.val}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* CARD 4: ATRASOS */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
            <Clock className="text-orange-500" size={20} />
            <h4 className="text-xs font-black uppercase tracking-tight text-slate-900">⌛ Mais Atrasos</h4>
          </div>
          <div className="space-y-2.5">
            {rankings.topAtrasos.length === 0 ? (
              <p className="text-xs text-slate-400 font-medium">Sem registro de atrasos</p>
            ) : (
              rankings.topAtrasos.map((item, idx) => (
                <div key={`rank-atraso-${item.user.id || item.user.name}-${idx}`} className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="flex items-center space-x-2.5">
                    <span className="text-xs font-black text-slate-400 w-4">#{idx + 1}</span>
                    <img src={item.user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.user.name)}`} className="w-7 h-7 rounded-lg object-cover" alt="" referrerPolicy="no-referrer" />
                    <span className="text-xs font-black text-slate-800 truncate max-w-[110px]">{item.user.name}</span>
                  </div>
                  <span className="text-[10px] font-black text-orange-600 bg-orange-50 px-2 py-0.5 rounded-md">{item.val}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* SEXTA LINHA: GRÁFICOS GERENCIAIS AVANÇADOS */}
      <div className="bg-white p-6 sm:p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-100 text-purple-600 flex items-center justify-center">
              <BarChart3 size={20} />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Análise Comparativa Gerencial</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                Evolução periódica dos indicadores de presença e horas
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Metric selector */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl">
              {(['banco', 'extras', 'atrasos', 'presenca'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setActiveChartMetric(m)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${
                    activeChartMetric === m ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {m === 'banco' ? 'Banco' : m === 'extras' ? 'Extras' : m === 'atrasos' ? 'Atrasos' : 'Presença'}
                </button>
              ))}
            </div>

            {/* Timeframe selector */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl">
              {(['Hoje', 'Semana', 'Mês', 'Ano'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setChartPeriod(p)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${
                    chartPeriod === p ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="h-72 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={analyticalChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00A1E4" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#00A1E4" stopOpacity={0.0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }} />
              <Tooltip 
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    const val = data[activeChartMetric];
                    const unit = activeChartMetric === 'presenca' ? '%' : (activeChartMetric === 'atrasos' ? ' ocorrência(s)' : 'h');
                    const metricNames: Record<string, string> = {
                      banco: 'Banco de Horas',
                      extras: 'Horas Extras',
                      atrasos: 'Atrasos Registrados',
                      presenca: 'Taxa de Presença'
                    };
                    const formattedVal = activeChartMetric === 'banco' && val > 0 ? `+${val}` : val;
                    return (
                      <div className="bg-slate-900 text-white p-3 rounded-xl text-xs space-y-1 shadow-xl border border-slate-700">
                        <p className="font-black border-b border-white/10 pb-1 text-[#00A1E4] uppercase">{data.label}</p>
                        <p className="font-bold">
                          {metricNames[activeChartMetric]}: <span className="font-black text-emerald-400">{formattedVal}{unit}</span>
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area type="monotone" dataKey={activeChartMetric} stroke="#00A1E4" strokeWidth={3} fillOpacity={1} fill="url(#areaGradient)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* DRAWER DO COLABORADOR COM DADOS REAIS */}
      {selectedEmployeeForDrawer && (
        <div className="fixed inset-0 z-[120] bg-slate-950/70 backdrop-blur-sm flex justify-end animate-fadeIn">
          <div className="bg-white w-full max-w-xl h-full shadow-2xl border-l border-slate-100 flex flex-col overflow-hidden animate-slideLeft">
            {/* Header Drawer */}
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <img
                  src={selectedEmployeeForDrawer.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedEmployeeForDrawer.name)}`}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="w-12 h-12 rounded-2xl object-cover border border-slate-700"
                />
                <div>
                  <h3 className="text-base font-black uppercase tracking-tight">{selectedEmployeeForDrawer.name}</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">
                    {selectedEmployeeForDrawer.role || 'Colaborador'} • {selectedEmployeeForDrawer.department || 'Geral'}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleExcludeUserFromTimeClock(selectedEmployeeForDrawer)}
                  title="Remover colaborador da lista de relógio de ponto"
                  className="p-2 text-rose-400 hover:text-rose-300 hover:bg-rose-500/20 rounded-xl transition-all cursor-pointer flex items-center space-x-1"
                >
                  <UserX size={16} />
                  <span className="text-[10px] font-black uppercase hidden sm:inline">Remover do Relógio</span>
                </button>
                <button
                  onClick={() => setSelectedEmployeeForDrawer(null)}
                  className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Body Drawer */}
            <div className="p-6 space-y-6 overflow-y-auto flex-1">
              {/* Resumo de Indicadores no Mês Selecionado */}
              {(() => {
                const userRecs = records.filter(r => isUserMatch(r, selectedEmployeeForDrawer));
                const monthRecs = userRecs.filter(r => r.date && r.date.startsWith(drawerReportMonth));
                const st = userStatusMap.get(selectedEmployeeForDrawer.id);

                const monthBankMins = monthRecs.reduce((sum, r) => {
                  return sum + calculateRecordStatsForDrawer(r, r.date).balanceMins;
                }, 0);

                const monthTotalRegistros = monthRecs.length;

                return (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <div 
                        onClick={() => setKpiDetailModal('banco')}
                        className="p-3.5 bg-slate-50 hover:bg-slate-100/90 rounded-2xl border border-slate-100 hover:border-slate-300 transition-all cursor-pointer group shadow-2xs relative"
                        title="Clique para ver o detalhamento completo do Banco de Horas no mês"
                      >
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-[9px] font-black uppercase text-slate-400 group-hover:text-slate-600 block">Banco de Horas</span>
                          <Info size={12} className="text-slate-300 group-hover:text-slate-600 transition-colors" />
                        </div>
                        <span className={`text-sm font-black ${monthBankMins >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {monthBankMins >= 0 ? `+${(monthBankMins / 60).toFixed(1)}h` : `${(monthBankMins / 60).toFixed(1)}h`}
                        </span>
                        <span className="text-[8px] font-bold text-slate-400 block mt-0.5 group-hover:text-slate-600">Ver soma e dias ›</span>
                      </div>

                      <div 
                        onClick={() => setKpiDetailModal('horas_extras')}
                        className="p-3.5 bg-slate-50 hover:bg-slate-100/90 rounded-2xl border border-slate-100 hover:border-slate-300 transition-all cursor-pointer group shadow-2xs relative"
                        title="Clique para ver o detalhamento de Horas Extras de hoje"
                      >
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-[9px] font-black uppercase text-slate-400 group-hover:text-slate-600 block">Horas Extras Hoje</span>
                          <Info size={12} className="text-slate-300 group-hover:text-slate-600 transition-colors" />
                        </div>
                        <span className="text-sm font-black text-blue-600">{((st?.overtimeMins || 0) / 60).toFixed(1)}h</span>
                        <span className="text-[8px] font-bold text-slate-400 block mt-0.5 group-hover:text-slate-600">Ver cálculo ›</span>
                      </div>

                      <div 
                        onClick={() => setKpiDetailModal('registros')}
                        className="p-3.5 bg-slate-50 hover:bg-slate-100/90 rounded-2xl border border-slate-100 hover:border-slate-300 transition-all cursor-pointer group shadow-2xs relative"
                        title="Clique para ver a lista de todos os registros de ponto do mês"
                      >
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-[9px] font-black uppercase text-slate-400 group-hover:text-slate-600 block">Total de Registros</span>
                          <Info size={12} className="text-slate-300 group-hover:text-slate-600 transition-colors" />
                        </div>
                        <span className="text-sm font-black text-slate-800">{monthTotalRegistros} Dias</span>
                        <span className="text-[8px] font-bold text-slate-400 block mt-0.5 group-hover:text-slate-600">Ver datas ›</span>
                      </div>

                      <div 
                        onClick={() => setKpiDetailModal('atraso')}
                        className="p-3.5 bg-slate-50 hover:bg-slate-100/90 rounded-2xl border border-slate-100 hover:border-slate-300 transition-all cursor-pointer group shadow-2xs relative"
                        title="Clique para ver o detalhamento de Atraso de hoje"
                      >
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-[9px] font-black uppercase text-slate-400 group-hover:text-slate-600 block">Atraso Hoje</span>
                          <Info size={12} className="text-slate-300 group-hover:text-slate-600 transition-colors" />
                        </div>
                        <span className="text-sm font-black text-amber-600">{st?.delayMins ? `${st.delayMins} min` : 'Nenhum'}</span>
                        <span className="text-[8px] font-bold text-slate-400 block mt-0.5 group-hover:text-slate-600">Ver detalhes ›</span>
                      </div>

                      <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                        <span className="text-[9px] font-black uppercase text-slate-400 block mb-0.5">Status Hoje</span>
                        <span className="text-sm font-black text-emerald-600">{st?.status || 'Ausente'}</span>
                        <span className="text-[8px] font-bold text-slate-400 block mt-0.5">Status em tempo real</span>
                      </div>
                    </div>

                    {/* CALENDÁRIO INTELIGENTE MENSAL DO COLABORADOR */}
                    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200/80 space-y-4 mt-2">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div className="flex items-center space-x-2.5">
                          <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs">
                            <CalendarDays size={16} />
                          </div>
                          <div>
                            <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight">Calendário Inteligente</h4>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Histórico e status diário de ponto</p>
                          </div>
                        </div>

                        {/* Navegação de Mês */}
                        <div className="flex items-center space-x-1.5 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
                          <button
                            onClick={handlePrevDrawerMonth}
                            className="p-1 hover:bg-slate-100 text-slate-600 rounded-lg transition-colors cursor-pointer"
                            title="Mês Anterior"
                          >
                            <ChevronLeft size={14} />
                          </button>
                          <span className="text-[10px] font-black uppercase text-slate-800 px-2">
                            {formattedDrawerMonth}
                          </span>
                          <button
                            onClick={handleNextDrawerMonth}
                            className="p-1 hover:bg-slate-100 text-slate-600 rounded-lg transition-colors cursor-pointer"
                            title="Próximo Mês"
                          >
                            <ChevronRight size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Legenda de Cores compacta */}
                      <div className="flex flex-wrap items-center gap-2.5 text-[9px] font-bold text-slate-600 bg-white p-2.5 rounded-xl border border-slate-200/60">
                        <div className="flex items-center space-x-1">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          <span>🟢 Normal</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <span className="w-2 h-2 rounded-full bg-amber-500" />
                          <span>🟡 Atraso</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <span className="w-2 h-2 rounded-full bg-blue-500" />
                          <span>🔵 Extra</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <span className="w-2 h-2 rounded-full bg-red-500" />
                          <span>🔴 Falta</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <span className="w-2 h-2 rounded-full bg-[#8B5CF6]" />
                          <span>🟣 Feriado</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <span className="w-2 h-2 rounded-full bg-slate-300" />
                          <span>⚪ Folga</span>
                        </div>
                      </div>

                      {/* Grid do Calendário Inteligente */}
                      <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((dayName, idx) => (
                          <div key={`${dayName}-${idx}`} className="text-center text-[9px] font-black text-slate-400 uppercase tracking-widest py-0.5">
                            {dayName}
                          </div>
                        ))}

                        {Array.from({ length: drawerCalendarDays.firstDayOfWeek }).map((_, i) => (
                          <div key={`empty-padding-${i}`} className="p-2 rounded-xl border border-transparent bg-slate-100/30 h-16 opacity-30" />
                        ))}

                        {drawerCalendarDays.days.map((day) => (
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
                                workedHours: day.stats.formattedWorked,
                                balance: day.stats.formattedBalance,
                                status: day.statusLabel,
                                statusType: day.statusType,
                                isHoliday: day.isHoliday,
                                holidayName: day.holidayName,
                                justificationReason: day.rec?.justificationReason,
                                hasMedicalCertificate: day.rec?.hasMedicalCertificate,
                                medicalCertificateAttachment: day.rec?.medicalCertificateAttachment
                              });
                            }}
                            className={`p-2 rounded-xl border text-left transition-all hover:scale-105 flex flex-col justify-between h-16 relative group ${
                              day.isHoliday
                                ? 'bg-purple-50/80 border-purple-200 text-purple-900 shadow-2xs hover:border-purple-400'
                                : day.isWeekend 
                                  ? 'bg-slate-100/50 border-slate-200/60 text-slate-400' 
                                  : 'bg-white border-slate-200 hover:border-[#00A1E4] hover:shadow-xs'
                            }`}
                          >
                            <div className="flex items-center justify-between w-full">
                              <span className={`text-[10px] font-black ${day.isHoliday ? 'text-purple-900' : 'text-slate-800'}`}>
                                {day.dayNumber}
                              </span>
                              <span className={`w-2 h-2 rounded-full ${day.dotColor}`} />
                            </div>

                            <div className="mt-0.5">
                              <p className={`text-[7px] font-bold uppercase truncate ${day.isHoliday ? 'text-purple-600' : 'text-slate-400'}`}>
                                {day.rec?.justificationReason ? '📄 Justificado' : day.statusLabel}
                              </p>
                              {day.rec?.entry && (
                                <p className="text-[8px] font-black text-slate-700">{day.rec.entry}</p>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Footer Drawer com Botões de Ação */}
            <div className="p-5 bg-slate-50 border-t border-slate-100 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleOpenEditModal(selectedEmployeeForDrawer)}
                  className="py-2.5 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black uppercase transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
                >
                  <Edit3 size={14} />
                  <span>Editar Ponto</span>
                </button>

                <button
                  onClick={() => handleOpenJustificationModal(selectedEmployeeForDrawer)}
                  className="py-2.5 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black uppercase transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
                >
                  <FileText size={14} />
                  <span>Justificativa</span>
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => {
                    showToast(`Espelho de ponto de ${selectedEmployeeForDrawer.name} exportado!`);
                  }}
                  className="py-2.5 px-3 bg-[#00A1E4] hover:bg-[#0089c4] text-white rounded-xl text-xs font-black uppercase transition-all flex items-center justify-center space-x-1.5 cursor-pointer col-span-2"
                >
                  <Download size={14} />
                  <span>Exportar Espelho</span>
                </button>

                <button
                  onClick={() => handleExcludeUserFromTimeClock(selectedEmployeeForDrawer)}
                  className="py-2.5 px-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-black uppercase transition-all flex items-center justify-center space-x-1 cursor-pointer"
                  title="Remover colaborador da lista de relógio de ponto"
                >
                  <UserX size={13} />
                  <span>Remover</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDITAR / CORRIGIR PONTO */}
      {editPunchRecord && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-fadeIn">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 overflow-hidden">
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black uppercase">Corrigir Marcação de Ponto</h3>
                <p className="text-[10px] text-slate-400 uppercase font-bold">{editPunchRecord.user.name}</p>
              </div>
              <button onClick={() => setEditPunchRecord(null)} className="text-slate-400 hover:text-white cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Data da Ocorrência</label>
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => handleDateChangeInEditModal(e.target.value)}
                  disabled={isSavingEditPunch}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:border-[#00A1E4]"
                />
                <p className="text-[10px] text-slate-400 mt-1 font-medium">Altere a data acima para carregar e corrigir as marcações de qualquer dia do histórico.</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Entrada</label>
                  <input
                    type="time"
                    value={editEntry}
                    onChange={(e) => setEditEntry(e.target.value)}
                    disabled={isSavingEditPunch}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold disabled:opacity-60"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Almoço (Início)</label>
                  <input
                    type="time"
                    value={editLunchStart}
                    onChange={(e) => setEditLunchStart(e.target.value)}
                    disabled={isSavingEditPunch}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold disabled:opacity-60"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Almoço (Retorno)</label>
                  <input
                    type="time"
                    value={editLunchReturn}
                    onChange={(e) => setEditLunchReturn(e.target.value)}
                    disabled={isSavingEditPunch}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold disabled:opacity-60"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Saída Final</label>
                  <input
                    type="time"
                    value={editExit}
                    onChange={(e) => setEditExit(e.target.value)}
                    disabled={isSavingEditPunch}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold disabled:opacity-60"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">
                  Justificativa / Motivo da Alteração <span className="text-slate-400 font-medium">(Opcional)</span>
                </label>
                <textarea
                  rows={3}
                  value={editJustificationReason}
                  onChange={(e) => {
                    setEditJustificationReason(e.target.value);
                    if (editPunchError) setEditPunchError(null);
                  }}
                  disabled={isSavingEditPunch}
                  placeholder="Descreva o motivo da alteração dos horários (se vazio, será salvo como 'Ajuste manual pelo gestor')..."
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:border-slate-400 disabled:opacity-60 resize-none"
                />
              </div>

              {/* Mensagem de Erro Inline */}
              {editPunchError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 flex items-start space-x-2 animate-fadeIn">
                  <AlertTriangle size={16} className="text-rose-600 shrink-0 mt-0.5" />
                  <span className="text-xs font-bold leading-tight">{editPunchError}</span>
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end space-x-2">
              <button
                onClick={() => setEditPunchRecord(null)}
                disabled={isSavingEditPunch}
                className="px-4 py-2 bg-slate-200 text-slate-700 rounded-xl text-xs font-black uppercase cursor-pointer hover:bg-slate-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveEditPunch}
                disabled={isSavingEditPunch}
                className="px-6 py-2 bg-slate-900 text-white rounded-xl text-xs font-black uppercase cursor-pointer hover:bg-slate-800 disabled:opacity-75 disabled:cursor-not-allowed transition-all shadow-md flex items-center justify-center space-x-2"
              >
                {isSavingEditPunch ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    <span>Sincronizando...</span>
                  </>
                ) : (
                  <span>Salvar Alterações</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ADICIONAR JUSTIFICATIVA */}
      {justificationModalRecord && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-fadeIn">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 overflow-hidden">
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black uppercase">Adicionar Justificativa de Ponto</h3>
                <p className="text-[10px] text-slate-400 uppercase font-bold">{justificationModalRecord.user.name}</p>
              </div>
              <button
                onClick={() => setJustificationModalRecord(null)}
                disabled={isSavingJustification}
                className="text-slate-400 hover:text-white cursor-pointer disabled:opacity-50"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Data do Ocorrido</label>
                <input
                  type="date"
                  value={justificationDate}
                  onChange={(e) => handleDateChangeInJustificationModal(e.target.value)}
                  disabled={isSavingJustification}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold disabled:opacity-60 focus:outline-none focus:border-[#00A1E4]"
                />
                <p className="text-[10px] text-slate-400 mt-1 font-medium">Altere a data acima para aplicar a justificativa ao dia correspondente no espelho de ponto.</p>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Motivo da Falta / Atraso / Inconsistência</label>
                <textarea
                  rows={3}
                  value={justificationText}
                  onChange={(e) => {
                    setJustificationText(e.target.value);
                    if (justificationModalError) setJustificationModalError(null);
                  }}
                  disabled={isSavingJustification}
                  placeholder="Descreva detalhadamente o motivo da justificativa..."
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none disabled:opacity-60 resize-none"
                />
              </div>

              <div className="space-y-3 p-3.5 bg-slate-50 border border-slate-100 rounded-2xl">
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id="hasCert"
                    checked={hasCertificate}
                    onChange={(e) => setHasCertificate(e.target.checked)}
                    disabled={isSavingJustification}
                    className="w-4 h-4 text-emerald-600 rounded cursor-pointer disabled:opacity-60"
                  />
                  <label htmlFor="hasCert" className="text-xs font-black text-slate-800 uppercase cursor-pointer">
                    Possui Atestado Médico / Comprovante
                  </label>
                </div>

                {hasCertificate && (
                  <div className="pt-2 border-t border-slate-200/60">
                    <label className="text-[10px] font-black uppercase text-slate-500 block mb-1.5">Anexo do Atestado (Foto ou PDF)</label>
                    {justificationAttachment ? (
                      <div className="flex items-center justify-between p-2.5 bg-white border border-slate-200 rounded-xl">
                        <div className="flex items-center space-x-2 truncate">
                          <Paperclip size={14} className="text-slate-500 shrink-0" />
                          <span className="text-xs font-bold text-slate-800 truncate">{justificationAttachment.name}</span>
                        </div>
                        <button
                          onClick={() => setJustificationAttachment(null)}
                          disabled={isSavingJustification}
                          className="text-rose-600 hover:text-rose-800 text-[10px] font-black uppercase ml-2 shrink-0 cursor-pointer disabled:opacity-50"
                        >
                          Remover
                        </button>
                      </div>
                    ) : (
                      <label className="flex items-center justify-center space-x-2 p-3 bg-white border border-dashed border-slate-300 hover:border-slate-400 rounded-xl cursor-pointer text-slate-600 transition-all">
                        <Upload size={16} />
                        <span className="text-xs font-bold uppercase">{isUploadingAttachment ? 'Enviando...' : 'Anexar Documento'}</span>
                        <input
                          type="file"
                          accept="image/*,.pdf"
                          onChange={handleModalAttachmentUpload}
                          disabled={isUploadingAttachment || isSavingJustification}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                )}
              </div>

              {/* Mensagem de Erro Inline no Modal de Justificativa */}
              {justificationModalError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 flex items-start space-x-2 animate-fadeIn">
                  <AlertTriangle size={16} className="text-rose-600 shrink-0 mt-0.5" />
                  <span className="text-xs font-bold leading-tight">{justificationModalError}</span>
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end space-x-2">
              <button
                onClick={() => setJustificationModalRecord(null)}
                disabled={isSavingJustification}
                className="px-4 py-2 bg-slate-200 text-slate-700 rounded-xl text-xs font-black uppercase cursor-pointer hover:bg-slate-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveJustificationModal}
                disabled={isSavingJustification}
                className="px-6 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black uppercase cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed transition-all shadow-md flex items-center justify-center space-x-2"
              >
                {isSavingJustification ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    <span>Sincronizando...</span>
                  </>
                ) : (
                  <span>Salvar Justificativa</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DETALHES DO DIA SELECIONADO NO CALENDÁRIO */}
      {selectedCalendarDay && selectedEmployeeForDrawer && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-fadeIn">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 overflow-hidden">
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-[#00A1E4]/20 text-[#00A1E4] flex items-center justify-center border border-[#00A1E4]/30">
                  <CalendarDays size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase">Detalhes do Dia {selectedCalendarDay.formattedDate}</h3>
                  <p className="text-[10px] text-slate-400 uppercase font-bold">{selectedEmployeeForDrawer.name} • {selectedCalendarDay.dateStr}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedCalendarDay(null)}
                className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              {/* Status Badge */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
                <span className="text-[9px] font-black uppercase text-slate-400 block">Status do Dia</span>
                <span className={`text-xs font-black uppercase inline-block px-3 py-1 rounded-full ${
                  selectedCalendarDay.isHoliday
                    ? 'bg-purple-100 text-purple-800 border border-purple-200'
                    : selectedCalendarDay.statusType === 'absence'
                      ? 'bg-rose-100 text-rose-800 border border-rose-200'
                      : selectedCalendarDay.statusType === 'delay'
                        ? 'bg-amber-100 text-amber-800 border border-amber-200'
                        : selectedCalendarDay.statusType === 'overtime'
                          ? 'bg-blue-100 text-blue-800 border border-blue-200'
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                }`}>
                  {selectedCalendarDay.status}
                </span>
              </div>

              {/* Feriado Info */}
              {selectedCalendarDay.isHoliday && (
                <div className="p-4 rounded-2xl bg-purple-50 border border-purple-100 space-y-1">
                  <span className="text-[10px] font-black uppercase text-purple-900 block">Feriado Nacional / Especial</span>
                  <p className="text-xs text-purple-700 font-bold">
                    {selectedCalendarDay.holidayName || 'Feriado cadastrado no sistema.'}
                  </p>
                </div>
              )}

              {/* Horários do Ponto */}
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <span className="text-[9px] font-black text-slate-400 uppercase block">Entrada</span>
                  <span className="text-sm font-black text-slate-800">{selectedCalendarDay.entry}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <span className="text-[9px] font-black text-slate-400 uppercase block">Almoço (S)</span>
                  <span className="text-sm font-black text-slate-800">{selectedCalendarDay.lunchStart}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <span className="text-[9px] font-black text-slate-400 uppercase block">Almoço (V)</span>
                  <span className="text-sm font-black text-slate-800">{selectedCalendarDay.lunchReturn}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <span className="text-[9px] font-black text-slate-400 uppercase block">Saída</span>
                  <span className="text-sm font-black text-slate-800">{selectedCalendarDay.exit}</span>
                </div>
              </div>

              {/* Horas Trabalhadas e Saldo */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                  <span className="text-[9px] font-black text-slate-400 uppercase block">Horas Trabalhadas</span>
                  <span className="text-base font-black text-slate-900">{selectedCalendarDay.workedHours}</span>
                </div>
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                  <span className="text-[9px] font-black text-slate-400 uppercase block">Saldo de Horas</span>
                  <span className={`text-base font-black ${selectedCalendarDay.balance.startsWith('+') ? 'text-emerald-600' : selectedCalendarDay.balance.startsWith('-') ? 'text-rose-600' : 'text-slate-700'}`}>
                    {selectedCalendarDay.balance}
                  </span>
                </div>
              </div>

              {/* Justificativa e Atestado se houver */}
              {(selectedCalendarDay.justificationReason || selectedCalendarDay.hasMedicalCertificate) && (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200/80 space-y-2">
                  <span className="text-[10px] font-black uppercase text-amber-900 block">Justificativa / Atestado Registrado</span>
                  {selectedCalendarDay.justificationReason && (
                    <p className="text-xs text-amber-900 font-medium italic">
                      "{selectedCalendarDay.justificationReason}"
                    </p>
                  )}
                  {selectedCalendarDay.hasMedicalCertificate && (
                    <div className="pt-2 border-t border-amber-200/60">
                      <span className="text-[10px] font-bold text-amber-800 uppercase block mb-1">Atestado Médico Anexado</span>
                      {selectedCalendarDay.medicalCertificateAttachment ? (
                        <a
                          href={selectedCalendarDay.medicalCertificateAttachment.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center space-x-2 text-xs font-bold text-[#00A1E4] hover:underline"
                        >
                          <Paperclip size={14} />
                          <span>{selectedCalendarDay.medicalCertificateAttachment.name}</span>
                        </a>
                      ) : (
                        <span className="text-xs text-amber-800 italic">Comprovante médico anexado.</span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Ações do Modal */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  const dateStr = selectedCalendarDay.dateStr;
                  setSelectedCalendarDay(null);
                  handleOpenEditModal(selectedEmployeeForDrawer, dateStr);
                }}
                className="py-2.5 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black uppercase transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
              >
                <Edit3 size={14} />
                <span>Editar Este Dia</span>
              </button>
              <button
                onClick={() => {
                  const dateStr = selectedCalendarDay.dateStr;
                  setSelectedCalendarDay(null);
                  handleOpenJustificationModal(selectedEmployeeForDrawer, dateStr);
                }}
                className="py-2.5 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black uppercase transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
              >
                <FileText size={14} />
                <span>Justificar</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DETALHAMENTO DE KPI (BANCO DE HORAS, HORAS EXTRAS, REGISTROS, ATRASO) */}
      {kpiDetailModal && selectedEmployeeForDrawer && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-fadeIn">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-[#00A1E4]">
                  <Clock size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-tight">
                    {kpiDetailModal === 'banco' && 'Detalhamento do Banco de Horas'}
                    {kpiDetailModal === 'horas_extras' && 'Detalhamento de Horas Extras Hoje'}
                    {kpiDetailModal === 'registros' && 'Detalhamento dos Registros do Mês'}
                    {kpiDetailModal === 'atraso' && 'Detalhamento de Atraso Hoje'}
                  </h3>
                  <p className="text-[10px] text-slate-400 uppercase font-bold">
                    {selectedEmployeeForDrawer.name} • {formattedDrawerMonth}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setKpiDetailModal(null)}
                className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* 1. DETALHAMENTO BANCO DE HORAS */}
              {kpiDetailModal === 'banco' && (() => {
                const daysWithStats = drawerCalendarDays.days.map(day => {
                  return {
                    dateStr: day.dateStr,
                    dayNumber: day.dayNumber,
                    statusLabel: day.statusLabel,
                    entry: day.rec?.entry || '--:--',
                    exit: day.rec?.exit || '--:--',
                    workedMins: day.stats.workedMins,
                    balanceMins: day.stats.balanceMins,
                    formattedWorked: day.stats.formattedWorked,
                    formattedBalance: day.stats.formattedBalance,
                    hasRecord: !!day.rec
                  };
                });

                const totalPositivesMins = daysWithStats.reduce((sum, d) => sum + (d.balanceMins > 0 ? d.balanceMins : 0), 0);
                const totalNegativesMins = daysWithStats.reduce((sum, d) => sum + (d.balanceMins < 0 ? d.balanceMins : 0), 0);
                const totalNetMins = daysWithStats.reduce((sum, d) => sum + d.balanceMins, 0);

                return (
                  <div className="space-y-4">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-100 text-center">
                        <span className="text-[9px] font-black uppercase text-emerald-700 block">Créditos (+)</span>
                        <span className="text-sm font-black text-emerald-700">+{ (totalPositivesMins / 60).toFixed(1) }h</span>
                      </div>
                      <div className="p-3 bg-rose-50 rounded-2xl border border-rose-100 text-center">
                        <span className="text-[9px] font-black uppercase text-rose-700 block">Débitos (-)</span>
                        <span className="text-sm font-black text-rose-700">{ (totalNegativesMins / 60).toFixed(1) }h</span>
                      </div>
                      <div className="p-3 bg-slate-900 rounded-2xl border border-slate-800 text-center text-white">
                        <span className="text-[9px] font-black uppercase text-slate-400 block">Saldo Líquido</span>
                        <span className={`text-sm font-black ${totalNetMins >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {totalNetMins >= 0 ? `+${(totalNetMins / 60).toFixed(1)}h` : `${(totalNetMins / 60).toFixed(1)}h`}
                        </span>
                      </div>
                    </div>

                    {/* Table of Days */}
                    <div className="border border-slate-200 rounded-2xl overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200 text-[9px] font-black uppercase text-slate-500">
                          <tr>
                            <th className="p-3">Data</th>
                            <th className="p-3">Entrada</th>
                            <th className="p-3">Saída</th>
                            <th className="p-3">Trabalhado</th>
                            <th className="p-3 text-right">Saldo do Dia</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700 font-bold">
                          {daysWithStats.map(d => (
                            <tr key={d.dateStr} className="hover:bg-slate-50/80">
                              <td className="p-3 text-slate-900 font-black">{d.dateStr.split('-').reverse().slice(0,2).join('/')} ({d.statusLabel})</td>
                              <td className="p-3 text-slate-600">{d.entry}</td>
                              <td className="p-3 text-slate-600">{d.exit}</td>
                              <td className="p-3 text-slate-800">{d.formattedWorked}</td>
                              <td className={`p-3 text-right font-black ${d.balanceMins > 0 ? 'text-emerald-600' : d.balanceMins < 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                                {d.formattedBalance}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}

              {/* 2. DETALHAMENTO HORAS EXTRAS HOJE */}
              {kpiDetailModal === 'horas_extras' && (() => {
                const userRecs = records.filter(r => isUserMatch(r, selectedEmployeeForDrawer));
                const todayRec = userRecs.find(r => r.date === todayStr);
                const st = userStatusMap.get(selectedEmployeeForDrawer.id);
                const overtimeHours = ((st?.overtimeMins || 0) / 60).toFixed(1);

                return (
                  <div className="space-y-4">
                    <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl space-y-1">
                      <span className="text-[9px] font-black uppercase text-blue-700 block">Horas Extras Hoje ({todayStr})</span>
                      <span className="text-2xl font-black text-blue-900">{overtimeHours} Horas</span>
                      <p className="text-[10px] text-blue-700 font-medium">Horas trabalhadas além da jornada contratual de 8h diárias.</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-center">
                      <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                        <span className="text-[9px] font-black text-slate-400 uppercase block">Entrada</span>
                        <span className="text-sm font-black text-slate-800">{todayRec?.entry || '--:--'}</span>
                      </div>
                      <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                        <span className="text-[9px] font-black text-slate-400 uppercase block">Saída Almoço</span>
                        <span className="text-sm font-black text-slate-800">{todayRec?.lunchStart || '--:--'}</span>
                      </div>
                      <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                        <span className="text-[9px] font-black text-slate-400 uppercase block">Retorno Almoço</span>
                        <span className="text-sm font-black text-slate-800">{todayRec?.lunchReturn || '--:--'}</span>
                      </div>
                      <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                        <span className="text-[9px] font-black text-slate-400 uppercase block">Saída</span>
                        <span className="text-sm font-black text-slate-800">{todayRec?.exit || '--:--'}</span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* 3. DETALHAMENTO TOTAL DE REGISTROS MENSAL */}
              {kpiDetailModal === 'registros' && (() => {
                const userRecs = records.filter(r => isUserMatch(r, selectedEmployeeForDrawer));
                const monthRecs = userRecs.filter(r => r.date && r.date.startsWith(drawerReportMonth));

                return (
                  <div className="space-y-4">
                    <div className="p-4 bg-slate-100 border border-slate-200 rounded-2xl flex items-center justify-between">
                      <div>
                        <span className="text-[9px] font-black uppercase text-slate-500 block">Total de Registros no Mês</span>
                        <span className="text-lg font-black text-slate-900">{monthRecs.length} Dias Registrados</span>
                      </div>
                      <span className="text-xs font-bold text-slate-500 uppercase">{formattedDrawerMonth}</span>
                    </div>

                    <div className="border border-slate-200 rounded-2xl overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200 text-[9px] font-black uppercase text-slate-500">
                          <tr>
                            <th className="p-3">Data</th>
                            <th className="p-3">Entrada</th>
                            <th className="p-3">Almoço</th>
                            <th className="p-3">Saída</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700 font-bold">
                          {monthRecs.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="p-4 text-center text-slate-400 italic">
                                Nenhum registro cadastrado para este mês.
                              </td>
                            </tr>
                          ) : (
                            monthRecs.map(r => (
                              <tr key={r.id || r.date} className="hover:bg-slate-50">
                                <td className="p-3 font-black text-slate-900">{r.date.split('-').reverse().slice(0,2).join('/')}</td>
                                <td className="p-3 text-slate-700">{r.entry || '--:--'}</td>
                                <td className="p-3 text-slate-600">{r.lunchStart && r.lunchReturn ? `${r.lunchStart} - ${r.lunchReturn}` : '--:--'}</td>
                                <td className="p-3 text-slate-700">{r.exit || '--:--'}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}

              {/* 4. DETALHAMENTO DE ATRASO HOJE */}
              {kpiDetailModal === 'atraso' && (() => {
                const userRecs = records.filter(r => isUserMatch(r, selectedEmployeeForDrawer));
                const todayRec = userRecs.find(r => r.date === todayStr);
                const st = userStatusMap.get(selectedEmployeeForDrawer.id);

                return (
                  <div className="space-y-4">
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-1">
                      <span className="text-[9px] font-black uppercase text-amber-800 block">Atraso Hoje ({todayStr})</span>
                      <span className="text-2xl font-black text-amber-900">{st?.delayMins ? `${st.delayMins} minutos` : 'Nenhum atraso'}</span>
                      <p className="text-[10px] text-amber-700 font-medium">Horário contratual de entrada: 08:00 (Tolerância até 10 min)</p>
                    </div>

                    <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-slate-500 uppercase">Horário de Entrada Previsto:</span>
                        <span className="font-black text-slate-900">08:00</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-slate-500 uppercase">Horário de Entrada Registrado:</span>
                        <span className="font-black text-slate-900">{todayRec?.entry || 'Não registrou'}</span>
                      </div>
                      {todayRec?.justificationReason && (
                        <div className="pt-2 border-t border-slate-200">
                          <span className="text-[10px] font-black text-slate-500 uppercase block">Justificativa Enviada:</span>
                          <p className="text-xs text-slate-800 italic mt-0.5">"{todayRec.justificationReason}"</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setKpiDetailModal(null)}
                className="py-2.5 px-5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black uppercase cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CONFIGURADOR DE RELATÓRIO MENSAL DP */}
      <MonthlyReportDpModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        currentUser={user}
        allUsers={(() => {
          const map = new Map<string, User>();
          (allUsers || []).forEach(u => u && map.set(u.id || u.email || u.name, u));
          (baseEligibleUsers || []).forEach(u => u && map.set(u.id || u.email || u.name, u));
          return Array.from(map.values());
        })()}
        records={records}
        customHolidays={customHolidays}
      />

      {/* MODAL GERENCIADOR DE COLABORADORES REMOVIDOS DO RELÓGIO */}
      {isExcludedModalOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-fadeIn">
          <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center">
                  <UserX size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black uppercase tracking-tight">Colaboradores Ocultos do Relógio</h3>
                  <p className="text-xs text-slate-400 font-medium">Usuários removidos do monitoramento e dos relatórios de ponto</p>
                </div>
              </div>
              <button
                onClick={() => setIsExcludedModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer p-1"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {excludedUsersList.length === 0 ? (
                <div className="text-center py-10 space-y-3">
                  <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
                    <CheckCircle2 size={24} className="text-emerald-500" />
                  </div>
                  <p className="text-sm font-bold text-slate-700">Nenhum colaborador está oculto no momento.</p>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Todos os colaboradores elegíveis estão sendo monitorados normalmente no relógio de ponto.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-slate-600 font-medium">
                    Os seguintes colaboradores foram removidos da lista de ponto. Eles não aparecerão no dashboard, alertas ou relatórios até serem restaurados:
                  </p>
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-slate-50/50">
                    {excludedUsersList.map(u => (
                      <div key={u.id} className="p-4 flex items-center justify-between hover:bg-white transition-colors">
                        <div className="flex items-center space-x-3">
                          <img
                            src={u.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=random`}
                            alt={u.name}
                            referrerPolicy="no-referrer"
                            className="w-10 h-10 rounded-xl object-cover border border-slate-200"
                          />
                          <div>
                            <h4 className="text-xs font-black text-slate-900 uppercase">{u.name}</h4>
                            <p className="text-[10px] text-slate-400 font-bold uppercase">{u.email} • {u.role || 'Colaborador'}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRestoreUserToTimeClock(u.id, u.name)}
                          className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 rounded-xl text-xs font-black uppercase flex items-center space-x-1 cursor-pointer transition-colors shadow-2xs"
                        >
                          <RotateCcw size={13} />
                          <span>Restaurar</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              {excludedUsersList.length > 0 ? (
                <button
                  onClick={handleClearAllExcludedUsers}
                  className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-black uppercase transition-all flex items-center space-x-1.5 cursor-pointer"
                >
                  <RotateCcw size={14} />
                  <span>Restaurar Todos</span>
                </button>
              ) : <div />}

              <button
                onClick={() => setIsExcludedModalOpen(false)}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black uppercase cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE RELAÇÃO / DETALHAMENTO DO CARD DE KPI CLICADO */}
      {dashboardKpiRelationData && (
        <div className="fixed inset-0 z-[130] bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] shadow-2xl border border-slate-100 flex flex-col overflow-hidden animate-scaleUp">
            {/* Header Modal */}
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
              <div className="flex items-center space-x-3.5">
                <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-[#00A1E4]">
                  {React.createElement(dashboardKpiRelationData.icon, { size: 24 })}
                </div>
                <div>
                  <div className="flex items-center space-x-2.5">
                    <h3 className="text-lg font-black uppercase tracking-tight text-white">
                      {dashboardKpiRelationData.title}
                    </h3>
                    <span className="px-3 py-0.5 rounded-full bg-[#00A1E4]/20 border border-[#00A1E4]/40 text-[#00A1E4] text-xs font-black uppercase tracking-wider">
                      {dashboardKpiRelationData.badge}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">
                    {dashboardKpiRelationData.subtitle}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedDashboardKpiModal(null)}
                className="w-10 h-10 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
                title="Fechar (ESC)"
              >
                <X size={20} />
              </button>
            </div>

            {/* Toolbar de Busca e Ações Rápidas */}
            <div className="p-4 bg-slate-50 border-b border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
              <div className="relative w-full sm:w-96">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={kpiModalSearch}
                  onChange={(e) => setKpiModalSearch(e.target.value)}
                  placeholder="Filtrar por nome, cargo ou departamento..."
                  className="w-full pl-10 pr-9 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#00A1E4] focus:ring-2 focus:ring-[#00A1E4]/20 transition-all"
                />
                {kpiModalSearch && (
                  <button
                    onClick={() => setKpiModalSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              <div className="flex items-center space-x-2 w-full sm:w-auto justify-between sm:justify-end">
                <span className="text-xs font-black text-slate-500 uppercase tracking-wide">
                  Exibindo <span className="text-slate-900">{dashboardKpiRelationData.items.length}</span> de <span className="text-slate-900">{dashboardKpiRelationData.rawTotalCount}</span>
                </span>

                {dashboardKpiRelationData.type === 'atrasados' && (
                  <button
                    onClick={() => {
                      setStatusFilter('Atrasado');
                      setSelectedDashboardKpiModal(null);
                      showToast('Filtro da tabela principal ajustado para Atrasados.');
                    }}
                    className="px-3 py-1.5 bg-orange-100 hover:bg-orange-200 border border-orange-200 text-orange-800 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer"
                  >
                    Filtrar Tabela
                  </button>
                )}

                {dashboardKpiRelationData.type === 'ausentes' && (
                  <button
                    onClick={() => {
                      setStatusFilter('Ausente');
                      setSelectedDashboardKpiModal(null);
                      showToast('Filtro da tabela principal ajustado para Ausentes.');
                    }}
                    className="px-3 py-1.5 bg-rose-100 hover:bg-rose-200 border border-rose-200 text-rose-800 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer"
                  >
                    Filtrar Tabela
                  </button>
                )}

                {dashboardKpiRelationData.type === 'almoco' && (
                  <button
                    onClick={() => {
                      setStatusFilter('Em Almoço');
                      setSelectedDashboardKpiModal(null);
                      showToast('Filtro da tabela principal ajustado para Em Almoço.');
                    }}
                    className="px-3 py-1.5 bg-amber-100 hover:bg-amber-200 border border-amber-200 text-amber-800 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer"
                  >
                    Filtrar Tabela
                  </button>
                )}
              </div>
            </div>

            {/* Conteúdo Principal / Lista dos Colaboradores */}
            <div className="p-6 overflow-y-auto space-y-3.5 flex-1 bg-slate-50/40">
              {dashboardKpiRelationData.items.length === 0 ? (
                <div className="text-center py-16 space-y-4 bg-white rounded-3xl border border-dashed border-slate-200 p-8">
                  <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto text-emerald-500 border border-emerald-100">
                    <CheckCircle2 size={32} />
                  </div>
                  <div>
                    <h4 className="text-base font-black text-slate-900 uppercase tracking-tight">
                      {kpiModalSearch ? 'Nenhum colaborador encontrado com esta busca' : 'Nenhuma ocorrência registrada'}
                    </h4>
                    <p className="text-xs text-slate-500 font-medium max-w-md mx-auto mt-1">
                      {kpiModalSearch 
                        ? 'Tente utilizar outros termos para buscar o colaborador desejado.' 
                        : dashboardKpiRelationData.type === 'atrasados' 
                          ? 'Excelente! Nenhum colaborador registrou atraso nesta data.'
                          : dashboardKpiRelationData.type === 'ausentes'
                            ? 'Equipe completa! Todos os colaboradores registraram entrada normalmente.'
                            : 'Nenhum registro correspondente no momento para este indicador.'
                      }
                    </p>
                  </div>
                  {kpiModalSearch && (
                    <button
                      onClick={() => setKpiModalSearch('')}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer"
                    >
                      Limpar Busca
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {dashboardKpiRelationData.items.map((item, idx) => (
                    <div
                      key={item.user.id || `kpi-item-${idx}`}
                      className="p-4 bg-white hover:bg-slate-50/80 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:border-[#00A1E4]/50 group"
                    >
                      {/* Avatar e Dados do Colaborador */}
                      <div className="flex items-center space-x-3.5 min-w-[240px]">
                        <img
                          src={
                            item.user.email?.toLowerCase().includes('yasmin')
                              ? 'https://i.imgur.com/m4WqE5P.png'
                              : (item.user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.user.name)}&background=random`)
                          }
                          alt={item.user.name}
                          referrerPolicy="no-referrer"
                          className="w-12 h-12 rounded-2xl object-cover border border-slate-200 shadow-2xs shrink-0"
                        />
                        <div>
                          <div className="flex items-center space-x-2">
                            <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight group-hover:text-[#00A1E4] transition-colors">
                              {item.user.name}
                            </h4>
                            <span className={`px-2 py-0.5 rounded-md border text-[10px] font-black uppercase ${item.statusColor}`}>
                              {item.status}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 font-bold uppercase mt-0.5">
                            {item.user.role || 'Colaborador'} • <span className="text-slate-600">{item.user.department || 'Geral'}</span>
                          </p>
                          <p className="text-[10px] text-slate-500 font-medium mt-1">
                            {item.secondaryInfo}
                          </p>
                        </div>
                      </div>

                      {/* Métrica de Destaque da Relação */}
                      <div className="flex items-center sm:text-right justify-between sm:justify-end gap-4 shrink-0 border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100">
                        <div className="text-left sm:text-right">
                          <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
                            {item.highlightLabel}
                          </span>
                          <span className={`text-base font-black tracking-tight ${item.highlightColor}`}>
                            {item.highlightValue}
                          </span>
                        </div>

                        <button
                          onClick={() => {
                            setSelectedDashboardKpiModal(null);
                            setSelectedEmployeeForDrawer(item.user);
                          }}
                          className="px-4 py-2.5 bg-slate-900 hover:bg-[#00A1E4] text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center space-x-1.5 cursor-pointer transition-all shadow-sm hover:scale-[1.02] active:scale-95 shrink-0"
                          title="Abrir cartão ponto completo e espelho de ponto"
                        >
                          <span>Ver Cartão</span>
                          <ChevronRight size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer Modal */}
            <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-2 text-xs font-bold text-slate-500">
                <Info size={16} className="text-[#00A1E4]" />
                <span>Clique em <strong>Ver Cartão</strong> para visualizar o espelho mensal e histórico completo do colaborador.</span>
              </div>

              <button
                onClick={() => setSelectedDashboardKpiModal(null)}
                className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer transition-colors shadow-2xs"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
