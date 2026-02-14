import { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import type { LumpSum } from '../types/index';

interface LumpSumModalProps {
  lumpSumId: string | null;
  onClose: () => void;
}

export function LumpSumModal({ lumpSumId, onClose }: LumpSumModalProps) {
  const { state, dispatch } = useAppContext();
  const existingLumpSum = lumpSumId 
    ? state.scenario_controls.lump_sums.find(ls => ls.id === lumpSumId)
    : null;

  const [date, setDate] = useState(existingLumpSum?.date || new Date().toISOString().split('T')[0]);
  const [amount, setAmount] = useState(existingLumpSum?.amount.toString() || '');
  const [label, setLabel] = useState(existingLumpSum?.label || '');

  const handleSave = () => {
    if (!date || !amount || parseFloat(amount) <= 0) {
      alert('Please enter a valid date and amount');
      return;
    }

    if (lumpSumId) {
      // Update existing
      dispatch({
        type: 'UPDATE_LUMP_SUM',
        payload: {
          id: lumpSumId,
          data: {
            date,
            amount: parseFloat(amount),
            label: label || undefined,
          },
        },
      });
    } else {
      // Add new
      const newLumpSum: LumpSum = {
        id: `lump-${Date.now()}`,
        date,
        amount: parseFloat(amount),
        label: label || undefined,
      };
      dispatch({ type: 'ADD_LUMP_SUM', payload: newLumpSum });
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 className="text-xl font-bold text-gray-800 mb-4">
          {lumpSumId ? 'Edit Lump Sum Payment' : 'Add Lump Sum Payment'}
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Amount (R)
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min="0"
              step="100"
              placeholder="0.00"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Label (optional)
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g., Bonus, Tax refund"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:text-gray-900 font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
          >
            {lumpSumId ? 'Update' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  );
}
