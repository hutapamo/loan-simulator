# Loan Payoff Interactive Simulator

A comprehensive, interactive web application for modeling home loan repayment scenarios with **daily-accurate interest accrual** and bank-style rules.

## Features

- **Daily Interest Accrual**: Precise day-by-day interest calculations using configurable day count conventions
- **Interactive Controls**: 
  - Slider for extra monthly payments (up to 4× regular instalment)
  - Add multiple dated lump-sum payments
- **Real-time Comparison**: Baseline (do-nothing) vs scenario with extras
- **Comprehensive Visualizations**:
  - Remaining balance over time
  - Monthly interest cost trends
  - Cumulative interest comparison
  - Detailed amortisation schedule
- **Bank Configuration**: Match your lender's specific rules
  - Day count conventions (ACT/365, ACT/366, ACT/ACT, 30/360 ISDA)
  - Interest posting rules (monthly to due, or capitalise)
  - Payment settlement rules (posted only, or posted + accrued)
  - Payment date shift rules (weekends)
- **Statement Verification**: Validate your configuration against actual bank statements
- **Scenario Persistence**: Save and load multiple named scenarios (localStorage)

## Tech Stack

- **React 19** with TypeScript
- **Vite** for blazing-fast dev experience
- **Tailwind CSS** for styling
- **Recharts** for interactive charts
- **Decimal.js** for high-precision arithmetic
- **Vitest** for testing

## Getting Started

### Prerequisites

- Node.js 18+ and npm

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Run tests
npm test
```

### First-Time Setup

1. **Configure Your Loan**:
   - Enter your current principal balance
   - Set your regular instalment amount
   - Input your next payment date
   - Optionally add accrued interest for mid-cycle accuracy

2. **Set Interest Rules**:
   - Annual interest rate (%)
   - Day count convention (usually ACT/365 for SA)
   - Interest posting day (usually 1st of month)
   - Posting rule (usually "Post to Interest Due")

3. **Set Payment Rules**:
   - Settlement rule (usually "Posted + Accrued")
   - Date shift rule (usually "Next Business Day")

4. **Verify Configuration** (Recommended):
   - Expand "Match My Statement"
   - Enter your last statement details
   - Check if computed closing balance matches (within R0.01)

5. **Explore Scenarios**:
   - Use the slider to add extra monthly payments
   - Add one-off lump sums (bonus, tax refund, etc.)
   - Watch the charts and KPIs update in real-time

## Required Inputs for Accurate Results

For **deterministic, non-estimate** results, provide:

### Loan State (Required)
- As of date (today)
- Principal outstanding (current balance)
- Regular instalment amount
- Next payment date

### Mid-Cycle Interest (Strongly Recommended)
Either:
- Accrued interest to date (from statement), OR
- Last interest posting date + principal on that date

Without this, mid-cycle interest is estimated as zero, which may cause slight inaccuracies.

### Interest Rules (Required)
- Annual interest rate schedule (with start dates)
- Day count convention
- Interest posting rule and posting day

### Payment Rules (Required)
- Interest settlement rule
- Payment date shift rule (for weekends)

## How Interest Accrual Works

The simulator uses a **daily loop** with the following steps each day:

1. Apply rate changes (if scheduled)
2. Accrue daily interest: `interest += principal × (annual_rate / day_count_basis)`
3. Post interest monthly (on posting day)
4. Process payments via waterfall: Interest Due → Principal
5. Check for payoff (principal ≤ 0 and all interest paid)

This matches how most banks actually calculate loan interest.

## Day Count Conventions

- **ACT/365**: Actual days, 365-day year (most common in South Africa)
- **ACT/366**: Actual days, 366-day year
- **ACT/ACT**: Actual days, actual year days (365 or 366 for leap years)
- **30/360 ISDA**: 30-day months, 360-day year (US convention)

## Payment Waterfall

All payments (regular, extra, lump sums) follow this order:
1. **Interest Due** (posted interest bucket)
2. **Principal** (remaining amount reduces principal)

Exception: Enable "Apply lump sums directly to principal" to bypass interest for lump sums only.

## Scenarios & Persistence

- **Auto-save**: Your last configuration is saved automatically to localStorage
- **Named scenarios**: Save multiple what-if scenarios with custom names
- **No cloud sync**: All data stays in your browser

## Warnings

The app will warn you if:
- Mid-cycle interest data is missing (results may be approximate)
- Rate schedule doesn't cover the full payoff horizon (results conditional)
- Verification against statement fails (check your configuration)

## Currency

All amounts are in **ZAR (South African Rand)** with en-ZA locale formatting.

## Limitations / Out of Scope

- No fees (monthly service fees, transaction fees, etc.)
- No fee interest or fee waterfall
- No automatic rate forecasting
- No bank integration or statement import
- No file exports (in-app visualization only)
- Single-user only (no sharing/collaboration)

## Development

### Project Structure

```
src/
├── types/          # TypeScript type definitions
├── engine/         # Core calculation engine
│   ├── simulator.ts
│   ├── comparison.ts
│   ├── utils.ts
│   └── __tests__/
├── context/        # React Context + Reducer
│   ├── AppContext.tsx
│   ├── reducer.ts
│   └── defaults.ts
├── components/     # React components
│   ├── InputPanel.tsx
│   ├── ControlStrip.tsx
│   ├── KPIRow.tsx
│   ├── BalanceChart.tsx
│   ├── InterestCostChart.tsx
│   ├── CumulativeInterestChart.tsx
│   ├── AmortisationTable.tsx
│   ├── AssumptionsPanel.tsx
│   ├── VerificationPanel.tsx
│   └── LumpSumModal.tsx
├── App.tsx
├── main.tsx
└── index.css
```

### Testing

Run tests with:
```bash
npm test
```

Tests cover:
- Day count functions
- Daily interest accrual
- Payment waterfall logic
- Lump sum handling
- Rate changes
- Posting rule variants
- Settlement rule variants

## License

MIT

## Disclaimer

This simulator is for **educational and planning purposes only**. While it uses precise mathematical calculations, always verify results with your lender. Actual loan outcomes may vary due to fees, timing differences, or lender-specific rules not captured in this model.
