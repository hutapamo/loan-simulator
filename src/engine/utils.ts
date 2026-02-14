import Decimal from 'decimal.js';
import type { DayCountConvention } from '../types/index';

/**
 * Calculate the day count basis for a given convention and year
 */
export function getDayCountBasis(convention: DayCountConvention, year: number): number {
  switch (convention) {
    case 'ACT_365':
      return 365;
    case 'ACT_366':
      return 366;
    case 'ACT_ACT':
      return isLeapYear(year) ? 366 : 365;
    case '30_360_ISDA':
      return 360;
  }
}

/**
 * Calculate daily interest rate
 */
export function getDailyRate(
  annualRatePercent: number,
  convention: DayCountConvention,
  year: number
): Decimal {
  const basis = getDayCountBasis(convention, year);
  return new Decimal(annualRatePercent).div(100).div(basis);
}

/**
 * Check if a year is a leap year
 */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Check if a date is a weekend
 */
export function isWeekend(date: Date): boolean {
  const day = date.getUTCDay();
  return day === 0 || day === 6; // Sunday or Saturday
}

/**
 * Adjust payment date according to shift rule (weekends only, no holidays)
 */
export function adjustPaymentDate(dateStr: string, shiftRule: 'NONE' | 'NEXT_BUSINESS_DAY' | 'PREV_BUSINESS_DAY'): string {
  if (shiftRule === 'NONE') return dateStr;
  
  const date = new Date(dateStr + 'T00:00:00Z');
  
  if (shiftRule === 'NEXT_BUSINESS_DAY') {
    while (isWeekend(date)) {
      date.setUTCDate(date.getUTCDate() + 1);
    }
  } else if (shiftRule === 'PREV_BUSINESS_DAY') {
    while (isWeekend(date)) {
      date.setUTCDate(date.getUTCDate() - 1);
    }
  }
  
  return date.toISOString().split('T')[0];
}

/**
 * Get the posting day for a given month, handling overflow
 * If posting day > days in month, roll to 1st of next month
 */
export function getPostingDate(year: number, month: number, postingDay: number): string {
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  
  if (postingDay <= daysInMonth) {
    return `${year}-${String(month).padStart(2, '0')}-${String(postingDay).padStart(2, '0')}`;
  } else {
    // Overflow: roll to 1st of next month
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    return `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
  }
}

/**
 * Add days to a date
 */
export function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr + 'T00:00:00Z');
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().split('T')[0];
}

/**
 * Add months to a date
 */
export function addMonths(dateStr: string, months: number): string {
  const date = new Date(dateStr + 'T00:00:00Z');
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.toISOString().split('T')[0];
}

/**
 * Calculate difference in months between two dates
 */
export function monthsDifference(date1Str: string, date2Str: string): number {
  const date1 = new Date(date1Str + 'T00:00:00Z');
  const date2 = new Date(date2Str + 'T00:00:00Z');
  
  const months = (date2.getUTCFullYear() - date1.getUTCFullYear()) * 12 + 
                 (date2.getUTCMonth() - date1.getUTCMonth());
  
  return Math.abs(months);
}

/**
 * Get year and month from date string
 */
export function getYearMonth(dateStr: string): { year: number; month: number } {
  const date = new Date(dateStr + 'T00:00:00Z');
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1 // 1-12
  };
}

/**
 * Format currency for ZAR
 */
export function formatCurrency(amount: number | Decimal): string {
  const num = amount instanceof Decimal ? amount.toNumber() : amount;
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

/**
 * Format duration in years and months
 */
export function formatDuration(months: number): string {
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  
  if (years === 0) {
    return `${remainingMonths} month${remainingMonths !== 1 ? 's' : ''}`;
  } else if (remainingMonths === 0) {
    return `${years} year${years !== 1 ? 's' : ''}`;
  } else {
    return `${years} year${years !== 1 ? 's' : ''}, ${remainingMonths} month${remainingMonths !== 1 ? 's' : ''}`;
  }
}
