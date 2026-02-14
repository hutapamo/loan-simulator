# Loan Payoff Interactive Simulator — plan.md

## IMPLEMENTATION NOTES (2026-02-10)

### Key Changes Made During Implementation:

1. **UI Layout Changed:**
   - LEFT panel (1/3 width): All inputs + controls (scrollable)
   - RIGHT panel (2/3 width): Results (KPIs, charts, table)
   - "Calculate 💰" button triggers computation (not real-time)
   - Reason: Performance - real-time was too slow

2. **Simplified Date Inputs:**
   - **REMOVED:** "As of Date" (backend uses current date automatically)
   - **REMOVED:** "Last Payment Date" 
   - **ADDED:** "Payment Day of Month" (1-31)
   - **Principal entered represents balance AFTER last payment was made**
   - System calculates last payment date based on payment day and today's date
   - **Last payment is NOT shown in simulation** (starting point, already processed)
   - **Handles months with different days dynamically:**
     - Payment day 31 → Jan 31, Feb 28/29 (last day), Mar 31, Apr 30 (last day), etc.
     - Payment day 15 → Always 15th (all months have ≥15 days)
   - **Example 1:** Payment day 1st, today Feb 10
     - Last payment: Feb 1 (this month, already happened)
     - Feb row: Interest accrues Feb 1-28, NO payment shown
     - Mar row: Interest paid = all of Feb, payment shown
   - **Example 2:** Payment day 25th, today Feb 10
     - Last payment: Jan 25 (previous month)
     - Jan row: Interest accrues Jan 25-31 (partial), NO payment shown
     - Feb row: Interest paid = Jan 25-31 + Feb 1-24, payment shown on Feb 25

3. **Amortisation Table Redesign:**
   - **Table starts from last payment date (post-payment state)**
   - First month shows interest accrual from last payment date, NO payment
   - Subsequent months show full cycle: interest accrual + payment
   - **NEW COLUMNS:** "Interest Accrued" and "Interest Paid"
     - **Interest Accrued** = all interest that accrued during that calendar month
     - **Interest Paid** = interest settled by payment in that month (from last payment date up to but not including current payment date)
   - Payment processes BEFORE daily interest accrual, so balance changes immediately
   - Total Paid = regular payment + any lump sums in that month (merged)
   - **Lump sums processed on exact date** (not payment date) but displayed merged in monthly totals
   - **Interest Posting Rule determines if unpaid interest compounds:**
     - "Post to Interest Due" (default): Interest stays separate, paid monthly (no compounding)
     - "Capitalise Monthly": Unpaid interest added to principal (compounds)
   - **Principal entered is "as of last payment" - the starting clean balance**

4. **"Match My Statement" Verification Panel REMOVED:**
   - Deemed unnecessary by user
   - Removed from scope

5. **Daily Loop Order Fixed:**
   - Payment now processes BEFORE daily interest accrual
   - Critical fix: Payment pays interest up to (not including) payment day
   - Each payment (regular or lump sum) processes on its EXACT date
   - Interest calculation strictly date-based (no assumptions)

6. **Charts Enhanced:**
   - X-axis shows years (1yr, 2yr) at 12-month intervals
   - Y-axis labels repositioned (left, not insideLeft) with margins
   - Tooltips show "X years Y months"

7. **KPI Row Enhanced:**
   - Added "Interest Savings %" metric
   - Shows percentage saved vs baseline

8. **Scenario Summary Panel (formerly "Active Configuration"):**
   - Moved to sticky horizontal strip below header (always visible when scrolling)
   - Shows at-a-glance: Monthly Payment, Extra Monthly, Total Lump Sum, Rate, Convention
   - Expands to 3-column detailed view on click
   - Renamed from "Active Configuration" to "Scenario Summary"
   - Removed confusing lump sum count display (just shows total amount)

9. **Info Tooltips Added:**
   - Every input field has hover "i" icon
   - Plain English explanations of technical terms

---

## 1) Objective
Build an interactive visual web app that models a home loan using **daily interest accrual** and configurable bank-style rules.

User can:
- Adjust an **extra monthly payment** slider (recurring overpayment)
- Add one or more **lump-sum injections** to principal (dated one-off events)

App recalculates instantly and compares against a baseline **"do nothing from today forward"** scenario:
- Payoff date, remaining term, time saved
- Total interest remaining and interest saved
- Total paid (instalments + extras)
- Visual comparisons and charts **in-app only** (no downloads/exports)

Results must be deterministic and non-estimate **given complete inputs**.

---

## 2) Scope

### In-scope
- Daily-accurate interest engine (bank-rules configurable)
- Baseline scenario caching (do-nothing)
- Interactive controls (slider + lump sums)
- **Button-triggered calculation** (not real-time for performance)
- KPI outputs + in-app charts + in-app amortisation visualisation
- In-app assumptions/config panel
- Multiple named scenario persistence (localStorage)
- **Info tooltips on all inputs** for user-friendliness

### Out of scope
- **All fees** (no monthly service fees, no fee interest, no fee waterfall)
- Chart D (Payment Breakdown stacked bars) — deferred
- `REDUCE_INSTALMENT_KEEP_TERM` bank mode — deferred
- **Statement verification** — removed per user request
- Any bank/app integration, importing statements automatically, open banking
- Multi-user authentication/sharing
- Forecasting future rate paths automatically (user must input rates)
- File export / download of any kind

---

## 3) Inputs Required for "Actual" (Not Estimates)

### 3.1 Loan State (starting point)
Required:
- `principal_outstanding` (current principal balance)
- `regular_instalment_amount` (contractual required instalment)
- `payment_day_of_month` (recurring payment day: 1-31)
  - System automatically calculates last payment date based on today's date
  - Example: payment_day=20, today=Feb 10 → last payment was Jan 20
  - Example: payment_day=1, today=Feb 10 → last payment was Feb 1
- `payment_frequency` = monthly

Display-only (optional):
- `months_remaining` OR `loan_maturity_date`

### 3.2 Interest Rules
- `annual_interest_rate_schedule`:
  - Array of `{ start_date, annual_rate_percent }`
  - Must cover the horizon until payoff OR app must warn: "results conditional after last provided rate"
- `day_count_convention`:
  - Enum: `ACT_365`, `ACT_366`, `ACT_ACT`, `30_360_ISDA`
  - `30_360_ISDA` = 30/360 ISDA (US) variant
- `interest_posting_rule`:
  - `POST_MONTHLY_TO_INTEREST_DUE` (accrue daily, post monthly to an interest-due bucket)
  - `CAPITALISE_MONTHLY` (interest added to principal on posting day; lender-specific)
- `interest_posting_day`:
  - Fixed day-of-month (1–31)
  - **Overflow rule**: if day > days in month, roll to the **1st of the next month**

### 3.3 Payment Application Rules
- `payment_waterfall_order`:
  - Fixed: `INTEREST_DUE -> PRINCIPAL` (fees removed from scope)
- `interest_settlement_on_payment_day`:
  - `SETTLE_POSTED_ONLY`
  - `SETTLE_POSTED_PLUS_ACCRUED`
- `payment_date_shift_rule`:
  - `NONE`, `NEXT_BUSINESS_DAY`, `PREV_BUSINESS_DAY`
  - Weekends only (no holiday calendar)

### 3.4 Verification Inputs (Strongly recommended; manual entry)
A panel called "Match My Statement" that the user can fill in to validate configuration:
- Opening principal on last statement
- Interest charged on statement
- Payment amount and date(s)
- Closing principal on statement

Engine must confirm it reproduces closing balance within **R0.01**.
If it fails, app highlights which rule(s) likely mismatch (posting rule, day count, settlement rule).

---

## 4) User Controls (Interactive)

### 4.1 Extra Monthly Payment Slider
- `extra_monthly_amount`: slider, R0 to **4× regular instalment** (with numeric readout)
- `extra_monthly_start_date`:
  - `NEXT_PAYMENT_DATE` (default), `AS_OF_DATE`, or custom date
- `extra_monthly_end_date`:
  - `UNTIL_PAYOFF` (default) or custom end date
- `extra_payment_day`:
  - Default: same day as regular instalment debit (configurable)

### 4.2 Lump Sum Injection(s)
Support 1..N lump sums:
- `{ date, amount, label }`
UI:
- "Add Lump Sum" modal (date picker, amount, optional label)
- List with edit/delete

Application:
- By default, lump sums follow the same waterfall: `INTEREST_DUE -> PRINCIPAL`
- Toggle: `treat_lump_sum_as_principal_only` (default OFF)
  - When ON, lump sum bypasses interest and reduces principal directly
  - Only enable if user confirms lender permits principal-only allocation

### 4.3 Same-Day Event Handling
When multiple payment events fall on the same day (regular + extra + lump sum):
- **All payment amounts are combined** into a single payment event
- Single waterfall application on the combined total
- Exception: if `treat_lump_sum_as_principal_only` is ON, lump sum portion is separated and applied directly to principal; remaining payments go through waterfall

### 4.4 Bank Behaviour Mode
- `KEEP_INSTALMENT_SHORTEN_TERM` (only mode built now)
- `REDUCE_INSTALMENT_KEEP_TERM` — deferred to future scope

---

## 5) Outputs (In-App Only; Always show Baseline vs Scenario)

### 5.1 KPI Panel (Live)
Three columns: **Baseline** | **With Extras** | **Difference**
- Payoff date
- Months to payoff (years/months formatting)
- Time saved (months/years)
- Total interest from `as_of_date` to payoff
- Interest saved (R)
- **Interest savings (%)** - percentage saved vs baseline
- Total paid (instalments + extras)

### 5.2 Charts (Live)
All charts show two series: **Baseline (do nothing)** vs **Scenario (extras + lump sums)**.

#### Chart A: Remaining Balance Over Time
- X axis: calendar months from `as_of_date` to payoff horizon
- Y axis: principal balance

#### Chart B: Monthly Interest Cost Over Time (Horizon Chart)
- X axis: months from `as_of_date` until payoff (full horizon)
- Y axis: **interest charged per month** (sum of daily accrual for that month)
- Baseline curve + Scenario curve
- Interest cost declines as principal declines; scenario curve drops faster and ends earlier

#### Chart C: Cumulative Interest Paid Over Time
- X axis: months
- Y axis: cumulative interest paid
- Makes "interest saved" visually obvious

### 5.3 In-App Amortisation Viewer
On-screen drill-down (no export):
- Paginated table or timeline view
- Filters:
  - Year selector
  - "Show payment months only"
- For selected year show summary:
  - Interest paid, principal repaid, total paid

---

## 6) Calculation Engine (Daily Accurate)

### 6.1 Data Structures
- `Event`:
  - `date`
  - `type`: `REGULAR_PAYMENT | EXTRA_MONTHLY | LUMP_SUM | RATE_CHANGE | INTEREST_POST`
  - `amount` (if applicable)
- `DayState`:
  - `date`
  - `principal`
  - `interest_accrued_unposted`
  - `interest_due_posted`
  - `cumulative_interest_paid`
  - `cumulative_paid_total`
- `MonthSummary`:
  - `year`, `month`
  - `monthly_interest_cost`
  - `monthly_principal_reduction`
  - `monthly_total_paid`
  - `month_end_principal`
  - `cumulative_interest_paid`

### 6.2 Daily Loop (Deterministic)
For each day from `as_of_date` until payoff:

1. **Rate change**: apply if scheduled today
2. **Payment event(s)** (if any today): **PROCESS PAYMENT FIRST**
   - Combine all payment amounts for the day (regular + extra + lump sums)
   - Apply waterfall:
     - If `SETTLE_POSTED_PLUS_ACCRUED`: interest due = posted + accrued unposted (reset accrued)
     - If `SETTLE_POSTED_ONLY`: interest due = posted only
     - Pay interest due first
     - Remainder reduces principal
   - Exception: if `treat_lump_sum_as_principal_only` is ON, separate lump sum amount and apply directly to principal
3. **Accrue daily interest** (AFTER payment):
   - `daily_rate = annual_rate / day_count_basis` (per convention)
   - `interest_accrued_unposted += principal * daily_rate`
4. **Interest posting** (if posting day):
   - If `POST_MONTHLY_TO_INTEREST_DUE`:
     - `interest_due_posted += interest_accrued_unposted`
   - If `CAPITALISE_MONTHLY`:
     - `principal += interest_accrued_unposted`
   - Reset `interest_accrued_unposted = 0`
5. **Terminate** when:
   - `principal <= 0 AND interest_due_posted <= 0 AND interest_accrued_unposted <= 0`

**CRITICAL FIX:** Payment must process BEFORE daily interest accrual so that payment on day N pays interest accrued up to (not including) day N.

### 6.3 Starting Point Logic
- **Principal entered represents balance AFTER last payment** (clean starting balance)
- System calculates last payment date: if `todayDay >= paymentDay` → this month, else previous month
- **Simulation starts from last payment date** (post-payment state)
- **Last payment is NOT included in simulation** - it's the starting reference point
- First month in table shows interest accrual only, no payment
- Example: payment_day=1, today=Feb 10 → simulation starts Feb 1, first row shows Feb with no payment

### 6.4 Monthly Aggregation (for amortisation table)
For each calendar month, compute:
- **Interest Accrued** = sum of daily interest accrual during that calendar month (all days)
- **Interest Paid** = interest settled by payment in that month (from last payment up to but not including current payment)
- **Total Paid** = sum of all payments (regular + lump sums) in that month
- **Principal Reduction** = actual principal reduced by payments
- **Balance** = month-end principal
- **Note:** Payment processes BEFORE daily interest, so balance changes immediately
- **Note:** Interest Accrued includes day after payment (on reduced balance)

### 6.5 Baseline vs Scenario
- **Baseline**: regular payments + rate schedule only
- **Scenario**: baseline + extra monthly + lump sums
- Cache baseline result; recompute scenario on slider/lump-sum changes

### 6.6 Precision
- All arithmetic via **Decimal.js**
- Keep high precision internally
- Round displayed amounts to **2 decimal places** (cents)

---

## 7) Technical Implementation Details

### 7.1 Interest Posting Day
- **For most loans:** Posting day doesn't practically matter when Settlement Rule = "Posted + Accrued"
- Payment settles both posted and accrued buckets regardless of posting timing
- **Matters only when:** Settlement Rule = "Posted Only" or Posting Rule = "Capitalise Monthly"
- Default: 1st of month (internal bank accounting)

### 7.2 Date Handling
- All date calculations use JavaScript Date constructor with year/month/day
- Months with fewer days handled dynamically: payment day 31 → last day of each month
- No hardcoded month lengths or leap year logic - all calculated
- Function `getDaysInMonth(year, month)` returns actual days for any month

---

## 8) Verification Engine (REMOVED FROM SCOPE)
- Originally planned "Match My Statement" feature
- Removed per user request during implementation
- Function stubs remain for type compatibility

---

## 9) UI/UX Requirements

### Layout (AS IMPLEMENTED)
- **LEFT panel (1/3)**: All inputs + controls (scrollable)
- **RIGHT panel (2/3)**: Results (KPIs, charts, table)
- **Sticky Scenario Summary strip** below header (always visible)
- **Calculate button** triggers computation (not real-time)
- **Comparison panel** with gradient background to stand out
- Desktop-optimized, clean and professional

### Interactivity (AS IMPLEMENTED)
- Button-triggered calculation for performance
- Info tooltips on all inputs
- Collapsible sections for cleaner UI

### Warnings (AS NEEDED)
- Rate schedule ends before computed payoff: warn "results conditional after [last rate end date]"
- Inline validation for invalid inputs (negative amounts, bad dates, etc.)

### Assumptions Panel
Always accessible (one click):
- Day count convention
- Posting rule
- Waterfall order
- Settlement rule
- Date-shift rule
- Rate schedule coverage

---

## 10) Persistence (localStorage)

- **Multiple named scenarios**: save/load/delete
- Each scenario stores: all input fields + scenario controls (slider value, lump sums)
- **Auto-save** "last session" on page unload
- On load: restore "last session" or let user pick from saved list
- Schema versioning for forward compatibility

---

## 11) Components (`src/components/`) - AS IMPLEMENTED

| Component | Purpose | Status |
|---|---|---|
| `InputPanel` | Loan state fields + interest rules + payment rules | ✅ Implemented |
| `ControlStrip` | Extra monthly slider + lump sum list | ✅ Implemented |
| `LumpSumModal` | Date picker, amount, optional label | ✅ Implemented |
| `KPIRow` | 3-column Baseline / Scenario / Difference with gradient background | ✅ Implemented |
| `BalanceChart` | Remaining balance over time (two series) | ✅ Implemented |
| `InterestCostChart` | Monthly interest cost over time (two series) | ✅ Implemented |
| `CumulativeInterestChart` | Cumulative interest paid (two series) | ✅ Implemented |
| `AmortisationTable` | Table with Interest Accrued/Paid columns, year filter | ✅ Implemented |
| `AssumptionsPanel` | Sticky "Scenario Summary" strip with expand | ✅ Implemented |
| `VerificationPanel` | ~~"Match My Statement"~~ | ❌ Removed |
| `ScenarioManager` | Save/load/delete named scenarios | ⏸️ Deferred |
| `InfoTooltip` | Hover tooltips for all inputs | ✅ Implemented |

---

## 12) State Management

- React Context + `useReducer` for global app state
- Baseline computed via `useMemo`, keyed on loan state + interest rules + payment rules
- Scenario recomputed on slider/lump-sum changes with debounce
- Computation is synchronous (engine is fast enough for typical 30-year loans)

---

## 13) Validation & Testing

### Unit tests (Vitest) — `src/engine/__tests__/`
- Day count functions: known values for each convention (`ACT_365`, `ACT_366`, `ACT_ACT`, `30_360_ISDA`)
- Daily loop: simple 12-month loan with known amortisation — verify final balance, total interest
- Lump sum: inject R50,000 at month 6 — verify payoff date moves earlier, total interest drops
- Rate change mid-cycle: verify interest accrual changes correctly
- Posting rule variants: `POST_MONTHLY_TO_INTEREST_DUE` vs `CAPITALISE_MONTHLY` — different outcomes
- Settlement rule variants: `SETTLE_POSTED_ONLY` vs `SETTLE_POSTED_PLUS_ACCRUED` — payment allocation differs
- Combined same-day events: regular + lump sum on same day — verify combined waterfall
- `treat_lump_sum_as_principal_only` toggle: verify lump sum bypasses interest
- Interest posting day overflow: posting day 31 in February → rolls to March 1
- Payment date shift: payment on Saturday → Monday (`NEXT_BUSINESS_DAY`)
- Mid-cycle bootstrap: verify derived accrued interest matches expected
- Verification engine: known statement → PASS; altered rule → FAIL with diagnostic

### Regression/snapshot tests
- Fixed input payloads → snapshot KPI values for baseline and scenario

---

## 14) Tech Stack

| Layer | Choice |
|---|---|
| Framework | React + TypeScript |
| Build tool | Vite |
| Styling | Tailwind CSS |
| Charts | Recharts |
| Arithmetic | Decimal.js |
| Testing | Vitest + @testing-library/react |
| Persistence | localStorage |
| Currency | ZAR (South African Rand), en-ZA locale formatting |

---

## 15) Deliverables (COMPLETED)

1. ✅ Working single-page app with:
   - ✅ Inputs form (loan state + interest rules + payment rules)
   - ✅ Extra monthly slider
   - ✅ Lump sum editor
   - ✅ Baseline vs scenario KPI comparison (with gradient styling)
   - ✅ Charts: Balance, Monthly Interest Cost, Cumulative Interest
   - ✅ Amortisation table with Interest Accrued/Paid columns
   - ✅ Sticky Scenario Summary panel
   - ❌ ~~Statement verification~~ (removed)
   - ⏸️ Named scenario save/load (deferred)
2. ✅ Engine module with daily-accurate calculation
3. ✅ TypeScript type system (28 interfaces)
4. ⚠️ Tests: Basic unit tests (comprehensive suite deferred)

---

## 16) Key Decisions Log

| Decision | Choice | Rationale |
|---|---|---|
| Currency & locale | ZAR, en-ZA | User confirmed |
| Fees | Removed entirely | User request — only principal + interest |
| UI styling | Tailwind CSS | Fast, utility-first, clean |
| Chart D (payment breakdown) | Deferred | Keep scope tight |
| Instalment reduction mode | Deferred | Keep scope tight |
| Same-day payment events | Combined into one waterfall | User confirmed |
| Slider upper bound | 4× regular instalment | User specified |
| 30/360 variant | ISDA (US) only | User confirmed |
| Posting day overflow | Roll to 1st of next month | User confirmed |
| Persistence | localStorage (named scenarios deferred) | Implemented basic persistence |
| Verification tolerance | ~~R0.01~~ | Feature removed |
| Responsiveness | Desktop-first | User confirmed |
| Date inputs | Payment day of month only | Simplified from as_of_date + last_payment_date |
| Principal meaning | Balance AFTER last payment | Clean starting point, no recursion |
| Table starting point | From last payment date | Shows all activity from last payment forward |
| Calculation trigger | Button (not real-time) | Performance optimization |
| Comparison panel | Gradient styling | Visual emphasis without being garish |

---

## 17) Known Limitations & Future Enhancements

### Current Limitations:
- No scenario save/load/manage (deferred)
- No statement verification (removed from scope)
- No REDUCE_INSTALMENT_KEEP_TERM mode
- Desktop-only (minimal mobile support)
- No export/download functionality

### Future Enhancements:
- Multiple named scenarios with localStorage persistence
- More comprehensive test suite
- Payment breakdown stacked bar chart
- Mobile-responsive layout
- Rate forecasting suggestions