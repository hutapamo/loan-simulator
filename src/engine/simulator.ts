import Decimal from 'decimal.js';
import type {
  LoanState,
  InterestRules,
  PaymentRules,
  ScenarioControls,
  Event,
  MonthSummary,
  SimulationResult,
  RateScheduleEntry,
} from '../types/index';
import {
  getDailyRate,
  addDays,
  addMonths,
  getYearMonth,
  adjustPaymentDate,
  getPostingDate,
} from './utils';

// High precision for all calculations
Decimal.set({ precision: 50 });

/**
 * Calculate the last payment date based on payment_day_of_month and today
 * Handles months with different days - e.g., payment day 31 becomes last day of shorter months
 */
function calculateLastPaymentDate(paymentDay: number, todayISO: string): string {
  const today = new Date(todayISO + 'T00:00:00Z');
  const todayYear = today.getUTCFullYear();
  const todayMonth = today.getUTCMonth(); // 0-11
  const todayDay = today.getUTCDate();
  
  // Determine last payment month
  let lastPaymentYear = todayYear;
  let lastPaymentMonth = todayMonth;
  
  // Get the actual payment day for current month (capped at last day)
  const currentMonthPaymentDay = Math.min(paymentDay, getDaysInMonth(todayYear, todayMonth));
  
  // If today hasn't reached this month's payment day yet, last payment was previous month
  if (todayDay < currentMonthPaymentDay) {
    lastPaymentMonth--;
    if (lastPaymentMonth < 0) {
      lastPaymentMonth = 11;
      lastPaymentYear--;
    }
  }
  
  // Get actual payment day for that month (capped at last day)
  const actualPaymentDay = Math.min(paymentDay, getDaysInMonth(lastPaymentYear, lastPaymentMonth));
  
  // Use UTC to avoid timezone issues (month is 0-indexed, so add 1 for display)
  const lastPayment = new Date(Date.UTC(lastPaymentYear, lastPaymentMonth, actualPaymentDay));
  return lastPayment.toISOString().split('T')[0];
}

/**
 * Get number of days in a month (dynamic, no hardcoding)
 */
function getDaysInMonth(year: number, month: number): number {
  // month is 0-indexed (0 = Jan, 11 = Dec)
  // Day 0 of next month = last day of current month
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

/**
 * Main simulation engine - runs daily loop until loan is paid off
 */
export function runSimulation(
  loanState: LoanState,
  interestRules: InterestRules,
  paymentRules: PaymentRules,
  scenarioControls?: ScenarioControls
): SimulationResult {
  // Quick check: is regular payment sufficient to cover interest?
  const currentRate = interestRules.annual_interest_rate_schedule[0]?.annual_rate_percent || 0;
  const monthlyInterest = new Decimal(loanState.principal_outstanding)
    .times(currentRate)
    .div(100)
    .div(12);
  const totalPayment = new Decimal(loanState.regular_instalment_amount)
    .plus(scenarioControls?.extra_monthly?.extra_monthly_amount || 0);
  
  if (totalPayment.lte(monthlyInterest)) {
    throw new Error(
      `Payment (${totalPayment.toFixed(2)}) is insufficient to cover monthly interest (≈${monthlyInterest.toFixed(2)}). The loan will never pay off. Increase your payment amount.`
    );
  }

  // Calculate dates
  const today = new Date().toISOString().split('T')[0];
  const lastPaymentDate = calculateLastPaymentDate(loanState.payment_day_of_month, today);
  
  // Initialize state
  // Principal represents balance AFTER last payment (clean starting point)
  // Simulation starts ON last payment date - payment already happened, but interest still accrues that day
  let currentDate = lastPaymentDate;
  let principal = new Decimal(loanState.principal_outstanding);
  let interest_accrued_unposted = new Decimal(0);
  let interest_due_posted = new Decimal(0);
  let cumulative_interest_paid = new Decimal(0);
  let cumulative_paid_total = new Decimal(0);

  // Build event schedule - payments start from NEXT payment, not last payment
  const events = buildEventSchedule(
    today,
    loanState,
    paymentRules,
    scenarioControls
  );

  // Track monthly summaries with new structure
  const monthSummaries: MonthSummary[] = [];
  let currentMonthData: {
    year: number;
    month: number;
    interest_accrued: Decimal; // Interest accrued during calendar month
    interest_paid: Decimal; // Interest paid by payment(s) in calendar month
    principal_reduction: Decimal;
    total_paid: Decimal;
    has_lump_sum: boolean; // Whether this month includes a lump sum payment
  } | null = null;

  const maxDays = 365 * 50; // Safety limit: 50 years
  let dayCount = 0;

  // Daily loop
  while (dayCount < maxDays) {
    const { year, month } = getYearMonth(currentDate);

    // Initialize month tracking
    if (!currentMonthData || currentMonthData.year !== year || currentMonthData.month !== month) {
      if (currentMonthData) {
        // Save previous month
        monthSummaries.push({
          year: currentMonthData.year,
          month: currentMonthData.month,
          interest_accrued: currentMonthData.interest_accrued,
          interest_paid: currentMonthData.interest_paid,
          monthly_principal_reduction: currentMonthData.principal_reduction,
          monthly_total_paid: currentMonthData.total_paid,
          month_end_principal: principal,
          cumulative_interest_paid,
          has_lump_sum: currentMonthData.has_lump_sum,
        });
      }
      currentMonthData = {
        year,
        month,
        interest_accrued: new Decimal(0),
        interest_paid: new Decimal(0),
        principal_reduction: new Decimal(0),
        total_paid: new Decimal(0),
        has_lump_sum: false,
      };
    }

    // Get current annual rate
    const currentRate = getCurrentRate(currentDate, interestRules.annual_interest_rate_schedule);

    // Process payment events FIRST (before accruing today's interest)
    const todaysEvents = events.filter(e => e.date === currentDate);
    if (todaysEvents.length > 0) {
      // Check if any lump sum events today
      const hasLumpSumToday = todaysEvents.some(e => e.type === 'LUMP_SUM');
      if (hasLumpSumToday && currentMonthData) {
        currentMonthData.has_lump_sum = true;
      }

      const result = processPayments(
        todaysEvents,
        principal,
        interest_accrued_unposted,
        interest_due_posted,
        cumulative_interest_paid,
        cumulative_paid_total,
        paymentRules.interest_settlement_on_payment_day,
        scenarioControls?.treat_lump_sum_as_principal_only || false
      );

      principal = result.principal;
      interest_accrued_unposted = result.interest_accrued_unposted;
      interest_due_posted = result.interest_due_posted;
      cumulative_interest_paid = result.cumulative_interest_paid;
      cumulative_paid_total = result.cumulative_paid_total;

      if (currentMonthData) {
        currentMonthData.principal_reduction = currentMonthData.principal_reduction.plus(
          result.principal_paid
        );
        currentMonthData.total_paid = currentMonthData.total_paid.plus(result.total_paid);
        currentMonthData.interest_paid = currentMonthData.interest_paid.plus(result.interest_paid);
      }
    }

    // Accrue daily interest AFTER payment
    const dailyRate = getDailyRate(currentRate, interestRules.day_count_convention, year);
    const dailyInterest = principal.times(dailyRate);
    interest_accrued_unposted = interest_accrued_unposted.plus(dailyInterest);
    if (currentMonthData) {
      currentMonthData.interest_accrued = currentMonthData.interest_accrued.plus(dailyInterest);
    }

    // Check for interest posting
    const postingDate = getPostingDate(year, month, interestRules.interest_posting_day);
    if (currentDate === postingDate) {
      if (interestRules.interest_posting_rule === 'POST_MONTHLY_TO_INTEREST_DUE') {
        interest_due_posted = interest_due_posted.plus(interest_accrued_unposted);
        interest_accrued_unposted = new Decimal(0);
      } else if (interestRules.interest_posting_rule === 'CAPITALISE_MONTHLY') {
        principal = principal.plus(interest_accrued_unposted);
        interest_accrued_unposted = new Decimal(0);
      }
    }

    // Check for payoff
    if (
      principal.lte(0.01) &&
      interest_due_posted.lte(0.01) &&
      interest_accrued_unposted.lte(0.01)
    ) {
      // Save final month
      if (currentMonthData) {
        monthSummaries.push({
          year: currentMonthData.year,
          month: currentMonthData.month,
          interest_accrued: currentMonthData.interest_accrued,
          interest_paid: currentMonthData.interest_paid,
          monthly_principal_reduction: currentMonthData.principal_reduction,
          monthly_total_paid: currentMonthData.total_paid,
          month_end_principal: new Decimal(0),
          cumulative_interest_paid,
          has_lump_sum: currentMonthData.has_lump_sum,
        });
      }

      return {
        payoff_date: currentDate,
        months_to_payoff: Math.ceil(dayCount / 30),
        total_interest: cumulative_interest_paid,
        total_paid: cumulative_paid_total,
        month_summaries: monthSummaries,
        final_state: {
          date: currentDate,
          principal: new Decimal(0),
          interest_accrued_unposted: new Decimal(0),
          interest_due_posted: new Decimal(0),
          cumulative_interest_paid,
          cumulative_paid_total,
        },
      };
    }

    // Move to next day
    currentDate = addDays(currentDate, 1);
    dayCount++;
  }

  throw new Error('Simulation exceeded maximum duration (50 years)');
}

// /**
//  * Bootstrap mid-cycle interest by simulating from last posting date
//  */
// function bootstrapMidCycleInterest(
//   lastPostingDate: string,
//   asOfDate: string,
//   principalOnPosting: Decimal,
//   interestRules: InterestRules
// ): Decimal {
//   let date = addDays(lastPostingDate, 1);
//   let accruedInterest = new Decimal(0);
//   let principal = principalOnPosting;

//   while (date <= asOfDate) {
//     const { year } = getYearMonth(date);
//     const currentRate = getCurrentRate(date, interestRules.annual_interest_rate_schedule);
//     const dailyRate = getDailyRate(currentRate, interestRules.day_count_convention, year);
//     accruedInterest = accruedInterest.plus(principal.times(dailyRate));
//     date = addDays(date, 1);
//   }

//   return accruedInterest;
// }

/**
 * Get current interest rate for a given date
 */
function getCurrentRate(date: string, schedule: RateScheduleEntry[]): number {
  // Find the most recent rate that applies
  let applicableRate = schedule[0].annual_rate_percent;
  
  for (const entry of schedule) {
    if (entry.start_date <= date) {
      applicableRate = entry.annual_rate_percent;
    } else {
      break;
    }
  }
  
  return applicableRate;
}

/**
 * Build complete event schedule (regular payments, extras, lump sums)
 */
function buildEventSchedule(
  todayISO: string,
  loanState: LoanState,
  paymentRules: PaymentRules,
  scenarioControls?: ScenarioControls
): Event[] {
  const events: Event[] = [];
  
  // Add regular payment events (up to 50 years)
  // Calculate next payment date from payment_day_of_month
  const today = new Date(todayISO + 'T00:00:00Z');
  const todayYear = today.getUTCFullYear();
  const todayMonth = today.getUTCMonth();
  const todayDay = today.getUTCDate();
  
  let nextPaymentYear = todayYear;
  let nextPaymentMonth = todayMonth;
  
  if (todayDay >= loanState.payment_day_of_month) {
    // Next payment is next month
    nextPaymentMonth++;
    if (nextPaymentMonth > 11) {
      nextPaymentMonth = 0;
      nextPaymentYear++;
    }
  }
  
  const nextPayment = new Date(Date.UTC(nextPaymentYear, nextPaymentMonth, Math.min(loanState.payment_day_of_month, getDaysInMonth(nextPaymentYear, nextPaymentMonth))));
  
  let paymentDate = nextPayment.toISOString().split('T')[0];
  for (let i = 0; i < 600; i++) {
    const adjustedDate = adjustPaymentDate(paymentDate, paymentRules.payment_date_shift_rule);
    events.push({
      date: adjustedDate,
      type: 'REGULAR_PAYMENT',
      amount: new Decimal(loanState.regular_instalment_amount),
    });
    paymentDate = addMonths(paymentDate, 1);
  }

  if (scenarioControls) {
    // Add extra monthly payments
    const extraAmount = scenarioControls.extra_monthly.extra_monthly_amount;
    if (extraAmount > 0) {
      const startDate = getExtraPaymentStartDate(todayISO, loanState, scenarioControls.extra_monthly);
      const endDate = scenarioControls.extra_monthly.extra_monthly_end_date === 'UNTIL_PAYOFF'
        ? addDays(todayISO, 365 * 50) // Far future
        : scenarioControls.extra_monthly.extra_monthly_end_date_custom!;

      let extraPaymentDate = startDate;
      for (let i = 0; i < 600; i++) {
        if (extraPaymentDate > endDate) break;
        
        const adjustedDate = adjustPaymentDate(extraPaymentDate, paymentRules.payment_date_shift_rule);
        events.push({
          date: adjustedDate,
          type: 'EXTRA_MONTHLY',
          amount: new Decimal(extraAmount),
        });
        
        extraPaymentDate = addMonths(extraPaymentDate, 1);
      }
    }

    // Add lump sums
    for (const lumpSum of scenarioControls.lump_sums) {
      const adjustedDate = adjustPaymentDate(lumpSum.date, paymentRules.payment_date_shift_rule);
      events.push({
        date: adjustedDate,
        type: 'LUMP_SUM',
        amount: new Decimal(lumpSum.amount),
        label: lumpSum.label,
      });
    }
  }

  // Sort by date
  events.sort((a, b) => a.date.localeCompare(b.date));

  return events;
}

/**
 * Determine start date for extra monthly payments
 */
function getExtraPaymentStartDate(
  todayISO: string,
  loanState: LoanState,
  extraMonthly: ScenarioControls['extra_monthly']
): string {
  switch (extraMonthly.extra_monthly_start_date) {
    case 'NEXT_PAYMENT_DATE':
      const today = new Date(todayISO + 'T00:00:00Z');
      const todayYear = today.getUTCFullYear();
      const todayMonth = today.getUTCMonth();
      const todayDay = today.getUTCDate();
      
      let nextPaymentYear = todayYear;
      let nextPaymentMonth = todayMonth;
      
      if (todayDay >= loanState.payment_day_of_month) {
        nextPaymentMonth++;
        if (nextPaymentMonth > 11) {
          nextPaymentMonth = 0;
          nextPaymentYear++;
        }
      }
      
      const nextPayment = new Date(Date.UTC(nextPaymentYear, nextPaymentMonth, Math.min(loanState.payment_day_of_month, getDaysInMonth(nextPaymentYear, nextPaymentMonth))));
      return nextPayment.toISOString().split('T')[0];
    case 'AS_OF_DATE':
      return todayISO;
    case 'CUSTOM':
      return extraMonthly.extra_monthly_start_date_custom!;
  }
}

/**
 * Process all payments for a given day
 */
function processPayments(
  events: Event[],
  principal: Decimal,
  interest_accrued_unposted: Decimal,
  interest_due_posted: Decimal,
  cumulative_interest_paid: Decimal,
  cumulative_paid_total: Decimal,
  settlementRule: 'SETTLE_POSTED_ONLY' | 'SETTLE_POSTED_PLUS_ACCRUED',
  treatLumpSumAsPrincipalOnly: boolean
): {
  principal: Decimal;
  interest_accrued_unposted: Decimal;
  interest_due_posted: Decimal;
  cumulative_interest_paid: Decimal;
  cumulative_paid_total: Decimal;
  principal_paid: Decimal;
  interest_paid: Decimal; // NEW: interest paid by these payments
  total_paid: Decimal;
} {
  let newPrincipal = principal;
  let newInterestAccrued = interest_accrued_unposted;
  let newInterestPosted = interest_due_posted;
  let newCumulativeInterestPaid = cumulative_interest_paid;
  let newCumulativePaidTotal = cumulative_paid_total;
  let totalPrincipalPaid = new Decimal(0);
  let totalInterestPaid = new Decimal(0);
  let totalPaid = new Decimal(0);

  // Separate lump sums if principal-only treatment
  const lumpSums = events.filter(e => e.type === 'LUMP_SUM');
  const regularPayments = events.filter(e => e.type !== 'LUMP_SUM');

  // Process regular + extra payments through waterfall
  if (regularPayments.length > 0) {
    const combinedAmount = regularPayments.reduce(
      (sum, e) => sum.plus(e.amount || 0),
      new Decimal(0)
    );

    const result = applyWaterfall(
      combinedAmount,
      newPrincipal,
      newInterestAccrued,
      newInterestPosted,
      settlementRule
    );

    newPrincipal = result.principal;
    newInterestAccrued = result.interest_accrued_unposted;
    newInterestPosted = result.interest_due_posted;
    newCumulativeInterestPaid = newCumulativeInterestPaid.plus(result.interest_paid);
    totalPrincipalPaid = totalPrincipalPaid.plus(result.principal_paid);
    totalInterestPaid = totalInterestPaid.plus(result.interest_paid);
    newCumulativePaidTotal = newCumulativePaidTotal.plus(combinedAmount);
    totalPaid = totalPaid.plus(combinedAmount);
  }

  // Process lump sums
  for (const lumpSum of lumpSums) {
    const amount = lumpSum.amount || new Decimal(0);

    if (treatLumpSumAsPrincipalOnly) {
      // Direct to principal
      const principalPayment = Decimal.min(amount, newPrincipal);
      newPrincipal = newPrincipal.minus(principalPayment);
      totalPrincipalPaid = totalPrincipalPaid.plus(principalPayment);
    } else {
      // Through waterfall
      const result = applyWaterfall(
        amount,
        newPrincipal,
        newInterestAccrued,
        newInterestPosted,
        settlementRule
      );

      newPrincipal = result.principal;
      newInterestAccrued = result.interest_accrued_unposted;
      newInterestPosted = result.interest_due_posted;
      newCumulativeInterestPaid = newCumulativeInterestPaid.plus(result.interest_paid);
      totalPrincipalPaid = totalPrincipalPaid.plus(result.principal_paid);
      totalInterestPaid = totalInterestPaid.plus(result.interest_paid);
    }

    newCumulativePaidTotal = newCumulativePaidTotal.plus(amount);
    totalPaid = totalPaid.plus(amount);
  }

  return {
    principal: newPrincipal,
    interest_accrued_unposted: newInterestAccrued,
    interest_due_posted: newInterestPosted,
    cumulative_interest_paid: newCumulativeInterestPaid,
    cumulative_paid_total: newCumulativePaidTotal,
    principal_paid: totalPrincipalPaid,
    interest_paid: totalInterestPaid,
    total_paid: totalPaid,
  };
}

/**
 * Apply payment waterfall: INTEREST_DUE -> PRINCIPAL
 */
function applyWaterfall(
  paymentAmount: Decimal,
  principal: Decimal,
  interest_accrued_unposted: Decimal,
  interest_due_posted: Decimal,
  settlementRule: 'SETTLE_POSTED_ONLY' | 'SETTLE_POSTED_PLUS_ACCRUED'
): {
  principal: Decimal;
  interest_accrued_unposted: Decimal;
  interest_due_posted: Decimal;
  interest_paid: Decimal;
  principal_paid: Decimal;
} {
  let remaining = paymentAmount;
  let newPrincipal = principal;
  let newInterestAccrued = interest_accrued_unposted;
  let newInterestPosted = interest_due_posted;
  let interestPaid = new Decimal(0);
  let principalPaid = new Decimal(0);

  // Calculate total interest due
  let totalInterestDue = newInterestPosted;
  if (settlementRule === 'SETTLE_POSTED_PLUS_ACCRUED') {
    totalInterestDue = totalInterestDue.plus(newInterestAccrued);
  }

  // Pay interest first
  if (totalInterestDue.gt(0)) {
    const interestPayment = Decimal.min(remaining, totalInterestDue);
    interestPaid = interestPayment;
    remaining = remaining.minus(interestPayment);

    // Reduce interest buckets
    if (settlementRule === 'SETTLE_POSTED_PLUS_ACCRUED') {
      // Pay from accrued first, then posted
      const accruedPayment = Decimal.min(interestPayment, newInterestAccrued);
      newInterestAccrued = newInterestAccrued.minus(accruedPayment);
      const postedPayment = interestPayment.minus(accruedPayment);
      newInterestPosted = newInterestPosted.minus(postedPayment);
    } else {
      newInterestPosted = newInterestPosted.minus(interestPayment);
    }
  }

  // Remainder goes to principal
  if (remaining.gt(0)) {
    principalPaid = Decimal.min(remaining, newPrincipal);
    newPrincipal = newPrincipal.minus(principalPaid);
  }

  return {
    principal: newPrincipal,
    interest_accrued_unposted: newInterestAccrued,
    interest_due_posted: newInterestPosted,
    interest_paid: interestPaid,
    principal_paid: principalPaid,
  };
}
