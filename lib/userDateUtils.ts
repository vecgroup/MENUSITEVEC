import { User, PunchRecord } from '../types';
import { supabase } from './supabase';

/**
 * Checks if this is a new user who has never punched before and hasn't configured their start date yet.
 */
export function isNewUserWithoutStartDate(user?: User | null, userRecords?: PunchRecord[]): boolean {
  if (!user) return false;

  const userKey = user.id || user.email;
  if (!userKey) return false;

  // 1. Check if user already has an explicit admission date in profile
  if (user.admissionDate && typeof user.admissionDate === 'string' && user.admissionDate.trim().length >= 8) {
    return false;
  }

  // 2. Check if user has cached admission date or has completed the onboarding modal
  try {
    const cachedDates = JSON.parse(localStorage.getItem('vecgroup_user_admission_dates') || '{}');
    if (cachedDates[userKey] || (user.id && cachedDates[user.id]) || (user.email && cachedDates[user.email])) {
      return false;
    }

    const onboardingDone = localStorage.getItem(`vecgroup_onboarding_completed_${userKey}`);
    if (onboardingDone) {
      return false;
    }
  } catch (e) {
    // Ignore storage parse error
  }

  // 3. Check if user already has any punch records with actual punches (entry, exit, lunch, etc.)
  if (userRecords && userRecords.length > 0) {
    const hasAnyRealPunches = userRecords.some(r => {
      const match = (r.userId && user.id && r.userId === user.id) ||
                    (r.userId && user.email && String(r.userId).toLowerCase() === user.email.toLowerCase()) ||
                    (r.userName && user.name && r.userName.toLowerCase().trim() === user.name.toLowerCase().trim());
      return match && (r.entry || r.exit || r.lunchStart || r.lunchReturn);
    });

    if (hasAnyRealPunches) {
      return false;
    }
  }

  return true;
}

/**
 * Saves the user's start/admission date in Supabase and local cache.
 */
export async function saveUserAdmissionDate(user: User, startDateStr: string): Promise<boolean> {
  if (!user || !startDateStr) return false;
  const cleanDate = startDateStr.split('T')[0];

  // 1. Store in localStorage cache immediately
  try {
    const userKey = user.id || user.email;
    const cachedDates = JSON.parse(localStorage.getItem('vecgroup_user_admission_dates') || '{}');
    if (userKey) {
      cachedDates[userKey] = cleanDate;
      if (user.id) cachedDates[user.id] = cleanDate;
      if (user.email) cachedDates[user.email] = cleanDate;
      localStorage.setItem('vecgroup_user_admission_dates', JSON.stringify(cachedDates));
      localStorage.setItem(`vecgroup_onboarding_completed_${userKey}`, 'true');
      if (user.id) localStorage.setItem(`vecgroup_onboarding_completed_${user.id}`, 'true');
    }
  } catch (e) {
    console.warn("Erro ao salvar cache de admissão local:", e);
  }

  // 2. Persist to Supabase profiles
  try {
    const userToSave = {
      ...user,
      admissionDate: cleanDate,
      admission_date: cleanDate
    };
    await supabase.users.upsert(userToSave);
    return true;
  } catch (err) {
    console.error("Erro ao salvar data de admissão no Supabase:", err);
    return true; // Still true since local storage is saved
  }
}

/**
 * Returns the effective start/admission date for a user (YYYY-MM-DD).
 * Days prior to this date MUST NOT generate pending absence justifications,
 * absence penalties, or missing punch alerts, as the employee was not yet registered/working at the company.
 */
export function getUserStartDate(user?: User | null, userRecords?: PunchRecord[]): string {
  if (!user) {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  }

  // 1. Explicit admission date (e.g. '2026-08-17')
  if (user.admissionDate && typeof user.admissionDate === 'string' && user.admissionDate.includes('-')) {
    return user.admissionDate.split('T')[0];
  }

  // 2. Check local storage cache of admission dates
  try {
    const cachedDates = JSON.parse(localStorage.getItem('vecgroup_user_admission_dates') || '{}');
    const userKey = user.id || user.email;
    if (userKey && cachedDates[userKey]) {
      return cachedDates[userKey];
    }
    if (user.id && cachedDates[user.id]) {
      return cachedDates[user.id];
    }
    if (user.email && cachedDates[user.email]) {
      return cachedDates[user.email];
    }
  } catch (e) {
    // Ignore storage parse error
  }

  // 3. Profile creation date
  if (user.createdAt && typeof user.createdAt === 'string' && user.createdAt.includes('-')) {
    return user.createdAt.split('T')[0];
  }

  // 4. Earliest punch record in database for this user
  if (userRecords && userRecords.length > 0) {
    const matchingRecs = userRecords.filter(r => {
      if (r.userId && user.id && r.userId === user.id) return true;
      if (r.userId && user.email && String(r.userId).toLowerCase() === user.email.toLowerCase()) return true;
      if (r.userName && user.name && r.userName.toLowerCase().trim() === user.name.toLowerCase().trim()) return true;
      return false;
    });

    const dates = matchingRecs
      .filter(r => r.entry || r.exit || r.lunchStart || r.lunchReturn)
      .map(r => (r.date ? r.date.split('T')[0] : ''))
      .filter(d => d.length === 10)
      .sort();

    if (dates.length > 0) {
      // Store earliest date in cache
      try {
        const cachedDates = JSON.parse(localStorage.getItem('vecgroup_user_admission_dates') || '{}');
        const userKey = user.id || user.email;
        if (userKey) {
          cachedDates[userKey] = dates[0];
          localStorage.setItem('vecgroup_user_admission_dates', JSON.stringify(cachedDates));
        }
      } catch (e) {}
      return dates[0];
    }
  }

  // 5. Default to today if user has no past records and no explicit creation date
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  
  return todayStr;
}

/**
 * Checks if a specific date (YYYY-MM-DD) is before the user was admitted/created.
 */
export function isDateBeforeUserAdmission(dateStr: string, user?: User | null, userRecords?: PunchRecord[]): boolean {
  if (!dateStr) return false;
  const startDate = getUserStartDate(user, userRecords);
  return dateStr < startDate;
}
