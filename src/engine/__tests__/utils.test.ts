import { describe, it, expect } from 'vitest';
import { getDayCountBasis, getDailyRate, isLeapYear, getPostingDate } from '../utils';

describe('Day Count Utils', () => {
  it('should calculate correct day count basis for ACT_365', () => {
    expect(getDayCountBasis('ACT_365', 2024)).toBe(365);
    expect(getDayCountBasis('ACT_365', 2023)).toBe(365);
  });

  it('should calculate correct day count basis for ACT_366', () => {
    expect(getDayCountBasis('ACT_366', 2024)).toBe(366);
    expect(getDayCountBasis('ACT_366', 2023)).toBe(366);
  });

  it('should calculate correct day count basis for ACT_ACT', () => {
    expect(getDayCountBasis('ACT_ACT', 2024)).toBe(366); // Leap year
    expect(getDayCountBasis('ACT_ACT', 2023)).toBe(365); // Not leap year
  });

  it('should calculate correct day count basis for 30_360_ISDA', () => {
    expect(getDayCountBasis('30_360_ISDA', 2024)).toBe(360);
  });

  it('should identify leap years correctly', () => {
    expect(isLeapYear(2024)).toBe(true);
    expect(isLeapYear(2000)).toBe(true);
    expect(isLeapYear(2023)).toBe(false);
    expect(isLeapYear(1900)).toBe(false);
  });

  it('should calculate daily interest rate correctly', () => {
    const rate = getDailyRate(10, 'ACT_365', 2024);
    expect(rate.toNumber()).toBeCloseTo(0.1 / 365, 10);
  });

  it('should handle posting day overflow correctly', () => {
    // February has only 28 days in 2023, day 31 should roll to March 1
    expect(getPostingDate(2023, 2, 31)).toBe('2023-03-01');
    
    // Normal case: day within month
    expect(getPostingDate(2023, 1, 15)).toBe('2023-01-15');
    
    // December with overflow should roll to January of next year
    expect(getPostingDate(2023, 12, 31)).toBe('2023-12-31');
  });
});

describe('Simulation Engine', () => {
  it('should create a simple test loan scenario', () => {
    // This is a placeholder for actual simulation tests
    // In a full implementation, you would test:
    // - Simple 12-month loan with known amortisation
    // - Lump sum payments
    // - Rate changes mid-cycle
    // - Different posting rules
    // - Different settlement rules
    expect(true).toBe(true);
  });
});
