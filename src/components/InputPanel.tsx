import { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { InfoTooltip } from './InfoTooltip';

export function InputPanel() {
  const { state, dispatch } = useAppContext();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const { loan_state, interest_rules, payment_rules } = state;

  return (
    <div className="bg-white rounded-lg p-4 mb-4">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-xl font-bold text-gray-800">Loan Configuration</h2>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
        >
          {isCollapsed ? '+ Expand' : '− Collapse'}
        </button>
      </div>

      {!isCollapsed && (
        <div className="space-y-6">
          {/* Loan State */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 border-b pb-1">Loan Details</h3>
            
            <div>
              <label className="flex items-center text-sm font-medium text-gray-700 mb-1">
                Principal Outstanding (R)
                <InfoTooltip text="Your loan balance as of the last payment date (after payment was made). This is your clean starting balance." />
              </label>
              <input
                type="number"
                value={loan_state.principal_outstanding}
                onChange={(e) => dispatch({ 
                  type: 'UPDATE_LOAN_STATE', 
                  payload: { principal_outstanding: parseFloat(e.target.value) } 
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="flex items-center text-sm font-medium text-gray-700 mb-1">
                Regular Monthly Payment (R)
                <InfoTooltip text="Your normal monthly instalment amount - the amount that gets debited from your account each month." />
              </label>
              <input
                type="number"
                value={loan_state.regular_instalment_amount}
                onChange={(e) => dispatch({ 
                  type: 'UPDATE_LOAN_STATE', 
                  payload: { regular_instalment_amount: parseFloat(e.target.value) } 
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="flex items-center text-sm font-medium text-gray-700 mb-1">
                Payment Day of Month
                <InfoTooltip text="Which day of the month does your payment come off? (1-31). Example: if you pay on the 20th of each month, enter 20. The system will automatically calculate when your last payment was." />
              </label>
              <input
                type="number"
                min="1"
                max="31"
                value={loan_state.payment_day_of_month}
                onChange={(e) => dispatch({ 
                  type: 'UPDATE_LOAN_STATE', 
                  payload: { payment_day_of_month: parseInt(e.target.value) || 1 } 
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Interest Rules */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 border-b pb-1">Interest Rules</h3>
            
            <div>
              <label className="flex items-center text-sm font-medium text-gray-700 mb-1">
                Annual Interest Rate (%)
                <InfoTooltip text="Your loan's interest rate per year (e.g., 11.5%). Find this on your loan agreement or statement." />
              </label>
              <input
                type="number"
                step="0.01"
                value={interest_rules.annual_interest_rate_schedule[0]?.annual_rate_percent || 0}
                onChange={(e) => {
                  const newSchedule = [...interest_rules.annual_interest_rate_schedule];
                  if (newSchedule[0]) {
                    newSchedule[0].annual_rate_percent = parseFloat(e.target.value);
                  }
                  dispatch({ 
                    type: 'UPDATE_INTEREST_RULES', 
                    payload: { annual_interest_rate_schedule: newSchedule } 
                  });
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="flex items-center text-sm font-medium text-gray-700 mb-1">
                Day Count Convention
                <InfoTooltip text="How your bank counts days to calculate daily interest. Most SA banks use ACT/365 (actual days ÷ 365). Check your loan agreement or use ACT/365 as default." />
              </label>
              <select
                value={interest_rules.day_count_convention}
                onChange={(e) => dispatch({ 
                  type: 'UPDATE_INTEREST_RULES', 
                  payload: { day_count_convention: e.target.value as any } 
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ACT_365">ACT/365 (Most common in SA)</option>
                <option value="ACT_366">ACT/366</option>
                <option value="ACT_ACT">ACT/ACT</option>
                <option value="30_360_ISDA">30/360 ISDA (US banks)</option>
              </select>
            </div>

            <div>
              <label className="flex items-center text-sm font-medium text-gray-700 mb-1">
                Interest Posting Rule
                <InfoTooltip text="How interest gets added to your loan. 'Post to Interest Due' = interest becomes payable (most common). 'Capitalise' = interest added to principal balance." />
              </label>
              <select
                value={interest_rules.interest_posting_rule}
                onChange={(e) => dispatch({ 
                  type: 'UPDATE_INTEREST_RULES', 
                  payload: { interest_posting_rule: e.target.value as any } 
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="POST_MONTHLY_TO_INTEREST_DUE">Post to Interest Due (Most common)</option>
                <option value="CAPITALISE_MONTHLY">Capitalise Monthly (Rare)</option>
              </select>
            </div>

            <div>
              <label className="flex items-center text-sm font-medium text-gray-700 mb-1">
                Interest Posting Day (1-31)
                <InfoTooltip text="Day of each month when interest is officially added to your account. Usually the 1st. Check your statement's 'interest charged' date." />
              </label>
              <input
                type="number"
                min="1"
                max="31"
                value={interest_rules.interest_posting_day}
                onChange={(e) => dispatch({ 
                  type: 'UPDATE_INTEREST_RULES', 
                  payload: { interest_posting_day: parseInt(e.target.value) } 
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Payment Rules */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 border-b pb-1">Payment Rules</h3>
            
            <div>
              <label className="flex items-center text-sm font-medium text-gray-700 mb-1">
                Interest Settlement Rule
                <InfoTooltip text="When you pay, what interest gets deducted? 'Posted + Accrued' = all interest owed (most accurate). 'Posted Only' = only official interest balance." />
              </label>
              <select
                value={payment_rules.interest_settlement_on_payment_day}
                onChange={(e) => dispatch({ 
                  type: 'UPDATE_PAYMENT_RULES', 
                  payload: { interest_settlement_on_payment_day: e.target.value as any } 
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="SETTLE_POSTED_PLUS_ACCRUED">Posted + Accrued (Recommended)</option>
                <option value="SETTLE_POSTED_ONLY">Posted Only</option>
              </select>
            </div>

            <div>
              <label className="flex items-center text-sm font-medium text-gray-700 mb-1">
                Weekend Payment Handling
                <InfoTooltip text="If payment date falls on weekend, should it move to next Monday, previous Friday, or stay? Most banks move to next business day." />
              </label>
              <select
                value={payment_rules.payment_date_shift_rule}
                onChange={(e) => dispatch({ 
                  type: 'UPDATE_PAYMENT_RULES', 
                  payload: { payment_date_shift_rule: e.target.value as any } 
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="NEXT_BUSINESS_DAY">Next Business Day (Most common)</option>
                <option value="PREV_BUSINESS_DAY">Previous Business Day</option>
                <option value="NONE">No Adjustment</option>
              </select>
            </div>

            <div className="p-3 bg-blue-50 rounded-md text-sm">
              <p className="text-blue-800">
                <strong>Payment Order:</strong> Interest Due → Principal<br/>
                <span className="text-xs text-blue-600">(Your payment covers interest first, then reduces the loan balance)</span>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
