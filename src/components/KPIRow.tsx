import type { ComparisonResult } from '../types/index';
import { formatCurrency, formatDuration } from '../engine/utils';
import Decimal from 'decimal.js';

interface KPIRowProps {
  comparison: ComparisonResult;
}

export function KPIRow({ comparison }: KPIRowProps) {
  const { baseline, scenario, time_saved_months, interest_saved } = comparison;
  
  const percentageSaved = baseline.total_interest.gt(0)
    ? interest_saved.div(baseline.total_interest).times(100)
    : new Decimal(0);

  return (
    <div className="bg-gradient-to-br from-blue-50 via-white to-green-50 shadow-lg rounded-lg p-6 mb-6 border-2 border-blue-200">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-1 h-8 bg-gradient-to-b from-blue-500 to-green-500 rounded-full"></div>
        <h2 className="text-xl font-bold text-gray-800">Scenario Comparison</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Baseline */}
        <div className="border-r border-gray-200 pr-6">
          <h3 className="text-sm font-semibold text-gray-600 mb-3 uppercase">Baseline (No Extras)</h3>
          <div className="space-y-3">
            <KPIItem
              label="Payoff Date"
              value={new Date(baseline.payoff_date).toLocaleDateString('en-ZA')}
            />
            <KPIItem
              label="Months to Payoff"
              value={formatDuration(baseline.months_to_payoff)}
            />
            <KPIItem
              label="Total Interest"
              value={formatCurrency(baseline.total_interest)}
            />
            <KPIItem
              label="Total Paid"
              value={formatCurrency(baseline.total_paid)}
            />
          </div>
        </div>

        {/* Scenario */}
        <div className="border-r border-gray-200 pr-6">
          <h3 className="text-sm font-semibold text-gray-600 mb-3 uppercase">With Extras</h3>
          <div className="space-y-3">
            <KPIItem
              label="Payoff Date"
              value={new Date(scenario.payoff_date).toLocaleDateString('en-ZA')}
            />
            <KPIItem
              label="Months to Payoff"
              value={formatDuration(scenario.months_to_payoff)}
            />
            <KPIItem
              label="Total Interest"
              value={formatCurrency(scenario.total_interest)}
            />
            <KPIItem
              label="Total Paid"
              value={formatCurrency(scenario.total_paid)}
            />
          </div>
        </div>

        {/* Difference */}
        <div>
          <h3 className="text-sm font-semibold text-green-600 mb-3 uppercase">Savings</h3>
          <div className="space-y-3">
            <KPIItem
              label="Time Saved"
              value={formatDuration(time_saved_months)}
              highlight="green"
            />
            <KPIItem
              label="Interest Saved"
              value={formatCurrency(interest_saved)}
              highlight="green"
            />
            <KPIItem
              label="Interest Savings"
              value={`${percentageSaved.toFixed(1)}%`}
              highlight="green"
            />
            <KPIItem
              label="Extra Payments"
              value={formatCurrency(baseline.total_paid.minus(scenario.total_paid).abs())}
              highlight="blue"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

interface KPIItemProps {
  label: string;
  value: string;
  highlight?: 'green' | 'blue';
}

function KPIItem({ label, value, highlight }: KPIItemProps) {
  const valueClass = highlight === 'green' 
    ? 'text-green-600 font-bold'
    : highlight === 'blue'
    ? 'text-blue-600 font-bold'
    : 'text-gray-800 font-semibold';

  return (
    <div>
      <p className="text-xs text-gray-500 uppercase">{label}</p>
      <p className={`text-lg ${valueClass}`}>{value}</p>
    </div>
  );
}
