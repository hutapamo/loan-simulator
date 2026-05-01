# Loan Payoff Simulator — Design Specification

This document defines every screen, input field, output, and interactive element of the app.
Use it as the single source of truth for UI and theme work.

---

## 1. Page Layout

The app is a **single-page layout** split into three vertical zones:

```
┌──────────────────────────────────────────────────────┐
│  HEADER (sticky, full width)                         │
├──────────────────────────────────────────────────────┤
│  SCENARIO SUMMARY BAR (sticky, full width)           │
├─────────────────────────┬────────────────────────────┤
│                         │                            │
│   LEFT PANEL (1/3)      │   RIGHT PANEL (2/3)        │
│   Scrollable            │   Scrollable               │
│   - Loan Configuration  │   - KPI Row                │
│   - Extra Payments      │   - 3 Charts               │
│   - Calculate Button    │   - Amortisation Table     │
│                         │                            │
└─────────────────────────┴────────────────────────────┘
```

- Header and Scenario Summary Bar stay fixed as the user scrolls.
- Left and Right panels each scroll independently.
- All currency is ZAR (R), formatted as `R 1 234 567.89` (en-ZA locale).

---

## 2. Header

**Always visible. Sticky at top.**

| Element | Content |
|---|---|
| Title | "Loan Payoff Simulator" |
| Subtitle | "Configure your loan, adjust extra payments, then click Calculate" |
| Background | Blue (`#2563EB`) |
| Text | White |

---

## 3. Scenario Summary Bar

**Always visible. Sticky below the header.**

A compact bar that echoes the current configuration at a glance.

### Always-visible summary chips (one line, small text):

| Label | Value shown |
|---|---|
| Monthly Payment | R value from Loan Configuration |
| Extra Monthly | R value from Extra Payments slider |
| Total Lump Sum | Sum of all lump sum amounts, or "None" |
| Rate | e.g. `11.5% p.a.` |
| Convention | e.g. `ACT/365` |

### Expand/Collapse toggle:
A small button (▼ Expand Details / ▲ Collapse) reveals a 3-column detail grid:

**Column 1 — Payment Details:**
- Monthly Payment (R)
- Extra Monthly Payment (R)
- Number of Lump Sums (count)
- Total Lump Sum Payments (R)

**Column 2 — Interest & Settlement Rules:**
- Day Count Convention
- Interest Posting Rule
- Interest Posting Day (e.g. "Day 1")
- Settlement Rule

**Column 3 — Rate Schedule:**
- One row per rate entry: `DD/MM/YYYY: X% p.a.`
- Multiple entries if the user has added rate changes

---

## 4. Left Panel — Inputs

### 4.1 Loan Configuration Section

**Section title:** "Loan Configuration"
**Collapsible:** Yes — "− Collapse" / "+ Expand" button top-right

#### Fields:

---

**Group: Loan Details**

| Field | Label | Type | Default | Constraints | Unit | Tooltip |
|---|---|---|---|---|---|---|
| Principal Outstanding | "Principal Outstanding (R)" | Number input | 1,000,000 | > 0 | ZAR | "Your loan balance as of the last payment date (after payment was made)." |
| Regular Monthly Payment | "Regular Monthly Payment (R)" | Number input | 10,000 | > 0 | ZAR | "Your normal monthly instalment — the amount debited from your account each month." |
| Payment Day of Month | "Payment Day of Month" | Number input | 1 | 1–31 (integer) | Day number | "Which day of the month does your payment come off? e.g. enter 20 if paid on the 20th." |

---

**Group: Interest Rules**

| Field | Label | Type | Default | Options / Constraints | Tooltip |
|---|---|---|---|---|---|
| Annual Interest Rate | "Annual Interest Rate (%)" | Number input (step 0.01) | 11.5 | > 0, e.g. 11.5 for 11.5% | "Your loan's interest rate per year. Find this on your loan agreement." |
| Day Count Convention | "Day Count Convention" | Dropdown | ACT/365 | See options below | "How your bank counts days for daily interest. Most SA banks use ACT/365." |
| Interest Posting Rule | "Interest Posting Rule" | Dropdown | Post to Interest Due | See options below | "How interest gets added to your loan each month." |
| Interest Posting Day | "Interest Posting Day (1-31)" | Number input | 1 | 1–31 (integer) | "Day of each month when interest is officially added to your account." |

**Day Count Convention options:**
- `ACT/365` — "ACT/365 (Most common in SA)" ← default
- `ACT/366` — "ACT/366"
- `ACT/ACT` — "ACT/ACT"
- `30/360 ISDA` — "30/360 ISDA (US banks)"

**Interest Posting Rule options:**
- `POST_MONTHLY_TO_INTEREST_DUE` — "Post to Interest Due (Most common)" ← default
- `CAPITALISE_MONTHLY` — "Capitalise Monthly (Rare)"

---

**Group: Payment Rules**

| Field | Label | Type | Default | Options | Tooltip |
|---|---|---|---|---|---|
| Interest Settlement Rule | "Interest Settlement Rule" | Dropdown | Posted + Accrued | See options below | "When you pay, what interest gets deducted?" |
| Weekend Payment Handling | "Weekend Payment Handling" | Dropdown | Next Business Day | See options below | "If payment date falls on a weekend, when does it process?" |

**Interest Settlement Rule options:**
- `SETTLE_POSTED_PLUS_ACCRUED` — "Posted + Accrued (Recommended)" ← default
- `SETTLE_POSTED_ONLY` — "Posted Only"

**Weekend Payment Handling options:**
- `NEXT_BUSINESS_DAY` — "Next Business Day (Most common)" ← default
- `PREV_BUSINESS_DAY` — "Previous Business Day"
- `NONE` — "No Adjustment"

**Static info box** (always shown, not editable):
> **Payment Order:** Interest Due → Principal
> *(Your payment covers interest first, then reduces the loan balance)*

---

### 4.2 Extra Payments Section

**Section title:** "Extra Payments"
**Not collapsible**

#### Extra Monthly Amount Slider

| Property | Value |
|---|---|
| Label | "Extra Monthly Amount" |
| Type | Range slider |
| Min | R 0 |
| Max | 4× the Regular Monthly Payment (dynamic) |
| Step | R 100 |
| Default | R 0 |
| Live value display | Shows current R value to the right of the label (blue, bold) |
| Range labels | "R0" on left, max value on right (small grey text) |
| Tooltip | "Additional amount to pay every month on top of your regular payment." |

#### Apply lump sums directly to principal (checkbox)

| Property | Value |
|---|---|
| Label | "Apply lump sums directly to principal" |
| Type | Checkbox |
| Default | Unchecked (off) |
| Tooltip | "When ON: lump sums skip interest and reduce loan balance directly. Only enable if your bank allows principal-only payments." |

#### Lump Sum Payments List

**Sub-title:** "One-Time Lump Sum Payments"
**Tooltip:** "Add big one-off payments like bonuses, tax refunds, or inheritance."

- **Add button:** "+ Add" — opens the Lump Sum Modal
- **Empty state:** Grey italic text: "No lump sum payments added yet"
- **Each lump sum entry shows:**
  - Amount (R, bold)
  - Date (DD/MM/YYYY format) and optional label (e.g. "• Bonus")
  - **Edit** button (blue text link) — reopens modal pre-filled
  - **Delete** button (red text link) — confirms with browser dialog before deleting

---

### 4.3 Calculate Button

| Property | Value |
|---|---|
| Label | "Calculate Scenarios 💰" |
| State: idle | Green background, white text, full width |
| State: calculating | Grey background, disabled, label "Calculating..." |
| Position | Bottom of left panel, below all inputs |

---

## 5. Lump Sum Modal

An **overlay modal** (centred, full-screen backdrop) opened by "Add" or "Edit" on a lump sum.

**Title:** "Add Lump Sum Payment" or "Edit Lump Sum Payment"

### Fields:

| Field | Label | Type | Default | Constraints |
|---|---|---|---|---|
| Date | "Date" | Date picker (HTML date input) | Today's date | Any future or past date |
| Amount | "Amount (R)" | Number input (step 100, min 0) | Empty | Must be > 0 to save |
| Label | "Label (optional)" | Text input | Empty | Optional, e.g. "Bonus", "Tax refund" |

### Buttons:
- **Cancel** — closes modal, discards changes
- **Add** / **Update** — validates (date + amount required, amount > 0), saves and closes

### Validation:
If date or amount is missing or amount ≤ 0, shows browser alert: "Please enter a valid date and amount"

---

## 6. Right Panel — Results

The right panel has **four display states**:

### State 1: Empty (before first calculation)
- Centred placeholder: large 📊 icon, "Ready to calculate", "Configure your loan on the left and click Calculate"

### State 2: Calculating
- Calculate button shows "Calculating..." and is disabled
- Right panel clears previous results (shows empty state)

### State 3: Error
- Red error card, centred in the panel
- ⚠️ icon, bold title "Calculation Error", error message text, "Please adjust your parameters and try again."

### State 4: Results (all of the below rendered top-to-bottom)

---

## 7. KPI Row (Results)

**Title:** "Scenario Comparison"
**Layout:** 3 equal columns

### Column 1 — Baseline (No Extras)

| KPI | Description | Format |
|---|---|---|
| Payoff Date | Date the loan is fully paid off with no extra payments | DD/MM/YYYY |
| Months to Payoff | Total months to pay off the loan | e.g. "20 years 3 months" |
| Total Interest | Total interest paid over the full loan term | R value |
| Total Paid | Total amount paid (principal + interest) | R value |

### Column 2 — With Extras (Scenario)

Same four KPIs as Baseline, but calculated with extra monthly payments and lump sums applied.

| KPI | Description | Format |
|---|---|---|
| Payoff Date | Earlier payoff date with extras | DD/MM/YYYY |
| Months to Payoff | Reduced months with extras | e.g. "17 years 1 month" |
| Total Interest | Lower total interest with extras | R value |
| Total Paid | Lower total paid with extras | R value |

### Column 3 — Savings

| KPI | Description | Colour | Format |
|---|---|---|---|
| Time Saved | Months saved vs baseline | Green | e.g. "2 years 2 months" |
| Interest Saved | Rand amount of interest saved | Green | R value |
| Interest Savings | Percentage of interest saved | Green | e.g. "18.4%" |
| Extra Payments | Total extra payments made (difference in total paid) | Blue | R value |

---

## 8. Charts

All three charts share these common properties:
- **X-axis label:** "Time"
- **X-axis ticks:** `0`, `1yr`, `2yr`, ... with `Xy Zm` labels at 6-month intervals
- **X-axis tooltip:** "X years Y months"
- **Legend:** Positioned below chart
- **Two lines per chart:** "Baseline" (grey `#9CA3AF`) and "With Extras" (coloured)
- **No dots on lines** (smooth lines only)
- **Responsive width**

---

### Chart 1 — Remaining Balance Over Time

| Property | Value |
|---|---|
| Title | "Remaining Balance Over Time" |
| Y-axis label | "Principal (R)" |
| Y-axis ticks | e.g. `R0k`, `R200k`, `R400k`, `R600k`, `R800k`, `R1000k` |
| "With Extras" line colour | Blue `#3B82F6` |
| Tooltip value | R amount (formatted) |
| What it shows | Loan balance decreasing month by month. Baseline reaches R0 later than the "With Extras" line. |

---

### Chart 2 — Monthly Interest Cost Over Time

| Property | Value |
|---|---|
| Title | "Monthly Interest Cost Over Time" |
| Y-axis label | "Interest (R)" |
| Y-axis ticks | e.g. `R0.0k`, `R2.5k`, `R5.0k`, `R7.5k`, `R10.0k` |
| "With Extras" line colour | Green `#10B981` |
| Tooltip value | R amount (formatted) |
| What it shows | How much interest accrues each month. "With Extras" line drops faster as the principal shrinks quicker. |

---

### Chart 3 — Cumulative Interest Paid Over Time

| Property | Value |
|---|---|
| Title | "Cumulative Interest Paid Over Time" |
| Y-axis label | "Cumulative Interest (R)" |
| Y-axis ticks | e.g. `R0k`, `R200k`, `R400k`, `R600k` |
| "With Extras" line colour | Red `#EF4444` |
| Tooltip value | R amount (formatted) |
| What it shows | Running total of interest paid. "With Extras" line terminates earlier (loan paid off sooner) and at a lower final value. |

---

## 9. Amortisation Table

**Title:** "Amortisation Schedule"

### Table Controls:

| Control | Type | Default | Description |
|---|---|---|---|
| Select Year | Dropdown | "All Years" | Filter rows to a single calendar year |
| Show payment months only | Checkbox | Unchecked | When checked, hides months with zero payments |

### Year Summary Bar (only visible when a year is selected):

A highlighted info box showing 4 totals for the selected year:

| Metric | Description |
|---|---|
| Interest Accrued | Total interest that accrued in this calendar year |
| Interest Paid | Total interest paid in this calendar year |
| Principal Repaid | Total principal reduction in this calendar year |
| Total Paid | All payments made in this calendar year |

### Table Columns (one row per month):

| Column | Description | Format | Alignment |
|---|---|---|---|
| Month | Calendar month | `YYYY/MM` (e.g. `2026/04`) | Left |
| Interest Accrued | Interest that accrued during this month | R value | Right |
| Interest Paid | Interest settled by payments in this month | R value | Right |
| Total Paid | All payments in this month (regular + lump sums) | R value | Right |
| Principal Reduction | How much the principal balance fell this month | R value | Right |
| Balance | Remaining principal at end of month | R value, **bold** | Right |

### Row highlighting:
- Months that contain a lump sum payment are highlighted with a **blue background** (`bg-blue-100`, text `text-blue-900`).
- A legend is shown: blue square + "Lump Sum Payment Months"

---

## 10. Warnings (Inline)

These warnings are produced by the calculation engine and displayed before or within results:

| Trigger | Message |
|---|---|
| Rate schedule ends before loan payoff | "Rate schedule doesn't cover the full payoff horizon — results are conditional on the last known rate continuing." |
| Calculation error | Red error card in the right panel with the specific error message. |

---

## 11. Scenario Persistence (localStorage)

All state is auto-saved to the browser's `localStorage` key `loan-simulator-state` on every change.
There is no explicit Save/Load UI currently — state restores automatically on page reload.

> **Note to designer:** The data model supports named saved scenarios (save/load/delete by name), but there is no UI for this feature yet. Do not design for it unless requested.

---

## 12. Colour Reference (Current Implementation)

| Element | Colour |
|---|---|
| Header background | `#2563EB` (blue-600) |
| Scenario bar background | blue-50 to indigo-50 gradient |
| Primary button (Calculate) | `#16A34A` (green-600) |
| Extra monthly slider accent | `#2563EB` (blue-600) |
| Add lump sum button | `#2563EB` (blue-600) |
| KPI savings values | `#16A34A` (green-600) |
| KPI extra payments value | `#2563EB` (blue-600) |
| Balance chart line (extras) | `#3B82F6` (blue-500) |
| Interest cost chart line (extras) | `#10B981` (emerald-500) |
| Cumulative interest chart line (extras) | `#EF4444` (red-500) |
| Baseline lines (all charts) | `#9CA3AF` (grey-400) |
| Lump sum table row highlight | `#DBEAFE` bg / `#1E3A8A` text (blue-100/blue-900) |
| Error card | red-50 bg, red-300 border |
| Page background | `#F3F4F6` (grey-100) |
| Panel background | white |

---

## 13. Currency & Locale

- Currency: **ZAR (South African Rand)**
- Symbol: **R** (prefix, e.g. `R 10 000.00`)
- Locale: **en-ZA**
- Decimal separator: `.` (period)
- Thousands separator: ` ` (space)
- Date format: **DD/MM/YYYY** (en-ZA)

---

## 14. What Is NOT in Scope

The following do not exist in the app and should not appear in the design:

- Monthly service fees or transaction fees
- Automatic interest rate forecasting
- Bank integration or statement import
- File export (PDF, CSV, etc.)
- Multi-user / sharing / collaboration
- Mobile-specific layout (app is desktop-first)
- Statement verification panel (removed from scope)
