import { useState, useEffect, useRef } from 'react';
import { compareScenarios } from './engine/comparison';
import type {
  LoanState, InterestRules, PaymentRules, ScenarioControls,
  DayCountConvention, InterestSettlementRule, PaymentDateShiftRule,
  SimulationResult,
} from './types/index';

// ─── Flat loan state ───────────────────────────────────────────────────────
interface LoanFlat {
  principal: number;
  instalment: number;
  payDay: number;
  annualRate: number;
  convention: string;
  postingRule: string;
  postingDay: number;
  settlementRule: string;
  weekendRule: string;
  extraMonthly: number;
  lumpSums: { date: string; amount: number; label: string }[];
  lumpDirectToPrincipal: boolean;
}

const LS_KEY = 'loan-sim-v3';
const DEFAULTS: LoanFlat = {
  principal: 1000000, instalment: 10000, payDay: 1,
  annualRate: 11.5, convention: 'ACT/365',
  postingRule: 'POST_MONTHLY_TO_INTEREST_DUE', postingDay: 1,
  settlementRule: 'SETTLE_POSTED_PLUS_ACCRUED', weekendRule: 'NEXT_BUSINESS_DAY',
  extraMonthly: 0, lumpSums: [], lumpDirectToPrincipal: false,
};

function loadState(): LoanFlat {
  try {
    const s = localStorage.getItem(LS_KEY);
    return s ? { ...DEFAULTS, ...JSON.parse(s) } : { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
}

// ─── Formatters ───────────────────────────────────────────────────────────
function fmt(v: number): string {
  if (!isFinite(v)) return '—';
  return 'R ' + new Intl.NumberFormat('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.abs(v) < 0.005 ? 0 : v);
}
function fmtPct(v: number): string { return (v * 100).toFixed(1) + '%'; }
function fmtDate(d: Date, opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: 'numeric' }): string {
  return new Intl.DateTimeFormat('en-ZA', opts).format(d);
}
function fmtMonths(n: number): string {
  if (!n || n <= 0) return '—';
  const y = Math.floor(n / 12), m = n % 12;
  if (y === 0) return m + ' month' + (m !== 1 ? 's' : '');
  if (m === 0) return y + ' year' + (y !== 1 ? 's' : '');
  return y + ' year' + (y !== 1 ? 's' : '') + ' ' + m + ' month' + (m !== 1 ? 's' : '');
}

// ─── Engine bridge ────────────────────────────────────────────────────────
const DAY_COUNT_MAP: Record<string, DayCountConvention> = {
  'ACT/365': 'ACT_365', 'ACT/366': 'ACT_366',
  'ACT/ACT': 'ACT_ACT', '30/360 ISDA': '30_360_ISDA',
};

function loanToEngineInputs(loan: LoanFlat) {
  const today = new Date().toISOString().split('T')[0];
  const loanState: LoanState = {
    principal_outstanding: loan.principal,
    regular_instalment_amount: loan.instalment,
    payment_day_of_month: loan.payDay,
    payment_frequency: 'MONTHLY',
  };
  const interestRules: InterestRules = {
    annual_interest_rate_schedule: [{ start_date: today, annual_rate_percent: loan.annualRate }],
    day_count_convention: DAY_COUNT_MAP[loan.convention] ?? 'ACT_365',
    interest_posting_rule: loan.postingRule as 'POST_MONTHLY_TO_INTEREST_DUE' | 'CAPITALISE_MONTHLY',
    interest_posting_day: loan.postingDay,
  };
  const paymentRules: PaymentRules = {
    payment_waterfall_order: 'INTEREST_DUE -> PRINCIPAL',
    interest_settlement_on_payment_day: loan.settlementRule as InterestSettlementRule,
    payment_date_shift_rule: loan.weekendRule as PaymentDateShiftRule,
  };
  const scenarioControls: ScenarioControls = {
    extra_monthly: {
      extra_monthly_amount: loan.extraMonthly,
      extra_monthly_start_date: 'NEXT_PAYMENT_DATE',
      extra_monthly_end_date: 'UNTIL_PAYOFF',
      extra_payment_day_same_as_regular: true,
    },
    lump_sums: loan.lumpSums.map((ls, i) => ({
      id: `ls-${i}-${ls.date}`,
      date: ls.date,
      amount: ls.amount,
      label: ls.label || undefined,
    })),
    treat_lump_sum_as_principal_only: loan.lumpDirectToPrincipal,
    bank_behaviour_mode: 'KEEP_INSTALMENT_SHORTEN_TERM',
  };
  return { loanState, interestRules, paymentRules, scenarioControls };
}

interface AdaptedMonth {
  ym: string;
  interestAccrued: number;
  interestPaid: number;
  totalPaid: number;
  principalReduction: number;
  endBalance: number;
  cumInt: number;
  hasLumpSum: boolean;
}
interface AdaptedResult {
  payoffDate: Date;
  totalMonths: number;
  totalInterest: number;
  months: AdaptedMonth[];
}

function adaptResult(r: SimulationResult): AdaptedResult {
  return {
    payoffDate: new Date(r.payoff_date + 'T00:00:00'),
    totalMonths: r.months_to_payoff,
    totalInterest: r.total_interest.toNumber(),
    months: r.month_summaries.map(m => ({
      ym: `${m.year}/${String(m.month).padStart(2, '0')}`,
      interestAccrued: m.interest_accrued.toNumber(),
      interestPaid: m.interest_paid.toNumber(),
      totalPaid: m.monthly_total_paid.toNumber(),
      principalReduction: m.monthly_principal_reduction.toNumber(),
      endBalance: m.month_end_principal.toNumber(),
      cumInt: m.cumulative_interest_paid.toNumber(),
      hasLumpSum: m.has_lump_sum,
    })),
  };
}

interface ChartPoint {
  ym: string;
  baseBalance: number; scenBalance: number;
  baseMonthlyInt: number; scenMonthlyInt: number;
  baseCumInt: number; scenCumInt: number;
}

function buildChartData(base: AdaptedResult, scen: AdaptedResult): ChartPoint[] {
  const scenFinalCumInt = scen.months.length > 0 ? scen.months[scen.months.length - 1].cumInt : 0;
  return base.months.map((bm, i) => {
    const sm = i < scen.months.length ? scen.months[i] : null;
    return {
      ym: bm.ym,
      baseBalance: bm.endBalance,
      scenBalance: sm ? sm.endBalance : 0,
      baseMonthlyInt: bm.interestAccrued,
      scenMonthlyInt: sm ? sm.interestAccrued : 0,
      baseCumInt: bm.cumInt,
      scenCumInt: sm ? sm.cumInt : scenFinalCumInt,
    };
  });
}

// ─── Design tokens ────────────────────────────────────────────────────────
const SMUTED = '#7A7470';
const SINPUT = 'rgba(255,255,255,.7)';
const SBORDER = 'rgba(0,0,0,.08)';
const STEXT = '#1A1814';

// ─── Animated value ───────────────────────────────────────────────────────
function Val({ v }: { v: string }) {
  return <span key={v} style={{ display: 'inline-block', animation: 'fadeUp .22s ease' }}>{v}</span>;
}

// ─── Sidebar primitives ───────────────────────────────────────────────────
function SInput({ value, onChange, prefix, suffix, step, min, max }: {
  value: number; onChange: (v: number) => void;
  prefix?: string; suffix?: string; step?: number; min?: number; max?: number;
}) {
  const [foc, setFoc] = useState(false);
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      {prefix && <span style={{ position: 'absolute', left: 10, color: SMUTED, fontSize: 12, fontFamily: 'JetBrains Mono', pointerEvents: 'none', zIndex: 1 }}>{prefix}</span>}
      <input
        type="number" value={value} step={step ?? 1} min={min} max={max}
        onChange={e => onChange(+e.target.value)}
        onFocus={() => setFoc(true)} onBlur={() => setFoc(false)}
        style={{ width: '100%', background: SINPUT, border: `1.5px solid ${foc ? '#2563EB' : 'rgba(0,0,0,.1)'}`, borderRadius: 6, padding: `8px ${suffix ? 30 : 10}px 8px ${prefix ? 26 : 10}px`, color: STEXT, fontFamily: 'JetBrains Mono,monospace', fontSize: 13, outline: 'none', transition: 'border-color .15s' }}
      />
      {suffix && <span style={{ position: 'absolute', right: 10, color: SMUTED, fontSize: 12, pointerEvents: 'none' }}>{suffix}</span>}
    </div>
  );
}

function SSelect({ value, onChange, options }: {
  value: string; onChange: (v: string) => void; options: [string, string][];
}) {
  return (
    <div style={{ position: 'relative' }}>
      <select
        value={value} onChange={e => onChange(e.target.value)}
        style={{ width: '100%', background: SINPUT, border: `1px solid ${SBORDER}`, borderRadius: 6, padding: '8px 26px 8px 10px', color: STEXT, fontFamily: 'DM Sans,sans-serif', fontSize: 12, outline: 'none' }}
      >
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: SMUTED, fontSize: 8, pointerEvents: 'none' }}>▼</span>
    </div>
  );
}

function SField({ label, tip, children }: { label: string; tip?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 10 }} title={tip}>
      <div style={{ fontSize: 9, fontWeight: 700, color: SMUTED, textTransform: 'uppercase', letterSpacing: '.09em', marginBottom: 5 }}>
        {label}{tip && <span style={{ marginLeft: 3, opacity: .7, cursor: 'help' }}>ⓘ</span>}
      </div>
      {children}
    </div>
  );
}

function SSection({ title, children, open: initOpen = true }: {
  title: string; children: React.ReactNode; open?: boolean;
}) {
  const [open, setOpen] = useState(initOpen);
  return (
    <div style={{ borderTop: `1px solid ${SBORDER}`, paddingTop: 14, marginBottom: 4 }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', marginBottom: open ? 12 : 2, padding: 0 }}
      >
        <span style={{ fontSize: 9, fontWeight: 800, color: SMUTED, textTransform: 'uppercase', letterSpacing: '.12em', fontFamily: 'DM Sans' }}>{title}</span>
        <span style={{ fontSize: 9, color: SMUTED, opacity: .7 }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && <div style={{ paddingBottom: 10 }}>{children}</div>}
    </div>
  );
}

// ─── SVG Chart ────────────────────────────────────────────────────────────
interface ChartSeries { key: keyof ChartPoint; color: string; label: string; }

function Chart({ data, series, h = 180 }: { data: ChartPoint[]; series: ChartSeries[]; h?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [w, setW] = useState(500);
  const [hov, setHov] = useState<{ i: number; x: number; y: number } | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  const pad = { t: 8, r: 12, b: 30, l: 70 };
  const W = Math.max(w - pad.l - pad.r, 10), H = h - pad.t - pad.b;
  const all = series.flatMap(s => data.map(d => (d[s.key] as number) || 0));
  const yMax = Math.max(...all, 1) * 1.06;
  const xS = (i: number) => (i / Math.max(data.length - 1, 1)) * W;
  const yS = (v: number) => H - Math.min(v / yMax, 1) * H;
  const ln = (k: keyof ChartPoint) => data.map((d, i) => `${i === 0 ? 'M' : 'L'}${xS(i).toFixed(1)},${yS((d[k] as number) || 0).toFixed(1)}`).join(' ');
  const ar = (k: keyof ChartPoint) => {
    const p = data.map((d, i) => `${xS(i).toFixed(1)},${yS((d[k] as number) || 0).toFixed(1)}`);
    return p.length ? `M${p[0]} L${p.slice(1).join(' L')} L${xS(data.length - 1)},${H} L0,${H} Z` : '';
  };
  const yTix = [0, .25, .5, .75, 1].map(p => yMax * p);
  const xIdxs: number[] = [];
  const st = Math.max(1, Math.floor(data.length / 6));
  for (let i = 0; i < data.length; i += st) xIdxs.push(i);
  const fmtV = (v: number) => v >= 1e6 ? `R${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `R${(v / 1e3).toFixed(0)}k` : `R${v.toFixed(0)}`;
  const fmtYm = (ym: string) => {
    if (!ym) return '';
    const [y, m] = ym.split('/');
    return new Date(+y, +m - 1, 1).toLocaleDateString('en-ZA', { month: 'short', year: 'numeric' });
  };
  const onMov = (e: React.MouseEvent) => {
    if (!svgRef.current || !data.length) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left - pad.l;
    setHov({ i: Math.max(0, Math.min(data.length - 1, Math.round(mx / W * (data.length - 1)))), x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%' }}>
      <svg ref={svgRef} width={w} height={h} onMouseMove={onMov} onMouseLeave={() => setHov(null)} style={{ display: 'block', cursor: 'crosshair' }}>
        <defs>
          {series.map(s => (
            <linearGradient key={s.key as string} id={`gr${s.key as string}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity=".15" />
              <stop offset="100%" stopColor={s.color} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>
        <g transform={`translate(${pad.l},${pad.t})`}>
          {yTix.map((v, i) => (
            <g key={i}>
              <line x1={0} y1={yS(v)} x2={W} y2={yS(v)} stroke="#EDE9E3" strokeWidth={1} />
              <text x={-8} y={yS(v) + 4} textAnchor="end" fontSize={9} fill="#ADA9A2" fontFamily="JetBrains Mono">{fmtV(v)}</text>
            </g>
          ))}
          <line x1={0} y1={H} x2={W} y2={H} stroke="#E4E0DA" strokeWidth={1} />
          {xIdxs.map(i => (
            <text key={i} x={xS(i)} y={H + 18} textAnchor="middle" fontSize={9} fill="#ADA9A2" fontFamily="DM Sans">{fmtYm(data[i]?.ym)}</text>
          ))}
          {series.map(s => (
            <g key={s.key as string}>
              <path d={ar(s.key)} fill={`url(#gr${s.key as string})`} />
              <path d={ln(s.key)} fill="none" stroke={s.color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
            </g>
          ))}
          {hov && data[hov.i] && (
            <g>
              <line x1={xS(hov.i)} y1={0} x2={xS(hov.i)} y2={H} stroke="#C8C5BE" strokeWidth={1} strokeDasharray="4,3" />
              {series.map(s => (
                <circle key={s.key as string} cx={xS(hov.i)} cy={yS((data[hov.i][s.key] as number) || 0)} r={4} fill={s.color} stroke="#fff" strokeWidth={2} />
              ))}
            </g>
          )}
        </g>
      </svg>
      {hov && data[hov.i] && (
        <div style={{ position: 'absolute', left: Math.min(hov.x + 12, w - 170), top: Math.max(hov.y - 10, 4), background: 'rgba(255,255,255,.92)', backdropFilter: 'blur(12px)', borderRadius: 8, padding: '8px 12px', fontSize: 11, pointerEvents: 'none', zIndex: 10, lineHeight: 2, boxShadow: '0 4px 20px rgba(0,0,0,.12)', minWidth: 160, border: '1px solid rgba(0,0,0,.07)' }}>
          <div style={{ fontWeight: 700, borderBottom: '1px solid rgba(0,0,0,.08)', paddingBottom: 4, marginBottom: 6, color: '#1A1814' }}>{fmtYm(data[hov.i].ym)}</div>
          {series.map(s => (
            <div key={s.key as string} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: s.color, display: 'inline-block', flexShrink: 0 }} />
              <span style={{ color: SMUTED, flex: 1 }}>{s.label}:</span>
              <span style={{ fontFamily: 'JetBrains Mono', color: '#1A1814' }}>{fmt((data[hov.i][s.key] as number) || 0)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Timeline ─────────────────────────────────────────────────────────────
function Timeline({ base, scen, hasExtra }: { base: AdaptedResult; scen: AdaptedResult | null; hasExtra: boolean }) {
  const maxM = Math.max(base.totalMonths, scen?.totalMonths ?? 0, 1);
  const rows = [
    { label: 'Baseline', m: base.totalMonths, c: '#9CA3AF' },
    ...(hasExtra && scen ? [{ label: 'With extras', m: scen.totalMonths, c: '#059669' }] : []),
  ];
  return (
    <div>
      <div style={{ fontSize: 9, fontWeight: 700, color: '#ADA9A2', textTransform: 'uppercase', letterSpacing: '.09em', marginBottom: 10 }}>Loan Timeline</div>
      {rows.map(row => (
        <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <div style={{ width: 72, fontSize: 11, color: '#9CA3AF', flexShrink: 0 }}>{row.label}</div>
          <div style={{ flex: 1, height: 8, background: '#EDE9E3', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ width: `${(row.m / maxM) * 100}%`, height: '100%', background: row.c, borderRadius: 4, transition: 'width .45s ease' }} />
          </div>
          <div style={{ width: 56, fontFamily: 'JetBrains Mono', fontSize: 11, fontWeight: 600, color: row.c, textAlign: 'right', flexShrink: 0 }}>{fmtMonths(row.m)}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Amortisation Table ───────────────────────────────────────────────────
function AmortTable({ base, scen, hasExtra }: { base: AdaptedResult; scen: AdaptedResult | null; hasExtra: boolean }) {
  const [view, setView] = useState<'scenario' | 'baseline'>('scenario');
  const active = hasExtra && view === 'scenario' && scen ? scen : base;
  const months = active.months;
  const years = [...new Set(months.map(m => m.ym.split('/')[0]))].sort();
  const [yr, setYr] = useState('all');
  const [pmtOnly, setPmtOnly] = useState(false);

  useEffect(() => { if (yr !== 'all' && !years.includes(yr)) setYr('all'); }, [active]);

  let rows = yr === 'all' ? months : months.filter(m => m.ym.startsWith(yr + '/'));
  if (pmtOnly) rows = rows.filter(m => m.totalPaid > 0.01);

  const yrSum = yr !== 'all' ? {
    a: rows.reduce((s, r) => s + r.interestAccrued, 0),
    p: rows.reduce((s, r) => s + r.interestPaid, 0),
    pr: rows.reduce((s, r) => s + r.principalReduction, 0),
    t: rows.reduce((s, r) => s + r.totalPaid, 0),
  } : null;

  const th: React.CSSProperties = { padding: '8px 12px', fontSize: 9, fontWeight: 700, color: '#9CA3AF', textAlign: 'right', textTransform: 'uppercase', letterSpacing: '.06em', borderBottom: '1.5px solid #E4E0DA', whiteSpace: 'nowrap', background: '#FAFAF8', position: 'sticky', top: 0 };
  const td: React.CSSProperties = { padding: '7px 12px', fontSize: 12, fontFamily: 'JetBrains Mono,monospace', textAlign: 'right', color: '#374151' };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', background: '#FAFAF8', borderBottom: '1px solid #E4E0DA', flexWrap: 'wrap' }}>
        {hasExtra && (
          <div style={{ display: 'flex', background: '#EDE9E3', borderRadius: 6, padding: 2, gap: 2 }}>
            {(['scenario', 'baseline'] as const).map(v => (
              <button key={v} onClick={() => { setView(v); setYr('all'); }}
                style={{ padding: '4px 10px', borderRadius: 5, border: 'none', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans', background: view === v ? '#fff' : 'transparent', color: view === v ? '#1A1814' : '#9CA3AF', boxShadow: view === v ? '0 1px 3px rgba(0,0,0,.1)' : 'none', transition: 'all .15s' }}>
                {v === 'scenario' ? 'With Extras' : 'Baseline'}
              </button>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label style={{ fontSize: 11, color: '#9CA3AF' }}>Year:</label>
          <select value={yr} onChange={e => setYr(e.target.value)} style={{ border: '1px solid #E4E0DA', borderRadius: 5, padding: '4px 22px 4px 8px', fontSize: 11, background: '#fff', appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='5'%3E%3Cpath d='M0 0l4 5 4-5z' fill='%239CA3AF'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 7px center' }}>
            <option value="all">All Years</option>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#9CA3AF', cursor: 'pointer' }}>
          <input type="checkbox" checked={pmtOnly} onChange={e => setPmtOnly(e.target.checked)} /> Payment months only
        </label>
        <div style={{ fontSize: 10, color: '#9CA3AF', marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 10, height: 10, background: '#DBEAFE', border: '1px solid #93C5FD', display: 'inline-block' }} /> Lump sum month
        </div>
      </div>

      {yrSum && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', background: '#EFF6FF', borderBottom: '1px solid #BFDBFE' }}>
          {([['Interest Accrued', yrSum.a], ['Interest Paid', yrSum.p], ['Principal Repaid', yrSum.pr], ['Total Paid', yrSum.t]] as [string, number][]).map(([l, v]) => (
            <div key={l} style={{ padding: '10px 14px', borderRight: '1px solid #BFDBFE' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#1D4ED8', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 3 }}>{l}</div>
              <div style={{ fontFamily: 'JetBrains Mono', fontSize: 13, fontWeight: 600, color: '#1E3A8A' }}>{fmt(v)}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ overflowX: 'auto', maxHeight: 380, overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {([['Month', 'left'], ['Int. Accrued', 'right'], ['Int. Paid', 'right'], ['Total Paid', 'right'], ['Principal ↓', 'right'], ['Balance', 'right']] as [string, 'left' | 'right'][]).map(([l, a]) => (
                <th key={l} style={{ ...th, textAlign: a }}>{l}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.ym} style={{ background: row.hasLumpSum ? '#DBEAFE' : i % 2 === 0 ? '#fff' : '#FAFAF8', borderBottom: '1px solid #F3F1EC' }}>
                <td style={{ ...td, textAlign: 'left', color: row.hasLumpSum ? '#1E3A8A' : '#6B7280', fontWeight: row.hasLumpSum ? 600 : 400 }}>{row.ym}</td>
                <td style={td}>{fmt(row.interestAccrued)}</td>
                <td style={td}>{fmt(row.interestPaid)}</td>
                <td style={{ ...td, color: row.totalPaid > .01 ? '#111' : '#D1D5DB' }}>{fmt(row.totalPaid)}</td>
                <td style={{ ...td, color: '#2563EB' }}>{fmt(row.principalReduction)}</td>
                <td style={{ ...td, fontWeight: 700, color: row.endBalance <= .01 ? '#16A34A' : '#111' }}>{row.endBalance <= .01 ? '✓' : fmt(row.endBalance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>No rows match the current filter.</div>}
      </div>
    </div>
  );
}

// ─── Lump Sum Modal ───────────────────────────────────────────────────────
interface LumpSumEntry { date: string; amount: number; label: string; }

function LumpModal({ editing, onSave, onClose }: {
  editing: LumpSumEntry | null;
  onSave: (ls: LumpSumEntry) => void;
  onClose: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(editing?.date ?? today);
  const [amount, setAmount] = useState(editing ? String(editing.amount) : '');
  const [label, setLabel] = useState(editing?.label ?? '');
  const inp: React.CSSProperties = { width: '100%', border: '1.5px solid #E4E0DA', borderRadius: 8, padding: '10px 12px', fontSize: 14, color: '#1A1814', background: '#fff', fontFamily: 'DM Sans', outline: 'none', transition: 'border-color .15s' };
  const save = () => {
    if (!date || !amount || +amount <= 0) { alert('Please enter a valid date and amount'); return; }
    onSave({ date, amount: +amount, label });
    onClose();
  };
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: 380, boxShadow: '0 24px 60px rgba(0,0,0,.25)' }} onClick={e => e.stopPropagation()}>
        <h2 style={{ fontFamily: 'Syne,sans-serif', fontSize: 18, fontWeight: 800, marginBottom: 6 }}>{editing ? 'Edit' : 'Add'} Lump Sum</h2>
        <p style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 22, lineHeight: 1.6 }}>One-off payments applied interest-first via waterfall.</p>
        {([
          ['Date', <input key="d" type="date" value={date} onChange={e => setDate(e.target.value)} style={inp} />],
          ['Amount (R)', (
            <div key="a" style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', fontFamily: 'JetBrains Mono', pointerEvents: 'none' }}>R</span>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} min={1} step={100} placeholder="50 000" style={{ ...inp, paddingLeft: 26, fontFamily: 'JetBrains Mono' }} />
            </div>
          )],
          ['Label (optional)', <input key="l" type="text" value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. Annual bonus" style={inp} />],
        ] as [string, React.ReactNode][]).map(([l, el]) => (
          <div key={l as string} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 5 }}>{l}</div>
            {el}
          </div>
        ))}
        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 11, border: '1.5px solid #E4E0DA', borderRadius: 8, background: '#fff', color: '#374151', fontSize: 13, fontWeight: 600 }}>Cancel</button>
          <button onClick={save} style={{ flex: 1, padding: 11, border: 'none', borderRadius: 8, background: '#059669', color: '#fff', fontSize: 13, fontWeight: 700 }}>{editing ? 'Update' : 'Add'} Payment</button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════ APP ══════════════════════════════════════════
interface EngineResult { base: AdaptedResult; scen: AdaptedResult; chartData: ChartPoint[]; error: null; }
interface EngineError { error: string; }
type Result = EngineResult | EngineError | null;

const TABS = [
  { id: 'balance' as const, label: 'Balance', c: '#3B82F6', series: [{ key: 'baseBalance' as keyof ChartPoint, color: '#C8C5BE', label: 'Baseline' }, { key: 'scenBalance' as keyof ChartPoint, color: '#3B82F6', label: 'With Extras' }] },
  { id: 'monthly' as const, label: 'Monthly Interest', c: '#10B981', series: [{ key: 'baseMonthlyInt' as keyof ChartPoint, color: '#C8C5BE', label: 'Baseline' }, { key: 'scenMonthlyInt' as keyof ChartPoint, color: '#10B981', label: 'With Extras' }] },
  { id: 'cumint' as const, label: 'Cumulative Interest', c: '#EF4444', series: [{ key: 'baseCumInt' as keyof ChartPoint, color: '#C8C5BE', label: 'Baseline' }, { key: 'scenCumInt' as keyof ChartPoint, color: '#EF4444', label: 'With Extras' }] },
];

export default function App() {
  const [loan, setLoan] = useState<LoanFlat>(loadState);
  const [result, setResult] = useState<Result>(null);
  const [busy, setBusy] = useState(false);
  const [activeChart, setActiveChart] = useState<'balance' | 'monthly' | 'cumint'>('balance');
  const [showTable, setShowTable] = useState(false);
  const [modal, setModal] = useState<{ mode: 'add' | 'edit'; idx: number | null } | null>(null);

  const set = <K extends keyof LoanFlat>(k: K, v: LoanFlat[K]) => setLoan(p => ({ ...p, [k]: v }));

  useEffect(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(loan)); } catch {}
  }, [loan]);

  const depKey = [
    loan.principal, loan.instalment, loan.payDay, loan.annualRate,
    loan.convention, loan.postingRule, loan.postingDay,
    loan.settlementRule, loan.weekendRule, loan.extraMonthly,
    loan.lumpDirectToPrincipal, JSON.stringify(loan.lumpSums),
  ].join('|');

  useEffect(() => {
    setBusy(true);
    const t = setTimeout(() => {
      try {
        const { loanState, interestRules, paymentRules, scenarioControls } = loanToEngineInputs(loan);
        const cmp = compareScenarios(loanState, interestRules, paymentRules, scenarioControls);
        const base = adaptResult(cmp.baseline);
        const scen = adaptResult(cmp.scenario);
        setResult({ base, scen, chartData: buildChartData(base, scen), error: null });
      } catch (e) {
        setResult({ error: (e as Error).message });
      }
      setBusy(false);
    }, 100);
    return () => clearTimeout(t);
  }, [depKey]);

  const hasExtra = loan.extraMonthly > 0 || loan.lumpSums.length > 0;
  const maxExtra = loan.instalment * 4;
  const lumpTotal = loan.lumpSums.reduce((s, l) => s + l.amount, 0);

  const openModal = (mode: 'add' | 'edit', idx?: number) => setModal({ mode, idx: idx ?? null });
  const saveL = (ls: LumpSumEntry) => {
    if (modal?.mode === 'edit' && modal.idx !== null) {
      setLoan(p => { const a = [...p.lumpSums]; a[modal.idx!] = ls; return { ...p, lumpSums: a }; });
    } else {
      setLoan(p => ({ ...p, lumpSums: [...p.lumpSums, ls].sort((a, b) => a.date.localeCompare(b.date)) }));
    }
  };
  const delL = (i: number) => {
    if (window.confirm('Delete this lump sum?')) setLoan(p => ({ ...p, lumpSums: p.lumpSums.filter((_, j) => j !== i) }));
  };

  const isOk = (r: Result): r is EngineResult => r !== null && 'base' in r;
  const b = isOk(result) ? result.base : null;
  const s = isOk(result) ? result.scen : null;
  const intSaved = b && s ? b.totalInterest - s.totalInterest : 0;
  const moSaved = b && s ? b.totalMonths - s.totalMonths : 0;
  const loading = busy || !b;
  const tab = TABS.find(t => t.id === activeChart)!;
  const chartSeries = hasExtra ? tab.series : [tab.series[0]];
  const chartData = isOk(result) ? result.chartData : [];

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>

      {/* ══ SIDEBAR ══ */}
      <div className="glass-sidebar" style={{ width: 288, flexShrink: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '22px 20px 12px' }}>
          <div style={{ fontSize: 8, fontWeight: 800, color: 'rgba(0,0,0,.3)', letterSpacing: '.2em', textTransform: 'uppercase', marginBottom: 6 }}>South Africa</div>
          <div style={{ fontFamily: 'Syne,sans-serif', fontSize: 20, fontWeight: 800, color: '#1A1814', lineHeight: 1.15 }}>Loan Payoff<br />Simulator</div>
          <div style={{ fontSize: 11, color: SMUTED, marginTop: 8, lineHeight: 1.5 }}>Daily-accurate interest accrual. Results update live.</div>
        </div>

        <div style={{ flex: 1, padding: '4px 20px 24px' }}>
          <SSection title="Loan Details">
            <SField label="Principal Outstanding" tip="Your loan balance as of the last payment date.">
              <SInput value={loan.principal} onChange={v => set('principal', v)} prefix="R" step={1000} min={1} />
            </SField>
            <SField label="Monthly Instalment" tip="Your normal monthly instalment debited each month.">
              <SInput value={loan.instalment} onChange={v => set('instalment', v)} prefix="R" step={500} min={1} />
            </SField>
            <SField label="Payment Day of Month" tip="Which day of the month does your payment come off?">
              <SInput value={loan.payDay} onChange={v => set('payDay', Math.max(1, Math.min(31, Math.round(v))))} step={1} min={1} max={31} />
            </SField>
          </SSection>

          <SSection title="Interest Rules">
            <SField label="Annual Rate (%)" tip="Your loan's interest rate per year.">
              <SInput value={loan.annualRate} onChange={v => set('annualRate', v)} suffix="%" step={0.01} min={0.01} />
            </SField>
            <SField label="Day Count Convention" tip="How your bank counts days. Most SA banks use ACT/365.">
              <SSelect value={loan.convention} onChange={v => set('convention', v)} options={[['ACT/365', 'ACT/365 (Most common in SA)'], ['ACT/366', 'ACT/366'], ['ACT/ACT', 'ACT/ACT'], ['30/360 ISDA', '30/360 ISDA (US)']]} />
            </SField>
            <SField label="Interest Posting Rule" tip="How interest gets added to your loan each month.">
              <SSelect value={loan.postingRule} onChange={v => set('postingRule', v)} options={[['POST_MONTHLY_TO_INTEREST_DUE', 'Post to Interest Due (Most common)'], ['CAPITALISE_MONTHLY', 'Capitalise Monthly (Rare)']]} />
            </SField>
            <SField label="Interest Posting Day (1–31)" tip="Day of each month when interest is posted.">
              <SInput value={loan.postingDay} onChange={v => set('postingDay', Math.max(1, Math.min(31, Math.round(v))))} step={1} min={1} max={31} />
            </SField>
          </SSection>

          <SSection title="Payment Rules" open={false}>
            <SField label="Interest Settlement Rule" tip="When you pay, what interest gets deducted?">
              <SSelect value={loan.settlementRule} onChange={v => set('settlementRule', v)} options={[['SETTLE_POSTED_PLUS_ACCRUED', 'Posted + Accrued (Recommended)'], ['SETTLE_POSTED_ONLY', 'Posted Only']]} />
            </SField>
            <SField label="Weekend Payment Handling" tip="If payment falls on a weekend, when does it process?">
              <SSelect value={loan.weekendRule} onChange={v => set('weekendRule', v)} options={[['NEXT_BUSINESS_DAY', 'Next Business Day (Most common)'], ['PREV_BUSINESS_DAY', 'Previous Business Day'], ['NONE', 'No Adjustment']]} />
            </SField>
            <div style={{ background: 'rgba(0,0,0,.05)', border: `1px solid ${SBORDER}`, borderRadius: 6, padding: '8px 10px', fontSize: 11, color: SMUTED, lineHeight: 1.6, marginTop: 2 }}>
              <span style={{ color: '#374151', fontWeight: 600 }}>Payment order:</span> Interest Due → Principal
            </div>
          </SSection>
        </div>

        {busy && (
          <div style={{ padding: '8px 20px', fontSize: 9, fontWeight: 700, color: '#059669', letterSpacing: '.1em', textTransform: 'uppercase', borderTop: '1px solid rgba(0,0,0,.07)', animation: 'pulse 1.2s infinite' }}>
            ⟳ Recalculating
          </div>
        )}
      </div>

      {/* ══ MAIN ══ */}
      <div style={{ flex: 1, overflowY: 'auto', minWidth: 0 }}>
        <div style={{ padding: '20px 24px', maxWidth: 960, display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* ── HERO ── */}
          <div className="glass" style={{ borderRadius: 14, padding: '22px 26px', position: 'relative', overflow: 'hidden' }}>
            {hasExtra && intSaved > 0 && (
              <div style={{ position: 'absolute', top: -60, right: -60, width: 240, height: 240, background: '#059669', borderRadius: '50%', opacity: .08, pointerEvents: 'none' }} />
            )}

            {!hasExtra ? (
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, color: SMUTED, textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 16 }}>Your current loan trajectory</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)' }}>
                  {[
                    { l: 'Payoff Date', v: loading ? '—' : fmtDate(b!.payoffDate, { month: 'short', year: 'numeric' }), sub: loading ? '…' : fmtMonths(b!.totalMonths), big: true, c: '#1A1814' },
                    { l: 'Total Interest', v: loading ? '—' : fmt(b!.totalInterest), sub: 'over loan term', big: false, c: '#DC2626' },
                    { l: 'Monthly Payment', v: fmt(loan.instalment), sub: 'Drag slider to explore →', big: false, c: '#1A1814' },
                  ].map((item, i) => (
                    <div key={i} style={{ borderRight: i < 2 ? '1px solid rgba(0,0,0,.09)' : 'none', paddingRight: i < 2 ? 22 : 0, paddingLeft: i > 0 ? 22 : 0 }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: SMUTED, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>{item.l}</div>
                      <div style={{ fontFamily: item.big ? 'Syne,sans-serif' : 'JetBrains Mono,monospace', fontSize: item.big ? 26 : 22, fontWeight: item.big ? 800 : 600, color: item.c, lineHeight: 1.1 }}>
                        <Val v={item.v} />
                      </div>
                      <div style={{ fontSize: 11, color: SMUTED, marginTop: 5 }}>{item.sub}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#059669', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 16 }}>
                  With {fmt(loan.extraMonthly)}/month extra{lumpTotal > 0 ? ` + ${fmt(lumpTotal)} lump sums` : ''}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr' }}>
                  <div style={{ borderRight: '1px solid rgba(0,0,0,.09)', paddingRight: 24 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: SMUTED, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>You will be debt-free</div>
                    <div style={{ fontFamily: 'Syne,sans-serif', fontSize: 30, fontWeight: 800, color: '#059669', lineHeight: 1 }}>
                      <Val v={loading ? '—' : moSaved > 0 ? fmtMonths(moSaved) : '—'} />
                    </div>
                    <div style={{ fontSize: 11, color: SMUTED, marginTop: 6 }}>earlier than your baseline</div>
                  </div>
                  <div style={{ borderRight: '1px solid rgba(0,0,0,.09)', padding: '0 24px' }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: SMUTED, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>Interest Saved</div>
                    <div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 24, fontWeight: 600, color: '#059669', lineHeight: 1 }}>
                      <Val v={loading ? '—' : intSaved > 0 ? fmt(intSaved) : '—'} />
                    </div>
                    <div style={{ fontSize: 11, color: SMUTED, marginTop: 6 }}>
                      {!loading && intSaved > 0 && b ? fmtPct(intSaved / b.totalInterest) + ' of total interest' : ''}
                    </div>
                  </div>
                  <div style={{ paddingLeft: 24 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: SMUTED, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>New Payoff Date</div>
                    <div style={{ fontFamily: 'Syne,sans-serif', fontSize: 20, fontWeight: 800, color: '#1A1814', lineHeight: 1.1 }}>
                      <Val v={!loading && s ? fmtDate(s.payoffDate, { month: 'short', year: 'numeric' }) : '—'} />
                    </div>
                    <div style={{ fontSize: 11, color: SMUTED, marginTop: 6 }}>
                      vs {!loading && b ? fmtDate(b.payoffDate, { month: 'short', year: 'numeric' }) : '—'} baseline
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── WHAT-IF CONTROLS ── */}
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E4E0DA', padding: '20px 22px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1A1814', marginBottom: 2 }}>What-if Scenario</div>
                <div style={{ fontSize: 11, color: '#9CA3AF' }}>See how extra payments change your outcome in real time</div>
              </div>
              <button onClick={() => openModal('add')} style={{ background: '#1A1814', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 700, boxShadow: '0 2px 8px rgba(0,0,0,.15)', letterSpacing: '.02em' }}>
                + Lump Sum
              </button>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '.08em' }}>Extra Monthly Payment</span>
                <span style={{ fontFamily: 'Syne,sans-serif', fontSize: 28, fontWeight: 800, color: loan.extraMonthly > 0 ? '#2563EB' : '#D4D0C8', transition: 'color .2s' }}>
                  <Val v={fmt(loan.extraMonthly)} />
                </span>
              </div>
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', left: 0, right: 0, height: 6, background: '#EDE9E3', borderRadius: 3, pointerEvents: 'none' }}>
                  <div style={{ height: '100%', width: `${(loan.extraMonthly / maxExtra) * 100}%`, background: 'linear-gradient(90deg,#1D4ED8,#3B82F6)', borderRadius: 3, transition: 'width .06s' }} />
                </div>
                <input type="range" min={0} max={maxExtra} step={100} value={loan.extraMonthly} onChange={e => set('extraMonthly', +e.target.value)} style={{ position: 'relative', zIndex: 1 }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 10, color: '#C8C5BE', fontFamily: 'JetBrains Mono' }}>
                <span>R 0</span><span>{fmt(maxExtra)}</span>
              </div>
            </div>

            {loan.lumpSums.length > 0 && (
              <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid #EDE9E3' }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>One-Time Payments</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {loan.lumpSums.map((ls, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 20, padding: '5px 8px 5px 12px' }}>
                      <span style={{ fontFamily: 'JetBrains Mono', fontWeight: 700, fontSize: 12, color: '#166534' }}>{fmt(ls.amount)}</span>
                      <span style={{ fontSize: 11, color: '#6B7280' }}>· {fmtDate(new Date(ls.date + 'T00:00:00'), { month: 'short', year: 'numeric' })}</span>
                      {ls.label && <span style={{ fontSize: 11, color: '#9CA3AF' }}>· {ls.label}</span>}
                      <button onClick={() => openModal('edit', i)} style={{ background: 'none', border: 'none', color: '#2563EB', fontSize: 11, fontWeight: 700, padding: '0 3px' }}>Edit</button>
                      <button onClick={() => delL(i)} style={{ background: 'none', border: 'none', color: '#EF4444', fontSize: 15, lineHeight: '1', padding: '0 3px' }}>×</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, fontSize: 12, color: '#9CA3AF', cursor: 'pointer' }} title="When ON: lump sums skip interest and reduce loan balance directly.">
              <input type="checkbox" checked={loan.lumpDirectToPrincipal} onChange={e => set('lumpDirectToPrincipal', e.target.checked)} />
              Apply lump sums directly to principal
            </label>
          </div>

          {/* ── TIMELINE ── */}
          {!loading && b && (
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E4E0DA', padding: '18px 22px' }}>
              <Timeline base={b} scen={s} hasExtra={hasExtra} />
            </div>
          )}

          {/* ── CHARTS ── */}
          {!loading && isOk(result) && (
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E4E0DA', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid #EDE9E3' }}>
                {TABS.map(t => (
                  <button key={t.id} onClick={() => setActiveChart(t.id)} style={{
                    padding: '11px 16px', background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 12, fontWeight: 600, fontFamily: 'DM Sans',
                    color: activeChart === t.id ? '#1A1814' : '#9CA3AF',
                    borderBottom: `2px solid ${activeChart === t.id ? t.c : 'transparent'}`,
                    marginBottom: -1, whiteSpace: 'nowrap', transition: 'color .15s',
                  }}>{t.label}</button>
                ))}
                <div style={{ flex: 1 }} />
                {hasExtra && (
                  <div style={{ display: 'flex', gap: 14, padding: '0 16px' }}>
                    {[{ c: '#C8C5BE', l: 'Baseline' }, { c: tab.c, l: 'With Extras' }].map(x => (
                      <span key={x.l} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: '#9CA3AF' }}>
                        <span style={{ display: 'inline-block', width: 16, height: 2, background: x.c, borderRadius: 1 }} />{x.l}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ padding: '16px 20px 12px' }}>
                <Chart data={chartData} series={chartSeries} h={200} />
              </div>
            </div>
          )}

          {/* ── AMORTISATION TABLE ── */}
          {!loading && b && (
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E4E0DA', overflow: 'hidden' }}>
              <button onClick={() => setShowTable(v => !v)} style={{ width: '100%', background: 'none', border: 'none', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', fontFamily: 'DM Sans' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#1A1814' }}>
                  Amortisation Schedule{' '}
                  <span style={{ fontFamily: 'JetBrains Mono', fontSize: 11, fontWeight: 400, color: '#9CA3AF', marginLeft: 8 }}>{b.totalMonths} months</span>
                </span>
                <span style={{ fontSize: 11, color: '#9CA3AF' }}>{showTable ? '▲ Collapse' : '▼ Expand'}</span>
              </button>
              {showTable && (
                <div style={{ borderTop: '1px solid #EDE9E3' }}>
                  <AmortTable base={b} scen={s} hasExtra={hasExtra} />
                </div>
              )}
            </div>
          )}

          {/* ── ERROR ── */}
          {!busy && result && 'error' in result && result.error && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, padding: '16px 20px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 20 }}>⚠️</span>
              <div>
                <div style={{ fontWeight: 700, color: '#991B1B', marginBottom: 4 }}>Calculation Error</div>
                <div style={{ fontSize: 13, color: '#B91C1C' }}>{result.error}</div>
              </div>
            </div>
          )}

        </div>
      </div>

      {modal && (
        <LumpModal
          editing={modal.mode === 'edit' && modal.idx !== null ? loan.lumpSums[modal.idx] : null}
          onSave={saveL}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
