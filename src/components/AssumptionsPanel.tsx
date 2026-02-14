import { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { formatCurrency } from '../engine/utils';

export function AssumptionsPanel() {
  const { state } = useAppContext();
  const [isExpanded, setIsExpanded] = useState(false);

  const { loan_state, interest_rules, payment_rules, scenario_controls } = state;
  
  const totalLumpSums = scenario_controls.lump_sums.reduce(
    (sum, ls) => sum + ls.amount, 
    0
  );

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b-2 border-blue-200 shadow-sm">
      <div className="max-w-full mx-auto px-6 py-3">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Scenario Summary</h3>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs text-blue-600 hover:text-blue-800 font-semibold px-3 py-1 rounded hover:bg-blue-100 transition-colors"
          >
            {isExpanded ? '▲ Collapse' : '▼ Expand Details'}
          </button>
        </div>

        {/* Always visible summary */}
        <div className="mt-2 flex flex-wrap gap-x-8 gap-y-1 text-xs">
          <SummaryItem label="Monthly Payment" value={formatCurrency(loan_state.regular_instalment_amount)} />
          <SummaryItem label="Extra Monthly" value={formatCurrency(scenario_controls.extra_monthly.extra_monthly_amount)} />
          <SummaryItem label="Total Lump Sum" value={totalLumpSums > 0 ? formatCurrency(totalLumpSums) : 'None'} />
          <SummaryItem label="Rate" value={`${interest_rules.annual_interest_rate_schedule[0]?.annual_rate_percent}% p.a.`} />
          <SummaryItem label="Convention" value={interest_rules.day_count_convention.replace(/_/g, '/')} />
        </div>

        {isExpanded && (
          <div className="mt-4 pb-2 grid grid-cols-1 md:grid-cols-3 gap-6 border-t border-blue-200 pt-4">
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-gray-600 uppercase mb-2">Payment Details</h4>
              <DetailItem
                label="Monthly Payment"
                value={formatCurrency(loan_state.regular_instalment_amount)}
              />
              <DetailItem
                label="Extra Monthly Payment"
                value={formatCurrency(scenario_controls.extra_monthly.extra_monthly_amount)}
              />
              <DetailItem
                label="Number of Lump Sums"
                value={scenario_controls.lump_sums.length.toString()}
              />
              <DetailItem
                label="Total Lump Sum Payments"
                value={formatCurrency(totalLumpSums)}
              />
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-bold text-gray-600 uppercase mb-2">Interest & Settlement Rules</h4>
              <DetailItem
                label="Day Count Convention"
                value={interest_rules.day_count_convention.replace(/_/g, '/')}
              />
              <DetailItem
                label="Interest Posting Rule"
                value={interest_rules.interest_posting_rule === 'POST_MONTHLY_TO_INTEREST_DUE' 
                  ? 'Post to Interest Due' 
                  : 'Capitalise Monthly'}
              />
              <DetailItem
                label="Interest Posting Day"
                value={`Day ${interest_rules.interest_posting_day}`}
              />
              <DetailItem
                label="Settlement Rule"
                value={payment_rules.interest_settlement_on_payment_day === 'SETTLE_POSTED_ONLY' 
                  ? 'Posted Only' 
                  : 'Posted + Accrued'}
              />
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-bold text-gray-600 uppercase mb-2">Rate Schedule</h4>
              <div className="space-y-1">
                {interest_rules.annual_interest_rate_schedule.map((entry, index) => (
                  <div key={index} className="text-xs text-gray-700">
                    <span className="font-medium">{new Date(entry.start_date).toLocaleDateString('en-ZA')}:</span> {entry.annual_rate_percent}% p.a.
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface SummaryItemProps {
  label: string;
  value: string;
}

function SummaryItem({ label, value }: SummaryItemProps) {
  return (
    <div className="flex items-baseline gap-1">
      <span className="text-gray-500 font-medium">{label}:</span>
      <span className="text-gray-800 font-bold">{value}</span>
    </div>
  );
}

interface DetailItemProps {
  label: string;
  value: string;
}

function DetailItem({ label, value }: DetailItemProps) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-xs text-gray-600">{label}</span>
      <span className="text-xs font-semibold text-gray-800">{value}</span>
    </div>
  );
}
