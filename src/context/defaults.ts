import type { AppState, LoanState, InterestRules, PaymentRules, ScenarioControls, ExtraMonthlyPayment } from '../types/index';

/**
 * Get default loan state
 */
export function getDefaultLoanState(): LoanState {
  return {
    principal_outstanding: 1000000,
    regular_instalment_amount: 10000,
    payment_day_of_month: 1,
    payment_frequency: 'MONTHLY',
  };
}

/**
 * Get default interest rules
 */
export function getDefaultInterestRules(): InterestRules {
  const today = new Date().toISOString().split('T')[0];

  return {
    annual_interest_rate_schedule: [
      {
        start_date: today,
        annual_rate_percent: 11.5,
      },
    ],
    day_count_convention: 'ACT_365',
    interest_posting_rule: 'POST_MONTHLY_TO_INTEREST_DUE',
    interest_posting_day: 1,
  };
}

/**
 * Get default payment rules
 */
export function getDefaultPaymentRules(): PaymentRules {
  return {
    payment_waterfall_order: 'INTEREST_DUE -> PRINCIPAL',
    interest_settlement_on_payment_day: 'SETTLE_POSTED_PLUS_ACCRUED',
    payment_date_shift_rule: 'NEXT_BUSINESS_DAY',
  };
}

/**
 * Get default extra monthly payment
 */
export function getDefaultExtraMonthly(): ExtraMonthlyPayment {
  return {
    extra_monthly_amount: 0,
    extra_monthly_start_date: 'NEXT_PAYMENT_DATE',
    extra_monthly_end_date: 'UNTIL_PAYOFF',
    extra_payment_day_same_as_regular: true,
  };
}

/**
 * Get default scenario controls
 */
export function getDefaultScenarioControls(): ScenarioControls {
  return {
    extra_monthly: getDefaultExtraMonthly(),
    lump_sums: [],
    treat_lump_sum_as_principal_only: false,
    bank_behaviour_mode: 'KEEP_INSTALMENT_SHORTEN_TERM',
  };
}

/**
 * Get default application state
 */
export function getDefaultAppState(): AppState {
  return {
    loan_state: getDefaultLoanState(),
    interest_rules: getDefaultInterestRules(),
    payment_rules: getDefaultPaymentRules(),
    scenario_controls: getDefaultScenarioControls(),
    saved_scenarios: [],
  };
}

/**
 * Load state from localStorage
 */
export function loadStateFromStorage(): AppState | null {
  try {
    const saved = localStorage.getItem('loan-simulator-state');
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (error) {
    console.error('Failed to load state from storage:', error);
  }
  return null;
}

/**
 * Save state to localStorage
 */
export function saveStateToStorage(state: AppState): void {
  try {
    localStorage.setItem('loan-simulator-state', JSON.stringify(state));
  } catch (error) {
    console.error('Failed to save state to storage:', error);
  }
}
