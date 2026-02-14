import { useState, useCallback } from 'react';
import { useAppContext } from '../context/AppContext';
import { formatCurrency } from '../engine/utils';
import { LumpSumModal } from './LumpSumModal';
import { InfoTooltip } from './InfoTooltip';

export function ControlStrip() {
  const { state, dispatch } = useAppContext();
  const [showLumpSumModal, setShowLumpSumModal] = useState(false);
  const [editingLumpSum, setEditingLumpSum] = useState<string | null>(null);

  const { scenario_controls, loan_state } = state;
  const maxSliderValue = loan_state.regular_instalment_amount * 4;

  const handleSliderChange = useCallback((value: number) => {
    dispatch({
      type: 'UPDATE_EXTRA_MONTHLY',
      payload: { extra_monthly_amount: value },
    });
  }, [dispatch]);

  const handleAddLumpSum = () => {
    setEditingLumpSum(null);
    setShowLumpSumModal(true);
  };

  const handleEditLumpSum = (id: string) => {
    setEditingLumpSum(id);
    setShowLumpSumModal(true);
  };

  const handleDeleteLumpSum = (id: string) => {
    if (confirm('Delete this lump sum payment?')) {
      dispatch({ type: 'DELETE_LUMP_SUM', payload: id });
    }
  };

  return (
    <div className="bg-white rounded-lg p-4 mb-4">
      <h2 className="text-xl font-bold text-gray-800 mb-3">Extra Payments</h2>

      {/* Extra Monthly Payment Slider */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <label className="flex items-center text-sm font-medium text-gray-700">
            Extra Monthly Amount
            <InfoTooltip text="Additional amount to pay every month on top of your regular payment. Move slider to see impact on payoff time and interest." />
          </label>
          <span className="text-base font-bold text-blue-600">
            {formatCurrency(scenario_controls.extra_monthly.extra_monthly_amount)}
          </span>
        </div>
        
        <input
          type="range"
          min="0"
          max={maxSliderValue}
          step="100"
          value={scenario_controls.extra_monthly.extra_monthly_amount}
          onChange={(e) => handleSliderChange(parseFloat(e.target.value))}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
        />
        
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>R0</span>
          <span>{formatCurrency(maxSliderValue)}</span>
        </div>

        <div className="mt-3">
          <label className="flex items-center text-xs text-gray-700">
            <input
              type="checkbox"
              checked={scenario_controls.treat_lump_sum_as_principal_only}
              onChange={(e) => dispatch({
                type: 'UPDATE_SCENARIO_CONTROLS',
                payload: { treat_lump_sum_as_principal_only: e.target.checked },
              })}
              className="mr-2"
            />
            Apply lump sums directly to principal
            <InfoTooltip text="When ON: lump sums skip interest and reduce loan balance directly. Only enable if your bank allows principal-only payments." />
          </label>
        </div>
      </div>

      {/* Lump Sums List */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <h3 className="flex items-center text-sm font-medium text-gray-700">
            One-Time Lump Sum Payments
            <InfoTooltip text="Add big one-off payments like bonuses, tax refunds, or inheritance. Each can have a specific date and amount." />
          </h3>
          <button
            onClick={handleAddLumpSum}
            className="px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-xs font-medium"
          >
            + Add
          </button>
        </div>

        {scenario_controls.lump_sums.length === 0 ? (
          <p className="text-xs text-gray-500 italic p-2 bg-gray-50 rounded">No lump sum payments added yet</p>
        ) : (
          <div className="space-y-2">
            {scenario_controls.lump_sums.map((lumpSum) => (
              <div
                key={lumpSum.id}
                className="flex items-center justify-between p-2 bg-gray-50 rounded-md border border-gray-200"
              >
                <div>
                  <p className="text-sm font-medium text-gray-800">
                    {formatCurrency(lumpSum.amount)}
                  </p>
                  <p className="text-xs text-gray-600">
                    {new Date(lumpSum.date).toLocaleDateString('en-ZA')}
                    {lumpSum.label && ` • ${lumpSum.label}`}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEditLumpSum(lumpSum.id)}
                    className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteLumpSum(lumpSum.id)}
                    className="text-red-600 hover:text-red-800 text-xs font-medium"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showLumpSumModal && (
        <LumpSumModal
          lumpSumId={editingLumpSum}
          onClose={() => setShowLumpSumModal(false)}
        />
      )}
    </div>
  );
}
