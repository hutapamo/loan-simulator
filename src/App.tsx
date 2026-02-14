import { useState } from 'react';
import { AppProvider, useAppContext } from './context/AppContext';
import { InputPanel } from './components/InputPanel';
import { ControlStrip } from './components/ControlStrip';
import { KPIRow } from './components/KPIRow';
import { BalanceChart } from './components/BalanceChart';
import { InterestCostChart } from './components/InterestCostChart';
import { CumulativeInterestChart } from './components/CumulativeInterestChart';
import { AmortisationTable } from './components/AmortisationTable';
import { AssumptionsPanel } from './components/AssumptionsPanel';
import type { ComparisonResult } from './types/index';
import { compareScenarios } from './engine/comparison';

function AppContent() {
  const { state } = useAppContext();
  const [results, setResults] = useState<ComparisonResult | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCalculate = () => {
    setIsCalculating(true);
    setError(null);
    setResults(null); // Clear previous results
    
    // Use setTimeout to allow UI to update before heavy calculation
    setTimeout(() => {
      try {
        const comparison = compareScenarios(
          state.loan_state,
          state.interest_rules,
          state.payment_rules,
          state.scenario_controls
        );
        setResults(comparison);
      } catch (err) {
        setError((err as Error).message);
        setResults(null); // Ensure results are cleared on error
      } finally {
        setIsCalculating(false);
      }
    }, 100);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-blue-600 text-white shadow-lg sticky top-0 z-50">
        <div className="max-w-full mx-auto px-6 py-4">
          <h1 className="text-2xl font-bold">Loan Payoff Simulator</h1>
          <p className="text-blue-100 text-sm mt-1">
            Configure your loan, adjust extra payments, then click Calculate
          </p>
        </div>
      </header>

      {/* Sticky Configuration Strip */}
      <div className="sticky top-[88px] z-40">
        <AssumptionsPanel />
      </div>

      <main className="flex h-[calc(100vh-200px)]">
        {/* LEFT PANEL - Inputs */}
        <div className="w-1/3 overflow-y-auto bg-white border-r border-gray-300 p-6">
          <InputPanel />
          <ControlStrip />
          
          <button
            onClick={handleCalculate}
            disabled={isCalculating}
            className="w-full mt-6 py-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-bold text-lg rounded-lg shadow-lg transition-colors"
          >
            {isCalculating ? 'Calculating...' : 'Calculate Scenarios 💰'}
          </button>
        </div>

        {/* RIGHT PANEL - Results */}
        <div className="w-2/3 overflow-y-auto bg-gray-50 p-6">
          {!results && !error && (
            <div className="flex items-center justify-center h-full text-gray-400">
              <div className="text-center">
                <p className="text-6xl mb-4">📊</p>
                <p className="text-xl font-semibold">Ready to calculate</p>
                <p className="text-sm mt-2">Configure your loan on the left and click Calculate</p>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center h-full">
              <div className="bg-red-50 border-2 border-red-300 rounded-lg p-8 max-w-2xl shadow-lg">
                <div className="flex items-start gap-4">
                  <span className="text-5xl">⚠️</span>
                  <div>
                    <p className="text-red-900 font-bold text-xl mb-2">Calculation Error</p>
                    <p className="text-red-700 text-base leading-relaxed">{error}</p>
                    <p className="text-red-600 text-sm mt-4">Please adjust your parameters and try again.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {results && (
            <div className="space-y-6">
              <KPIRow comparison={results} />
              <BalanceChart comparison={results} />
              <InterestCostChart comparison={results} />
              <CumulativeInterestChart comparison={results} />
              <AmortisationTable comparison={results} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

export default App;
