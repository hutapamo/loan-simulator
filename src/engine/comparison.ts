import Decimal from 'decimal.js';
import type {
  LoanState,
  InterestRules,
  PaymentRules,
  ScenarioControls,
  ComparisonResult,
  VerificationInput,
  VerificationResult,
} from '../types/index';
import { runSimulation } from './simulator';
import { monthsDifference } from './utils';

/**
 * Run baseline and scenario simulations and compare results
 */
export function compareScenarios(
  loanState: LoanState,
  interestRules: InterestRules,
  paymentRules: PaymentRules,
  scenarioControls: ScenarioControls
): ComparisonResult {
  // Baseline: no extras
  let baseline;
  try {
    baseline = runSimulation(loanState, interestRules, paymentRules);
  } catch (error) {
    throw new Error(`Baseline calculation failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  // Scenario: with extras and lump sums
  let scenario;
  try {
    scenario = runSimulation(loanState, interestRules, paymentRules, scenarioControls);
  } catch (error) {
    throw new Error(`Scenario calculation failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  // Calculate differences
  const time_saved_months = monthsDifference(scenario.payoff_date, baseline.payoff_date);
  const interest_saved = baseline.total_interest.minus(scenario.total_interest);

  return {
    baseline,
    scenario,
    time_saved_months,
    interest_saved,
  };
}

/**
 * Verify loan configuration against a bank statement
 * NOTE: This feature has been removed from scope but function kept for type compatibility
 */
export function verifyAgainstStatement(
  _verificationInput: VerificationInput,
  _loanState: LoanState,
  _interestRules: InterestRules,
  _paymentRules: PaymentRules
): VerificationResult {
  // Feature removed - return stub
  return {
    passed: false,
    diagnostics: ['Verification feature has been removed'],
    computed_closing_principal: new Decimal(0),
    expected_closing_principal: new Decimal(0),
    difference: new Decimal(0),
  };
}
