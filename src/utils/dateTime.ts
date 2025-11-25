/**
 * Utility funktioner til håndtering af dansk tid (Europe/Copenhagen timezone)
 */

const DANISH_TIMEZONE = 'Europe/Copenhagen';

/**
 * Konverterer en dato til dansk tid og formaterer den
 * @param date - Dato der skal formateres
 * @param options - Intl.DateTimeFormatOptions
 * @returns Formateret dato string i dansk tid
 */
export const formatDanishDateTime = (
  date: Date | string,
  options?: Intl.DateTimeFormatOptions
): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  const defaultOptions: Intl.DateTimeFormatOptions = {
    timeZone: DANISH_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    ...options,
  };

  return new Intl.DateTimeFormat('da-DK', defaultOptions).format(dateObj);
};

/**
 * Konverterer en dato til dansk tid (kun dato)
 * @param date - Dato der skal formateres
 * @returns Formateret dato string i dansk tid (dd-mm-yyyy)
 */
export const formatDanishDate = (date: Date | string): string => {
  return formatDanishDateTime(date, {
    hour: undefined,
    minute: undefined,
  });
};

/**
 * Konverterer en dato til dansk tid (kun tid)
 * @param date - Dato der skal formateres
 * @returns Formateret tid string i dansk tid (HH:mm)
 */
export const formatDanishTime = (date: Date | string): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  return new Intl.DateTimeFormat('da-DK', {
    timeZone: DANISH_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
  }).format(dateObj);
};

/**
 * Får nuværende dato/tid i dansk timezone
 * @returns Date objekt med dansk tid
 */
export const getDanishNow = (): Date => {
  // Konverter til dansk tid ved at bruge Intl API
  const now = new Date();
  const danishTimeString = now.toLocaleString('en-US', { timeZone: DANISH_TIMEZONE });
  return new Date(danishTimeString);
};

/**
 * Tjekker om en dato er i dag (dansk tid)
 * @param date - Dato der skal tjekkes
 * @returns true hvis datoen er i dag
 */
export const isDanishToday = (date: Date | string): boolean => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const today = getDanishNow();
  
  const dateStr = formatDanishDate(dateObj);
  const todayStr = formatDanishDate(today);
  
  return dateStr === todayStr;
};

/**
 * Tjekker om en dato er før en anden dato (dansk tid)
 * @param date1 - Første dato
 * @param date2 - Anden dato
 * @returns true hvis date1 er før date2
 */
export const isDanishBefore = (date1: Date | string, date2: Date | string): boolean => {
  const d1 = typeof date1 === 'string' ? new Date(date1) : date1;
  const d2 = typeof date2 === 'string' ? new Date(date2) : date2;
  
  return d1 < d2;
};

/**
 * Tjekker om en dato er efter en anden dato (dansk tid)
 * @param date1 - Første dato
 * @param date2 - Anden dato
 * @returns true hvis date1 er efter date2
 */
export const isDanishAfter = (date1: Date | string, date2: Date | string): boolean => {
  const d1 = typeof date1 === 'string' ? new Date(date1) : date1;
  const d2 = typeof date2 === 'string' ? new Date(date2) : date2;
  
  return d1 > d2;
};
