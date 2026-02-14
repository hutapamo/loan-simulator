import Decimal from 'decimal.js';

// ========== Enums ==========

export type DayCountConvention = 'ACT_365' | 'ACT_366' | 'ACT_ACT' | '30_360_ISDA';

export type InterestPostingRule = 'POST_MONTHLY_TO_INTEREST_DUE' | 'CAPITALISE_MONTHLY';

export type InterestSettlementRule = 'SETTLE_POSTED_ONLY' | 'SETTLE_POSTED_PLUS_ACCRUED';

export type PaymentDateShiftRule = 'NONE' | 'NEXT_BUSINESS_DAY' | 'PREV_BUSINESS_DAY';

export type BankBehaviourMode = 'KEEP_INSTALMENT_SHORTEN_TERM' | 'REDUCE_INSTALMENT_KEEP_TERM';

export type EventType = 'REGULAR_PAYMENT' | 'EXTRA_MONTHLY' | 'LUMP_SUM' | 'RATE_CHANGE' | 'INTEREST_POST';

export type ExtraMonthlyStartDate = 'NEXT_PAYMENT_DATE' | 'AS_OF_DATE' | 'CUSTOM';

// ========== Core Data Structures ==========

export interface RateScheduleEntry {
  start_date: string; // ISO date string
  annual_rate_percent: number;
}

export interface LumpSum {
  id: string;
  date: string; // ISO date string
  amount: number;
  label?: string;
}

export interface Event {
  date: string; // ISO date string
  type: EventType;
  amount?: Decimal;
  label?: string;
}

export interface DayState {
  date: string; // ISO date string
  principal: Decimal;
  interest_accrued_unposted: Decimal;
  interest_due_posted: Decimal;
  cumulative_interest_paid: Decimal;
  cumulative_paid_total: Decimal;
}

export interface MonthSummary {
  year: number;
  month: number; // 1-12
  interest_accrued: Decimal; // Interest accrued during this calendar month
  interest_paid: Decimal; // Interest paid by payment(s) in this month
  monthly_total_paid: Decimal; // All payments in this month (regular + lump sums)
  monthly_principal_reduction: Decimal;
  month_end_principal: Decimal;
  cumulative_interest_paid: Decimal;
  has_lump_sum: boolean; // True if a lump sum payment occurred in this month
}

// ========== Input Structures ==========

export interface LoanState {
  principal_outstanding: number;
  regular_instalment_amount: number;
  payment_day_of_month: number; // 1-31, recurring payment day
  payment_frequency: 'MONTHLY';
  
  // Optional display fields
  months_remaining?: number;
  loan_maturity_date?: string;
}

export interface InterestRules {
  annual_interest_rate_schedule: RateScheduleEntry[];
  day_count_convention: DayCountConvention;
  interest_posting_rule: InterestPostingRule;
  interest_posting_day: number; // 1-31
}

export interface PaymentRules {
  payment_waterfall_order: 'INTEREST_DUE -> PRINCIPAL';
  interest_settlement_on_payment_day: InterestSettlementRule;
  payment_date_shift_rule: PaymentDateShiftRule;
}

export interface ExtraMonthlyPayment {
  extra_monthly_amount: number;
  extra_monthly_start_date: ExtraMonthlyStartDate;
  extra_monthly_start_date_custom?: string; // if CUSTOM
  extra_monthly_end_date: 'UNTIL_PAYOFF' | 'CUSTOM';
  extra_monthly_end_date_custom?: string; // if CUSTOM
  extra_payment_day_same_as_regular: boolean;
  extra_payment_day_custom?: number; // 1-31, if not same as regular
}

export interface ScenarioControls {
  extra_monthly: ExtraMonthlyPayment;
  lump_sums: LumpSum[];
  treat_lump_sum_as_principal_only: boolean;
  bank_behaviour_mode: BankBehaviourMode;
}

export interface VerificationInput {
  opening_principal: number;
  interest_charged: number;
  payment_amount: number;
  payment_date: string;
  closing_principal: number;
  statement_start_date: string;
  statement_end_date: string;
}

// ========== Output Structures ==========

export interface SimulationResult {
  payoff_date: string;
  months_to_payoff: number;
  total_interest: Decimal;
  total_paid: Decimal;
  month_summaries: MonthSummary[];
  final_state: DayState;
}

export interface ComparisonResult {
  baseline: SimulationResult;
  scenario: SimulationResult;
  time_saved_months: number;
  interest_saved: Decimal;
}

export interface VerificationResult {
  passed: boolean;
  computed_closing_principal: Decimal;
  expected_closing_principal: Decimal;
  difference: Decimal;
  diagnostics?: string[];
}

// ========== Saved Scenario ==========

export interface SavedScenario {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  loan_state: LoanState;
  interest_rules: InterestRules;
  payment_rules: PaymentRules;
  scenario_controls: ScenarioControls;
}

// ========== Application State ==========

export interface AppState {
  loan_state: LoanState;
  interest_rules: InterestRules;
  payment_rules: PaymentRules;
  scenario_controls: ScenarioControls;
  saved_scenarios: SavedScenario[];
  current_scenario_id?: string;
  verification_input?: VerificationInput;
}

export type AppAction =
  | { type: 'UPDATE_LOAN_STATE'; payload: Partial<LoanState> }
  | { type: 'UPDATE_INTEREST_RULES'; payload: Partial<InterestRules> }
  | { type: 'UPDATE_PAYMENT_RULES'; payload: Partial<PaymentRules> }
  | { type: 'UPDATE_SCENARIO_CONTROLS'; payload: Partial<ScenarioControls> }
  | { type: 'UPDATE_EXTRA_MONTHLY'; payload: Partial<ExtraMonthlyPayment> }
  | { type: 'ADD_LUMP_SUM'; payload: LumpSum }
  | { type: 'UPDATE_LUMP_SUM'; payload: { id: string; data: Partial<LumpSum> } }
  | { type: 'DELETE_LUMP_SUM'; payload: string }
  | { type: 'SAVE_SCENARIO'; payload: { name: string } }
  | { type: 'LOAD_SCENARIO'; payload: string }
  | { type: 'DELETE_SCENARIO'; payload: string }
  | { type: 'UPDATE_VERIFICATION_INPUT'; payload: VerificationInput | undefined }
  | { type: 'LOAD_FROM_STORAGE'; payload: AppState }
  | { type: 'RESET_TO_DEFAULTS' };
