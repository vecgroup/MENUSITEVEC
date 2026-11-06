import React, { useState, useMemo, useRef } from 'react';
import { 
  FileSpreadsheet, 
  Printer, 
  Download, 
  X, 
  Building2, 
  Users, 
  CheckSquare, 
  Square, 
  Filter, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Calendar, 
  Paperclip, 
  FolderArchive, 
  Layers, 
  Search,
  ChevronRight,
  ShieldAlert,
  Clock,
  UserCheck
} from 'lucide-react';
import { User, PunchRecord, Attachment, UserRole, UserStatus } from '../types';
import { isDateBeforeUserAdmission } from '../lib/userDateUtils';
import JSZip from 'jszip';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

declare const XLSX: any;

interface MonthlyReportDpModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  allUsers: User[];
  records: PunchRecord[];
  customHolidays?: Record<string, string>;
}

export const MonthlyReportDpModal: React.FC<MonthlyReportDpModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  allUsers,
  records,
  customHolidays = {}
}) => {
  if (!isOpen) return null;

  const pdfRef = useRef<HTMLDivElement>(null);

  // Form State
  const [competencia, setCompetencia] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const [empresa, setEmpresa] = useState<string>('VEC GROUP (Consolidado)');
  const [filial, setFilial] = useState<string>('Todas as Filiais');
  const [departamento, setDepartamento] = useState<string>('Todos os Departamentos');
  const [supervisorFilter, setSupervisorFilter] = useState<string>('Todos os Supervisores');
  
  const [colaboradoresMode, setColaboradoresMode] = useState<'all' | 'specific'>('all');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [employeeSearch, setEmployeeSearch] = useState<string>('');

  // Export Types
  const [exportExcel, setExportExcel] = useState<boolean>(true);
  const [exportPdf, setExportPdf] = useState<boolean>(true);
  const [exportCsv, setExportCsv] = useState<boolean>(true);

  // Attachment Options
  const [includeAtestados, setIncludeAtestados] = useState<boolean>(true);
  const [includeJustificativas, setIncludeJustificativas] = useState<boolean>(false);
  const [includeDocumentos, setIncludeDocumentos] = useState<boolean>(false);

  // Grouping
  const [agrupamento, setAgrupamento] = useState<'unico' | 'por_colaborador'>('unico');

  // Loading state
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [progressMsg, setProgressMsg] = useState<string>('');

  // Helper functions to identify eligible active employees (vendedores, consultores e administradores) for the report
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

  const isEligibleEmployee = (u: User) => {
    if (!u) return false;

    // Se for especificamente Rafael Pasqual ou Sabrina Sena, sempre incluir no relatório
    if (isRafaelOrSabrina(u)) return true;

    const statusStr = (u.status || '').toUpperCase();
    const isActive = !statusStr || statusStr === 'ATIVO' || statusStr === 'ACTIVE';
    if (!isActive) return false;

    if (isPartnerUser(u)) return false;
    if (isExternalSalesperson(u)) return false;

    // Perfis de Administrador (como Rafael Pasqual, Sabrina Sena e outros administradores) são elegíveis para o ponto
    if (isAdministratorUser(u)) return true;

    const roleUpper = (u.role || '').toUpperCase();
    const roleLower = (u.role || '').toLowerCase();
    if (roleUpper === 'OWNER' || roleUpper === 'SUPERVISOR' || roleUpper === 'ADVOGADO') return false;

    const isVendedor = roleUpper === 'VENDEDOR' || roleLower.includes('vended') || roleLower.includes('vendas') || roleLower.includes('comercial');
    return isVendedor;
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
      const rName = r.userName.toLowerCase().trim();
      const uName = targetUser.name.toLowerCase().trim();
      if (rName === uName && rName.length > 2) return true;

      const rIsRafael = rName.includes('rafael') && rName.includes('pasqual');
      const uIsRafael = uName.includes('rafael') && uName.includes('pasqual');
      if (rIsRafael && uIsRafael) return true;

      const rIsSabrina = rName.includes('sabrina') && rName.includes('sena');
      const uIsSabrina = uName.includes('sabrina') && uName.includes('sena');
      if (rIsSabrina && uIsSabrina) return true;

      if (r.userId && targetUser.id && String(r.userId).toLowerCase().trim() !== String(targetUser.id).toLowerCase().trim()) {
        return false;
      }

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

  // Base list of active non-partner colaboradores (vendedores e administradores)
  const eligibleEmployees = useMemo(() => {
    const userMap = new Map<string, User>();

    const getUserKey = (u: Partial<User>) => {
      if (u.id) return `id:${u.id}`;
      if (u.email) return `email:${u.email.toLowerCase().trim()}`;
      if (u.name) return `name:${u.name.toLowerCase().trim()}`;
      return '';
    };

    (allUsers || []).forEach(u => {
      if (u && isEligibleEmployee(u)) {
        const key = getUserKey(u) || `user-${userMap.size}`;
        if (!userMap.has(key)) {
          userMap.set(key, u);
        }
      }
    });

    // Também verificar se há registros de Rafael Pasqual ou Sabrina Sena ou administradores em records que não estejam em allUsers
    (records || []).forEach(r => {
      if (r.userId || r.userName) {
        const matched = (allUsers || []).find(u => isUserMatch(r, u));
        if (matched && isEligibleEmployee(matched)) {
          const key = getUserKey(matched) || `user-${userMap.size}`;
          if (!userMap.has(key)) userMap.set(key, matched);
        } else if (r.userName) {
          const norm = r.userName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          const isRafael = norm.includes('rafael') && norm.includes('pasqual');
          const isSabrina = norm.includes('sabrina') && norm.includes('sena');

          if (isRafael || isSabrina) {
            // Verifica se já temos alguém com esse perfil em userMap
            const alreadyExists = Array.from(userMap.values()).some(existing => {
              const eNorm = (existing.name || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
              if (isRafael && eNorm.includes('rafael') && eNorm.includes('pasqual')) return true;
              if (isSabrina && eNorm.includes('sabrina') && eNorm.includes('sena')) return true;
              return false;
            });

            if (!alreadyExists) {
              const tempUser: User = {
                id: r.userId || `usr-${Date.now()}-${Math.random()}`,
                name: r.userName,
                email: (r as any).userEmail || (isRafael ? 'rafael@vecgroup.com.br' : 'sabrina@vecgroup.com.br'),
                role: UserRole.ADMIN_ALT,
                status: UserStatus.ACTIVE,
                department: 'Administrativo',
                avatar: r.userAvatar
              };
              const key = getUserKey(tempUser);
              if (!userMap.has(key)) userMap.set(key, tempUser);
            }
          }
        }
      }
    });

    return Array.from(userMap.values());
  }, [allUsers, records]);

  // Unique lists for dropdowns
  const availableDepartments = useMemo(() => {
    const depts = new Set<string>();
    depts.add('Todos os Departamentos');
    eligibleEmployees.forEach(u => {
      if (u.department) depts.add(u.department);
      else if (isAdministratorUser(u)) depts.add('Administrativo');
      else depts.add('Comercial');
    });
    return Array.from(depts);
  }, [eligibleEmployees]);

  const availableSupervisors = useMemo(() => {
    const supers = allUsers.filter(u => ['SUPERVISOR', 'OWNER', 'ADMIN', 'ADMINISTRATIVO'].includes((u.role || '').toUpperCase()));
    return supers;
  }, [allUsers]);

  // Filtered employees list for selection
  const filteredEmployeesForSelection = useMemo(() => {
    return eligibleEmployees.filter(u => {
      const userDept = u.department || (isAdministratorUser(u) ? 'Administrativo' : 'Comercial');
      const userRole = u.role || (isAdministratorUser(u) ? 'Administrador' : 'Vendedor');
      const matchSearch = u.name.toLowerCase().includes(employeeSearch.toLowerCase()) || 
                          userDept.toLowerCase().includes(employeeSearch.toLowerCase()) ||
                          userRole.toLowerCase().includes(employeeSearch.toLowerCase());
      const matchDept = departamento === 'Todos os Departamentos' || userDept === departamento;
      return matchSearch && matchDept;
    });
  }, [eligibleEmployees, employeeSearch, departamento]);

  // Target Employees for report
  const targetEmployees = useMemo(() => {
    let list = eligibleEmployees;
    if (departamento !== 'Todos os Departamentos') {
      list = list.filter(u => (u.department || (isAdministratorUser(u) ? 'Administrativo' : 'Comercial')) === departamento);
    }
    if (colaboradoresMode === 'specific') {
      if (selectedUserIds.length === 0) return list;
      list = list.filter(u => selectedUserIds.includes(u.id));
    }
    return list;
  }, [eligibleEmployees, departamento, colaboradoresMode, selectedUserIds]);

  // Calculations Helpers
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

  // Easter and Holidays
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

  const getHolidayName = (dateStr: string): string | null => {
    if (customHolidays[dateStr]) return customHolidays[dateStr];
    const [y, m, d] = dateStr.split('-').map(Number);
    const fixedHolidays: Record<string, string> = {
      '01-01': 'Ano Novo',
      '04-21': 'Tiradentes',
      '05-01': 'Dia do Trabalhador',
      '09-07': 'Independência do Brasil',
      '10-12': 'Nossa Senhora Aparecida',
      '11-02': 'Finados',
      '11-15': 'Proclamação da República',
      '11-20': 'Consciência Negra',
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
      [formatDateKey(addDays(easter, -48))]: 'Carnaval',
      [formatDateKey(addDays(easter, -47))]: 'Carnaval',
      [formatDateKey(addDays(easter, -2))]: 'Sexta-feira Santa',
      [formatDateKey(easter)]: 'Páscoa',
      [formatDateKey(addDays(easter, 60))]: 'Corpus Christi',
    };
    return variableHolidays[dateStr] || null;
  };

  // Compile monthly report data per employee
  const reportDataPerEmployee = useMemo(() => {
    const [year, month] = competencia.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    return targetEmployees.map(emp => {
      let totalWorkedMins = 0;
      let totalExpectedMins = 0;
      let totalOvertimeMins = 0;
      let totalAbsenceMins = 0;
      
      let diasTrabalhados = 0;
      let diasFolga = 0;
      let diasFerias = 0;
      let faltasJustificadas = 0;
      let faltasInjustificadas = 0;
      let qtdAtestados = 0;
      let qtdAtrasos = 0;
      let pontosIncompletos = 0;

      const dailyRecords = [];
      const attachmentsList: { name: string; url: string; date: string; type: 'atestado' | 'justificativa' }[] = [];

      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dateObj = new Date(year, month - 1, day);
        const dayOfWeek = dateObj.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const isFriday = dayOfWeek === 5;
        const holidayName = getHolidayName(dateStr);
        const isHoliday = !!holidayName;

        const isBeforeAdmission = isDateBeforeUserAdmission(dateStr, emp, records);
        const expectedEntryMins = 480;
        const expectedLunchStartMins = 720;
        const expectedLunchReturnMins = 780;
        const expectedExitMins = isFriday ? 1020 : 1080;
        const expectedWorkMins = (isWeekend || isHoliday || isBeforeAdmission) ? 0 : (isFriday ? 480 : 540);
        totalExpectedMins += expectedWorkMins;

        const rec = records.find(r => isUserMatch(r, emp) && matchesDate(r.date, dateStr));

        let entry = rec?.entry || '--:--';
        let lunchStart = rec?.lunchStart || '--:--';
        let lunchReturn = rec?.lunchReturn || '--:--';
        let exit = rec?.exit || '--:--';

        const entryMins = parseToMinutes(rec?.entry);
        const lunchStartMins = parseToMinutes(rec?.lunchStart);
        const lunchReturnMins = parseToMinutes(rec?.lunchReturn);
        const exitMins = parseToMinutes(rec?.exit);

        const applyTolerance = (mins: number | null, targetMins: number, tolerance: number = 15): number | null => {
          if (mins === null) return null;
          if (Math.abs(mins - targetMins) <= tolerance) return targetMins;
          return mins;
        };

        const effectiveEntryMins = applyTolerance(entryMins, expectedEntryMins);
        const effectiveLunchStartMins = applyTolerance(lunchStartMins, expectedLunchStartMins);
        const effectiveLunchReturnMins = applyTolerance(lunchReturnMins, expectedLunchReturnMins);
        const effectiveExitMins = applyTolerance(exitMins, expectedExitMins);

        let dayWorkedMins = 0;
        let dayDelayMins = 0;
        let dayOvertimeMins = 0;
        let dayAbsenceMins = 0;
        let statusLabel = 'OK';
        let statusBadgeClass = 'bg-emerald-100 text-emerald-800';

        if (isHoliday) {
          statusLabel = `Feriado: ${holidayName}`;
          statusBadgeClass = 'bg-purple-100 text-purple-800';
          diasFolga++;
        } else if (isWeekend) {
          statusLabel = 'Folga';
          statusBadgeClass = 'bg-slate-100 text-slate-600';
          diasFolga++;
        } else if (rec) {
          // Has punch record
          if (entryMins !== null && entryMins > 480 + 15) {
            dayDelayMins = entryMins - 480;
            qtdAtrasos++;
          }

          const hasJustification = !!(rec.justificationReason && rec.justificationReason.trim());
          const hasMedicalCert = !!rec.hasMedicalCertificate;

          if (hasMedicalCert) {
            dayWorkedMins = expectedWorkMins;
            diasTrabalhados++;
          } else {
            if (effectiveEntryMins !== null && effectiveExitMins !== null) {
              let lunchSpan = 60;
              if (effectiveLunchStartMins !== null && effectiveLunchReturnMins !== null) {
                lunchSpan = Math.max(30, effectiveLunchReturnMins - effectiveLunchStartMins);
              }
              dayWorkedMins = Math.max(0, (effectiveExitMins - effectiveEntryMins) - lunchSpan);
              diasTrabalhados++;
            } else if (effectiveEntryMins !== null && effectiveLunchStartMins !== null) {
              let morningSpan = Math.max(0, effectiveLunchStartMins - effectiveEntryMins);
              let afternoonSpan = 0;
              if (effectiveLunchReturnMins !== null && effectiveExitMins !== null) {
                afternoonSpan = Math.max(0, effectiveExitMins - effectiveLunchReturnMins);
              }
              dayWorkedMins = morningSpan + afternoonSpan;
              if (dayWorkedMins > 0) diasTrabalhados++;
            } else if (effectiveEntryMins !== null && !exitMins && dateStr < todayStr) {
              if (!hasJustification && !hasMedicalCert) {
                pontosIncompletos++;
                statusLabel = 'Ponto Incompleto';
                statusBadgeClass = 'bg-amber-100 text-amber-800';
              }
            }
          }

          let rawBalance = 0;
          if (hasMedicalCert) {
            rawBalance = 0; // Abonado pelo atestado
          } else {
            rawBalance = dayWorkedMins - expectedWorkMins;
            if (Math.abs(rawBalance) <= 15) {
              rawBalance = 0;
            }
          }

          if (rawBalance > 0) {
            dayOvertimeMins = rawBalance;
          } else if (rawBalance < 0) {
            dayAbsenceMins = Math.abs(rawBalance);
          }

          if (hasMedicalCert) {
            qtdAtestados++;
            statusLabel = 'Atestado';
            statusBadgeClass = 'bg-blue-100 text-blue-800';
            if (rec.medicalCertificateAttachment) {
              attachmentsList.push({
                name: rec.medicalCertificateAttachment.name || `Atestado_${dateStr}.pdf`,
                url: rec.medicalCertificateAttachment.url,
                date: dateStr,
                type: 'atestado'
              });
            }
          } else if (hasJustification) {
            statusLabel = 'Justificado';
            statusBadgeClass = 'bg-amber-100 text-amber-800';
            attachmentsList.push({
              name: `Justificativa_${dateStr}.txt`,
              url: `data:text/plain;charset=utf-8,Justificativa em ${dateStr}: ${encodeURIComponent(rec.justificationReason!)}`,
              date: dateStr,
              type: 'justificativa'
            });
          } else if (dayDelayMins > 0) {
            statusLabel = 'Atraso';
            statusBadgeClass = 'bg-amber-100 text-amber-800';
          } else if (dayOvertimeMins > 0) {
            statusLabel = 'Hora Extra';
            statusBadgeClass = 'bg-blue-100 text-blue-800';
          } else if (dayWorkedMins > 0) {
            statusLabel = 'OK';
            statusBadgeClass = 'bg-emerald-100 text-emerald-800';
          }
        } else {
          // No record
          if (isBeforeAdmission) {
            statusLabel = 'Não admitido / Não cadastrado';
            statusBadgeClass = 'bg-slate-100 text-slate-400';
            dayAbsenceMins = 0;
          } else if (dateStr < todayStr) {
            statusLabel = 'Falta Injustificada';
            statusBadgeClass = 'bg-rose-100 text-rose-800';
            faltasInjustificadas++;
            dayAbsenceMins = expectedWorkMins;
          } else {
            statusLabel = 'Aguardando';
            statusBadgeClass = 'bg-slate-100 text-slate-500';
          }
        }

        totalWorkedMins += dayWorkedMins;
        totalOvertimeMins += dayOvertimeMins;
        totalAbsenceMins += dayAbsenceMins;

        dailyRecords.push({
          date: `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}`,
          dateFull: dateStr,
          entry,
          lunchStart,
          lunchReturn,
          exit,
          workedMins: dayWorkedMins,
          workedStr: formatMinutesToHours(dayWorkedMins),
          absenceStr: formatMinutesToHours(dayAbsenceMins),
          overtimeStr: formatMinutesToHours(dayOvertimeMins),
          status: statusLabel,
          statusBadgeClass
        });
      }

      const bancoFinalMins = totalOvertimeMins - totalAbsenceMins;
      const bancoFinalStr = formatMinutesToHours(bancoFinalMins, true);

      let statusGeral: 'Verde' | 'Amarelo' | 'Vermelho' = 'Verde';
      if (faltasInjustificadas > 0 || pontosIncompletos > 0 || bancoFinalMins <= -240) {
        statusGeral = 'Vermelho';
      } else if (qtdAtrasos > 2 || bancoFinalMins < 0) {
        statusGeral = 'Amarelo';
      }

      return {
        employee: emp,
        competencia,
        dailyRecords,
        totalWorkedMins,
        totalExpectedMins,
        totalOvertimeMins,
        totalAbsenceMins,
        bancoFinalMins,
        workedStr: formatMinutesToHours(totalWorkedMins),
        expectedStr: formatMinutesToHours(totalExpectedMins),
        overtimeStr: formatMinutesToHours(totalOvertimeMins),
        absenceStr: formatMinutesToHours(totalAbsenceMins),
        bancoFinalStr,
        diasTrabalhados,
        diasFolga,
        diasFerias,
        faltasJustificadas,
        faltasInjustificadas,
        totalFaltas: faltasJustificadas + faltasInjustificadas,
        qtdAtestados,
        qtdAtrasos,
        pontosIncompletos,
        statusGeral,
        attachmentsList
      };
    });
  }, [targetEmployees, competencia, records, customHolidays]);

  // Company Totals
  const companyTotals = useMemo(() => {
    let totalWorked = 0;
    let totalExpected = 0;
    let totalExtras = 0;
    let totalNegativas = 0;
    let totalBancoMins = 0;
    let totalFaltas = 0;
    let totalAtestados = 0;
    let totalAtrasos = 0;

    reportDataPerEmployee.forEach(item => {
      totalWorked += item.totalWorkedMins;
      totalExpected += item.totalExpectedMins;
      totalExtras += item.totalOvertimeMins;
      totalNegativas += item.totalAbsenceMins;
      totalBancoMins += item.bancoFinalMins;
      totalFaltas += item.totalFaltas;
      totalAtestados += item.qtdAtestados;
      totalAtrasos += item.qtdAtrasos;
    });

    return {
      totalColaboradores: reportDataPerEmployee.length,
      totalWorkedStr: formatMinutesToHours(totalWorked),
      totalExpectedStr: formatMinutesToHours(totalExpected),
      totalExtrasStr: formatMinutesToHours(totalExtras),
      totalNegativasStr: formatMinutesToHours(totalNegativas),
      totalBancoStr: formatMinutesToHours(totalBancoMins, true),
      totalFaltas,
      totalAtestados,
      totalAtrasos
    };
  }, [reportDataPerEmployee]);

  // Handle Export Process
  const handleExport = async () => {
    if (!exportExcel && !exportPdf && !exportCsv) {
      alert('Por favor, selecione ao menos um tipo de exportação (Excel, PDF ou CSV).');
      return;
    }

    setIsGenerating(true);
    setProgressMsg('Processando e gerando relatórios de Departamento Pessoal...');

    try {
      const zip = new JSZip();
      const folderName = `Relatorio DP - ${competencia}`;
      const rootFolder = zip.folder(folderName);

      // 1. GENERATE EXCEL (.XLSX)
      if (exportExcel) {
        setProgressMsg('Construindo planilha Excel com abas e resumos...');
        
        if (typeof XLSX !== 'undefined') {
          const wb = XLSX.utils.book_new();

          // ABA 1: RESUMO GERAL
          const resumoData: any[][] = [
            ['VEC GROUP - RELATÓRIO DE DEPARTAMENTO PESSOAL / FOLHA DE PAGAMENTO'],
            ['Competência:', competencia, 'Empresa:', empresa, 'Filial:', filial, 'Departamento:', departamento],
            ['Data de Emissão:', new Date().toLocaleDateString('pt-BR'), 'Gerado Por:', currentUser.name],
            [],
            ['RESUMO GERAL DOS COLABORADORES'],
            ['Funcionário', 'Cargo', 'Departamento', 'Carga Prevista', 'Carga Trabalhada', 'Horas Extras', 'Horas Falta', 'Banco Final', 'Atrasos', 'Faltas', 'Atestados', 'Status Geral']
          ];

          reportDataPerEmployee.forEach(r => {
            const empRole = r.employee.role || (isAdministratorUser(r.employee) ? 'Administrador' : 'Vendedor');
            const empDept = r.employee.department || (isAdministratorUser(r.employee) ? 'Administrativo' : 'Comercial');
            resumoData.push([
              r.employee.name,
              empRole,
              empDept,
              r.expectedStr,
              r.workedStr,
              r.overtimeStr,
              r.absenceStr,
              r.bancoFinalStr,
              r.qtdAtrasos,
              r.totalFaltas,
              r.qtdAtestados > 0 ? `Sim (${r.qtdAtestados})` : 'Não',
              r.statusGeral
            ]);
          });

          resumoData.push([]);
          resumoData.push([
            'TOTAIS DA EMPRESA',
            `${companyTotals.totalColaboradores} Colaboradores`,
            '',
            companyTotals.totalExpectedStr,
            companyTotals.totalWorkedStr,
            companyTotals.totalExtrasStr,
            companyTotals.totalNegativasStr,
            companyTotals.totalBancoStr,
            companyTotals.totalAtrasos,
            companyTotals.totalFaltas,
            companyTotals.totalAtestados,
            ''
          ]);

          const wsResumo = XLSX.utils.aoa_to_sheet(resumoData);
          XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo Geral');

          // ABA 2: DETALHAMENTO DAS JORNADAS
          if (agrupamento === 'unico') {
            const detalhamentoData: any[][] = [];

            reportDataPerEmployee.forEach(r => {
              const empRole = r.employee.role || (isAdministratorUser(r.employee) ? 'Administrador' : 'Vendedor');
              const empDept = r.employee.department || (isAdministratorUser(r.employee) ? 'Administrativo' : 'Comercial');
              detalhamentoData.push(['FUNCIONÁRIO:', r.employee.name]);
              detalhamentoData.push(['Cargo:', empRole, 'Departamento:', empDept, 'Competência:', competencia]);
              detalhamentoData.push([]);
              detalhamentoData.push(['Data', 'Entrada', 'Almoço (S)', 'Almoço (V)', 'Saída', 'Horas Trabalhadas', 'Horas Falta', 'Horas Extras', 'Status']);

              r.dailyRecords.forEach(d => {
                detalhamentoData.push([
                  d.date,
                  d.entry,
                  d.lunchStart,
                  d.lunchReturn,
                  d.exit,
                  d.workedStr,
                  d.absenceStr,
                  d.overtimeStr,
                  d.status
                ]);
              });

              detalhamentoData.push(['RESUMO DO COLABORADOR']);
              detalhamentoData.push(['Dias Trabalhados:', r.diasTrabalhados, 'Faltas Justificadas:', r.faltasJustificadas, 'TOTAL HORAS FALTANTES:', r.absenceStr]);
              detalhamentoData.push(['Dias de Folga:', r.diasFolga, 'Faltas Injustificadas:', r.faltasInjustificadas, 'TOTAL HORAS EXTRAS:', r.overtimeStr]);
              detalhamentoData.push(['Dias de Férias:', r.diasFerias, 'Atestados:', r.qtdAtestados, 'BANCO FINAL:', r.bancoFinalStr]);
              detalhamentoData.push(['Atrasos:', r.qtdAtrasos, 'Carga Prevista:', r.expectedStr, 'Carga Trabalhada:', r.workedStr]);
              detalhamentoData.push([], ['---------------------------------------------------------------------------------------------------'], []);
            });

            const wsDetalhamento = XLSX.utils.aoa_to_sheet(detalhamentoData);
            XLSX.utils.book_append_sheet(wb, wsDetalhamento, 'Detalhamento Ponto');
          } else {
            // Um relatório por colaborador (aba por colaborador)
            reportDataPerEmployee.forEach(r => {
              const empRole = r.employee.role || (isAdministratorUser(r.employee) ? 'Administrador' : 'Vendedor');
              const empDept = r.employee.department || (isAdministratorUser(r.employee) ? 'Administrativo' : 'Comercial');
              const sheetData: any[][] = [
                ['FUNCIONÁRIO:', r.employee.name],
                ['Cargo:', empRole, 'Departamento:', empDept, 'Competência:', competencia],
                [],
                ['Data', 'Entrada', 'Almoço (S)', 'Almoço (V)', 'Saída', 'Horas Trabalhadas', 'Horas Falta', 'Horas Extras', 'Status']
              ];

              r.dailyRecords.forEach(d => {
                sheetData.push([
                  d.date,
                  d.entry,
                  d.lunchStart,
                  d.lunchReturn,
                  d.exit,
                  d.workedStr,
                  d.absenceStr,
                  d.overtimeStr,
                  d.status
                ]);
              });

              sheetData.push([]);
              sheetData.push(['RESUMO DO COLABORADOR']);
              sheetData.push(['Dias Trabalhados:', r.diasTrabalhados, 'Faltas Justificadas:', r.faltasJustificadas, 'TOTAL HORAS FALTANTES:', r.absenceStr]);
              sheetData.push(['Dias de Folga:', r.diasFolga, 'Faltas Injustificadas:', r.faltasInjustificadas, 'TOTAL HORAS EXTRAS:', r.overtimeStr]);
              sheetData.push(['Dias de Férias:', r.diasFerias, 'Atestados:', r.qtdAtestados, 'BANCO FINAL:', r.bancoFinalStr]);
              sheetData.push(['Atrasos:', r.qtdAtrasos, 'Carga Prevista:', r.expectedStr, 'Carga Trabalhada:', r.workedStr]);

              const cleanSheetName = r.employee.name.replace(/[*?:/\\\[\]]/g, '').slice(0, 25);
              const wsEmp = XLSX.utils.aoa_to_sheet(sheetData);
              XLSX.utils.book_append_sheet(wb, wsEmp, cleanSheetName);
            });
          }

          const excelArrayBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
          if (rootFolder) {
            rootFolder.file('Relatorio_Geral_Ponto.xlsx', excelArrayBuffer);
          }
        }
      }

      // 2. GENERATE CSV
      if (exportCsv) {
        setProgressMsg('Gerando arquivo CSV estruturado...');
        const csvRows = [
          ['Funcionário', 'Data', 'Entrada', 'Almoço Saida', 'Almoço Retorno', 'Saída', 'Horas Trabalhadas', 'Horas Falta', 'Horas Extras', 'Status'].join(';')
        ];

        reportDataPerEmployee.forEach(r => {
          r.dailyRecords.forEach(d => {
            csvRows.push([
              `"${r.employee.name}"`,
              d.dateFull,
              d.entry,
              d.lunchStart,
              d.lunchReturn,
              d.exit,
              d.workedStr,
              d.absenceStr,
              d.overtimeStr,
              d.status
            ].join(';'));
          });
        });

        const csvString = "\ufeff" + csvRows.join('\n');
        if (rootFolder) {
          rootFolder.file('Relatorio_Ponto.csv', csvString);
        }
      }

      // 3. GENERATE PDF EXECUTIVO
      if (exportPdf) {
        setProgressMsg('Formatando PDF Executivo para Contabilidade / Diretoria...');
        if (pdfRef.current) {
          const canvas = await html2canvas(pdfRef.current, { scale: 2, useCORS: true });
          const imgData = canvas.toDataURL('image/png');
          const pdf = new jsPDF('p', 'mm', 'a4');
          const pdfWidth = pdf.internal.pageSize.getWidth();
          const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
          
          pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
          const pdfBlob = pdf.output('blob');

          if (rootFolder) {
            rootFolder.file('Resumo_Executivo_Contabilidade.pdf', pdfBlob);
          }
        }
      }

      // 4. INCLUDE ATTACHMENTS (ATESTADOS & JUSTIFICATIVAS)
      if (includeAtestados || includeJustificativas || includeDocumentos) {
        setProgressMsg('Organizando anexos e atestados médicos dos colaboradores...');
        const atestadosFolder = rootFolder?.folder('Atestados_e_Justificativas');

        for (const item of reportDataPerEmployee) {
          if (item.attachmentsList.length > 0) {
            const empFolder = atestadosFolder?.folder(item.employee.name);

            for (const att of item.attachmentsList) {
              if (att.type === 'justificativa' && includeJustificativas) {
                const textContent = att.url.replace('data:text/plain;charset=utf-8,', '');
                empFolder?.file(att.name, decodeURIComponent(textContent));
              } else if (att.type === 'atestado' && includeAtestados) {
                try {
                  if (att.url.startsWith('data:')) {
                    const base64Data = att.url.split(',')[1];
                    empFolder?.file(att.name, base64Data, { base64: true });
                  } else if (att.url.startsWith('http')) {
                    const res = await fetch(att.url);
                    const blob = await res.blob();
                    empFolder?.file(att.name, blob);
                  } else {
                    empFolder?.file(att.name, `Atestado registrado no sistema para o dia ${att.date}`);
                  }
                } catch (e) {
                  empFolder?.file(att.name, `Comprovante de atestado do dia ${att.date} (Registro do Sistema)`);
                }
              }
            }
          }
        }
      }

      // 5. GENERATE FINAL ZIP AND DOWNLOAD
      setProgressMsg('Finalizando pacote ZIP de Departamento Pessoal...');
      const zipContent = await zip.generateAsync({ type: 'blob' });
      const downloadUrl = window.URL.createObjectURL(zipContent);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `Relatorio_DP_VECGROUP_${competencia}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);

      setIsGenerating(false);
      onClose();
    } catch (err) {
      console.error('Erro ao gerar relatório DP:', err);
      alert('Ocorreu um erro ao gerar os relatórios. Verifique o console para detalhes.');
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-fadeIn overflow-y-auto">
      <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-100 overflow-hidden my-6">
        
        {/* HEADER */}
        <div className="p-6 bg-gradient-to-r from-slate-900 via-[#003399] to-[#00A1E4] text-white flex items-center justify-between">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20 shadow-md">
              <FileSpreadsheet size={24} className="text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-black uppercase tracking-widest bg-white/20 px-2 py-0.5 rounded-full text-white">
                  Departamento Pessoal & Contabilidade
                </span>
              </div>
              <h2 className="text-xl font-black uppercase tracking-tight mt-0.5">
                Baixar Relatório Mensal de Ponto
              </h2>
              <p className="text-xs text-white/80 font-medium">
                Configuração e fechamento profissional da folha de pagamento
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2.5 text-white/70 hover:text-white hover:bg-white/10 rounded-2xl transition-all cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* BODY CONFIGURATION */}
        <div className="p-6 sm:p-8 space-y-7 max-h-[75vh] overflow-y-auto">
          
          {/* SEÇÃO 1: PERÍODO E ORGANIZAÇÃO */}
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 mb-3 flex items-center space-x-2">
              <Calendar size={16} className="text-[#00A1E4]" />
              <span>1. Período e Estrutura Organizacional</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                  Competência (Mês/Ano)
                </label>
                <input
                  type="month"
                  value={competencia}
                  onChange={(e) => setCompetencia(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-[#00A1E4]"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                  Empresa
                </label>
                <select
                  value={empresa}
                  onChange={(e) => setEmpresa(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-[#00A1E4]"
                >
                  <option value="VEC GROUP (Consolidado)">VEC GROUP (Consolidado)</option>
                  <option value="VEC GROUP Matriz">VEC GROUP Matriz</option>
                  <option value="VEC GROUP Filiais">VEC GROUP Filiais</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                  Filial
                </label>
                <select
                  value={filial}
                  onChange={(e) => setFilial(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-[#00A1E4]"
                >
                  <option value="Todas as Filiais">Todas as Filiais</option>
                  <option value="São Paulo (Matriz)">São Paulo (Matriz)</option>
                  <option value="Rio de Janeiro (Filial)">Rio de Janeiro (Filial)</option>
                  <option value="Belo Horizonte (Filial)">Belo Horizonte (Filial)</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                  Departamento
                </label>
                <select
                  value={departamento}
                  onChange={(e) => setDepartamento(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-[#00A1E4]"
                >
                  {availableDepartments.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* SEÇÃO 2: SELEÇÃO DE FUNCIONÁRIOS */}
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 mb-3 flex items-center space-x-2">
              <Users size={16} className="text-[#00A1E4]" />
              <span>2. Funcionários e Colaboradores Incluídos</span>
            </h3>

            <div className="space-y-3">
              <div className="flex items-center space-x-6">
                <label className="inline-flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="colaboradoresMode"
                    checked={colaboradoresMode === 'all'}
                    onChange={() => setColaboradoresMode('all')}
                    className="w-4 h-4 text-[#00A1E4] focus:ring-[#00A1E4]"
                  />
                  <span className="text-xs font-bold text-slate-800">
                    Todos os Colaboradores ({targetEmployees.length})
                  </span>
                </label>

                <label className="inline-flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="colaboradoresMode"
                    checked={colaboradoresMode === 'specific'}
                    onChange={() => setColaboradoresMode('specific')}
                    className="w-4 h-4 text-[#00A1E4] focus:ring-[#00A1E4]"
                  />
                  <span className="text-xs font-bold text-slate-800">
                    Selecionar Colaboradores Específicos
                  </span>
                </label>
              </div>

              {colaboradoresMode === 'specific' && (
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3 animate-fadeIn">
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Buscar por nome ou departamento..."
                      value={employeeSearch}
                      onChange={(e) => setEmployeeSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-[#00A1E4]"
                    />
                  </div>

                  <div className="max-h-40 overflow-y-auto space-y-1.5 pr-2 custom-scrollbar">
                    {filteredEmployeesForSelection.map((emp, idx) => {
                      const isChecked = selectedUserIds.includes(emp.id);
                      return (
                        <label
                          key={`${emp.id}-${idx}`}
                          className={`flex items-center justify-between p-2 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                            isChecked ? 'bg-[#00A1E4]/10 border border-[#00A1E4]/30 text-[#003399]' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <div className="flex items-center space-x-2.5">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedUserIds(prev => [...prev, emp.id]);
                                } else {
                                  setSelectedUserIds(prev => prev.filter(id => id !== emp.id));
                                }
                              }}
                              className="rounded text-[#00A1E4]"
                            />
                            <span>{emp.name}</span>
                          </div>
                          <span className="text-[10px] font-bold uppercase text-slate-400">
                            {emp.department || (isAdministratorUser(emp) ? 'Administrativo' : 'Comercial')} • {emp.role || (isAdministratorUser(emp) ? 'Administrador' : 'Vendedor')}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* SEÇÃO 3: TIPO DE EXPORTAÇÃO E ANEXOS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Format Type */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider flex items-center space-x-2">
                <FileText size={16} className="text-[#00A1E4]" />
                <span>3. Formatos de Exportação</span>
              </h4>

              <div className="space-y-2">
                <label className="flex items-center space-x-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={exportExcel}
                    onChange={(e) => setExportExcel(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                  />
                  <span className="text-xs font-bold text-slate-800">Planilha Excel (.xlsx) Profissional</span>
                </label>

                <label className="flex items-center space-x-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={exportPdf}
                    onChange={(e) => setExportPdf(e.target.checked)}
                    className="w-4 h-4 text-rose-600 rounded focus:ring-rose-500"
                  />
                  <span className="text-xs font-bold text-slate-800">PDF Executivo (Para Diretoria/Contabilidade)</span>
                </label>

                <label className="flex items-center space-x-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={exportCsv}
                    onChange={(e) => setExportCsv(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-xs font-bold text-slate-800">Arquivo CSV Estruturado</span>
                </label>
              </div>
            </div>

            {/* Incluir Anexos */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider flex items-center space-x-2">
                <FolderArchive size={16} className="text-purple-600" />
                <span>4. Pacote de Anexos & Justificativas</span>
              </h4>

              <div className="space-y-2">
                <label className="flex items-center space-x-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeAtestados}
                    onChange={(e) => setIncludeAtestados(e.target.checked)}
                    className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                  />
                  <span className="text-xs font-bold text-slate-800">Baixar todos os Atestados Médicos</span>
                </label>

                <label className="flex items-center space-x-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeJustificativas}
                    onChange={(e) => setIncludeJustificativas(e.target.checked)}
                    className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                  />
                  <span className="text-xs font-bold text-slate-800">Baixar todas as Justificativas</span>
                </label>

                <label className="flex items-center space-x-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeDocumentos}
                    onChange={(e) => setIncludeDocumentos(e.target.checked)}
                    className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                  />
                  <span className="text-xs font-bold text-slate-800">Baixar documentos de suporte anexados</span>
                </label>
              </div>
            </div>
          </div>

          {/* SEÇÃO 4: AGRUPAMENTO */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
            <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider flex items-center space-x-2">
              <Layers size={16} className="text-[#00A1E4]" />
              <span>5. Agrupamento e Estrutura dos Arquivos</span>
            </h4>

            <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-8 pt-1">
              <label className="inline-flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="agrupamento"
                  checked={agrupamento === 'unico'}
                  onChange={() => setAgrupamento('unico')}
                  className="w-4 h-4 text-[#00A1E4] focus:ring-[#00A1E4]"
                />
                <span className="text-xs font-bold text-slate-800">
                  Um único relatório consolidado
                </span>
              </label>

              <label className="inline-flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="agrupamento"
                  checked={agrupamento === 'por_colaborador'}
                  onChange={() => setAgrupamento('por_colaborador')}
                  className="w-4 h-4 text-[#00A1E4] focus:ring-[#00A1E4]"
                />
                <span className="text-xs font-bold text-slate-800">
                  Um relatório por colaborador (Abas / arquivos separados)
                </span>
              </label>
            </div>
          </div>

          {/* RESUMO PREVIEW KPIS */}
          <div className="bg-[#003399]/5 p-4 rounded-2xl border border-[#003399]/20 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-[#00A1E4] text-white flex items-center justify-center font-black">
                {companyTotals.totalColaboradores}
              </div>
              <div>
                <span className="text-[10px] font-black uppercase text-slate-500 block">Resumo do Fechamento</span>
                <p className="text-xs font-black text-slate-900">
                  {companyTotals.totalColaboradores} Colaboradores • Competência {competencia}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-4 text-xs font-bold text-slate-700">
              <div>
                <span className="text-[9px] font-black text-slate-400 block uppercase">H. Extras</span>
                <span className="text-emerald-600 font-black">{companyTotals.totalExtrasStr}</span>
              </div>
              <div>
                <span className="text-[9px] font-black text-slate-400 block uppercase">H. Faltantes</span>
                <span className="text-rose-600 font-black">{companyTotals.totalNegativasStr}</span>
              </div>
              <div>
                <span className="text-[9px] font-black text-slate-400 block uppercase">Banco Final</span>
                <span className="text-[#00A1E4] font-black">{companyTotals.totalBancoStr}</span>
              </div>
            </div>
          </div>

          {/* PROGRESS MESSAGES IF GENERATING */}
          {isGenerating && (
            <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-amber-900 flex items-center space-x-3 animate-pulse">
              <div className="w-5 h-5 rounded-full border-2 border-amber-600 border-t-transparent animate-spin shrink-0" />
              <span className="text-xs font-bold">{progressMsg}</span>
            </div>
          )}

        </div>

        {/* HIDDEN PRINTABLE ELEMENT FOR PDF CANVAS */}
        <div className="fixed top-[9999px] left-[9999px] opacity-0 pointer-events-none">
          <div ref={pdfRef} className="w-[800px] p-8 bg-white text-slate-900 font-sans">
            {/* PDF Header */}
            <div className="flex items-center justify-between border-b-2 border-slate-900 pb-4 mb-6">
              <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">VEC GROUP</h1>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Relatório Executivo de Ponto & Folha de Pagamento</p>
              </div>
              <div className="text-right">
                <span className="text-xs font-black bg-slate-900 text-white px-3 py-1 rounded-full uppercase">
                  Competência {competencia}
                </span>
                <p className="text-[10px] text-slate-400 font-bold mt-1">Emissão: {new Date().toLocaleDateString('pt-BR')}</p>
              </div>
            </div>

            {/* General Metrics Table */}
            <h2 className="text-xs font-black uppercase text-slate-800 mb-2">Quadro Consolidado da Empresa</h2>
            <table className="w-full text-left text-[10px] border-collapse mb-6">
              <thead>
                <tr className="bg-slate-900 text-white">
                  <th className="p-2">Colaborador</th>
                  <th className="p-2">Cargo / Depto</th>
                  <th className="p-2">Carga Prev.</th>
                  <th className="p-2">Trabalhado</th>
                  <th className="p-2">H. Extras</th>
                  <th className="p-2">H. Falta</th>
                  <th className="p-2">Banco</th>
                  <th className="p-2">Faltas</th>
                  <th className="p-2">Atestados</th>
                  <th className="p-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {reportDataPerEmployee.map((r, idx) => (
                  <tr key={r.employee.id} className={idx % 2 === 0 ? 'bg-slate-50' : 'bg-white'}>
                    <td className="p-2 font-bold">{r.employee.name}</td>
                    <td className="p-2">
                      {r.employee.role || (isAdministratorUser(r.employee) ? 'Administrador' : 'Vendedor')} • {r.employee.department || (isAdministratorUser(r.employee) ? 'Administrativo' : 'Comercial')}
                    </td>
                    <td className="p-2">{r.expectedStr}</td>
                    <td className="p-2">{r.workedStr}</td>
                    <td className="p-2 font-bold text-emerald-700">{r.overtimeStr}</td>
                    <td className="p-2 font-bold text-rose-700">{r.absenceStr}</td>
                    <td className="p-2 font-bold">{r.bancoFinalStr}</td>
                    <td className="p-2">{r.totalFaltas}</td>
                    <td className="p-2">{r.qtdAtestados}</td>
                    <td className="p-2 font-bold">{r.statusGeral}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals Summary Card */}
            <div className="bg-slate-100 p-4 rounded-xl border border-slate-200 mb-8 grid grid-cols-4 gap-4 text-center">
              <div>
                <span className="text-[8px] font-black uppercase text-slate-500 block">Total Extras</span>
                <span className="text-sm font-black text-emerald-700">{companyTotals.totalExtrasStr}</span>
              </div>
              <div>
                <span className="text-[8px] font-black uppercase text-slate-500 block">Total Faltantes</span>
                <span className="text-sm font-black text-rose-700">{companyTotals.totalNegativasStr}</span>
              </div>
              <div>
                <span className="text-[8px] font-black uppercase text-slate-500 block">Banco de Horas Final</span>
                <span className="text-sm font-black text-slate-900">{companyTotals.totalBancoStr}</span>
              </div>
              <div>
                <span className="text-[8px] font-black uppercase text-slate-500 block">Total Atestados / Faltas</span>
                <span className="text-sm font-black text-slate-900">{companyTotals.totalAtestados} Atest. / {companyTotals.totalFaltas} Falt.</span>
              </div>
            </div>

            {/* Signatures Footer */}
            <div className="mt-12 pt-8 border-t border-slate-300 grid grid-cols-2 gap-12 text-center text-[10px]">
              <div>
                <div className="border-b border-slate-900 mb-1 w-48 mx-auto" />
                <span className="font-black uppercase text-slate-800">Responsável pelo RH / DP</span>
                <p className="text-slate-400 font-medium">VEC GROUP</p>
              </div>
              <div>
                <div className="border-b border-slate-900 mb-1 w-48 mx-auto" />
                <span className="font-black uppercase text-slate-800">Conferência Contabilidade</span>
                <p className="text-slate-400 font-medium">Folha de Pagamento</p>
              </div>
            </div>
          </div>
        </div>

        {/* FOOTER ACTIONS */}
        <div className="p-6 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2 text-xs font-bold text-slate-500">
            <ShieldAlert size={16} className="text-[#00A1E4]" />
            <span>Pronto para auditoria, homologação e fechamento contábil.</span>
          </div>

          <div className="flex items-center space-x-3 w-full sm:w-auto">
            <button
              onClick={onClose}
              disabled={isGenerating}
              className="w-full sm:w-auto px-5 py-3 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-2xl text-xs font-black uppercase transition-all cursor-pointer"
            >
              Cancelar
            </button>

            <button
              onClick={handleExport}
              disabled={isGenerating}
              className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-[#00A1E4] to-[#003399] hover:from-[#0089c4] hover:to-[#002266] text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-[#00A1E4]/30 hover:scale-[1.02] active:scale-95 cursor-pointer flex items-center justify-center space-x-2"
            >
              <Download size={18} />
              <span>Gerar e Baixar Pacote DP</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
