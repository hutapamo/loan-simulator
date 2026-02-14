import { useState, useMemo } from 'react';
import type { ComparisonResult } from '../types/index';
import { formatCurrency } from '../engine/utils';

interface AmortisationTableProps {
  comparison: ComparisonResult;
}

export function AmortisationTable({ comparison }: AmortisationTableProps) {
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [showPaymentMonthsOnly, setShowPaymentMonthsOnly] = useState(false);

  const { years, yearSummaries } = useMemo(() => {
    try {
      const scenario = comparison.scenario;
      const yearsSet = new Set<number>();
      const yearMap = new Map<number, any>();

      scenario.month_summaries.forEach(summary => {
        yearsSet.add(summary.year);

        if (!yearMap.has(summary.year)) {
          yearMap.set(summary.year, {
            year: summary.year,
            interest_accrued: summary.interest_accrued,
            interest_paid: summary.interest_paid,
            principal_repaid: summary.monthly_principal_reduction,
            total_paid: summary.monthly_total_paid,
            months: [summary],
          });
        } else {
          const yearData = yearMap.get(summary.year);
          yearData.interest_accrued = yearData.interest_accrued.plus(summary.interest_accrued);
          yearData.interest_paid = yearData.interest_paid.plus(summary.interest_paid);
          yearData.principal_repaid = yearData.principal_repaid.plus(summary.monthly_principal_reduction);
          yearData.total_paid = yearData.total_paid.plus(summary.monthly_total_paid);
          yearData.months.push(summary);
        }
      });

      return {
        years: Array.from(yearsSet).sort(),
        yearSummaries: yearMap,
      };
    } catch (error) {
      return { years: [], yearSummaries: new Map() };
    }
  }, [comparison]);

  if (years.length === 0) {
    return null;
  }

  const currentYearData = selectedYear ? yearSummaries.get(selectedYear) : null;

  return (
    <div className="bg-white shadow-md rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-800">Amortisation Schedule</h3>
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <span className="inline-block w-4 h-4 bg-blue-100 border border-blue-200 rounded"></span>
          <span>Lump Sum Payment Months</span>
        </div>
      </div>

      <div className="flex items-center gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Select Year
          </label>
          <select
            value={selectedYear || ''}
            onChange={(e) => setSelectedYear(e.target.value ? parseInt(e.target.value) : null)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Years</option>
            {years.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>

        <label className="flex items-center text-sm text-gray-700 mt-6">
          <input
            type="checkbox"
            checked={showPaymentMonthsOnly}
            onChange={(e) => setShowPaymentMonthsOnly(e.target.checked)}
            className="mr-2"
          />
          Show payment months only
        </label>
      </div>

      {selectedYear && currentYearData && (
        <div className="mb-4 p-4 bg-blue-50 rounded-md">
          <h4 className="font-semibold text-gray-800 mb-2">Year {selectedYear} Summary</h4>
          <div className="grid grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-gray-600">Interest Accrued</p>
              <p className="font-semibold">{formatCurrency(currentYearData.interest_accrued)}</p>
            </div>
            <div>
              <p className="text-gray-600">Interest Paid</p>
              <p className="font-semibold">{formatCurrency(currentYearData.interest_paid)}</p>
            </div>
            <div>
              <p className="text-gray-600">Principal Repaid</p>
              <p className="font-semibold">{formatCurrency(currentYearData.principal_repaid)}</p>
            </div>
            <div>
              <p className="text-gray-600">Total Paid</p>
              <p className="font-semibold">{formatCurrency(currentYearData.total_paid)}</p>
            </div>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Month
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Interest Accrued
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Interest Paid
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Total Paid
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Principal Reduction
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Balance
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {selectedYear
              ? currentYearData?.months
                  .filter((summary: any) => !showPaymentMonthsOnly || summary.monthly_total_paid.gt(0))
                  .map((summary: any, index: number) => (
                    <tr key={index} className={summary.has_lump_sum ? 'bg-blue-100 text-blue-900' : ''}>
                      <td className="px-4 py-3 text-sm">
                        {summary.year}/{String(summary.month).padStart(2, '0')}
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        {formatCurrency(summary.interest_accrued)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        {formatCurrency(summary.interest_paid)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        {formatCurrency(summary.monthly_total_paid)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        {formatCurrency(summary.monthly_principal_reduction)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-semibold">
                        {formatCurrency(summary.month_end_principal)}
                      </td>
                    </tr>
                  ))
              : comparison.scenario.month_summaries
                  .filter((summary: any) => !showPaymentMonthsOnly || summary.monthly_total_paid.gt(0))
                  .map((summary: any, index: number) => (
                    <tr key={index} className={summary.has_lump_sum ? 'bg-blue-100 text-blue-900' : ''}>
                      <td className="px-4 py-3 text-sm">
                        {summary.year}/{String(summary.month).padStart(2, '0')}
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        {formatCurrency(summary.interest_accrued)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        {formatCurrency(summary.interest_paid)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        {formatCurrency(summary.monthly_total_paid)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        {formatCurrency(summary.monthly_principal_reduction)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-semibold">
                        {formatCurrency(summary.month_end_principal)}
                      </td>
                    </tr>
                  ))
            }
          </tbody>
        </table>
      </div>
    </div>
  );
}
