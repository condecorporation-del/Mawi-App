import { formatCurrencyCents } from "@/features/dashboard/format";

type DashboardCardsProps = {
  incomeCents: number;
  expenseCents: number;
  profitCents: number;
  upcomingCashFlowCents: number;
  overduePayableCents: number;
  overdueReceivableCents: number;
  openAlertsCount: number;
};

const CIRCUMFERENCE = 251.2;

type MetricCard = {
  key: keyof DashboardCardsProps;
  title: string;
  subtitle: string;
  tone: "cyan" | "purple" | "green" | "error";
  pct: (props: DashboardCardsProps) => number;
};

const metricCards: MetricCard[] = [
  {
    key: "incomeCents",
    title: "Ingresos",
    subtitle: "Facturas por cobrar emitidas",
    tone: "green",
    pct: (props) => {
      const total = Math.max(props.incomeCents + props.expenseCents, 1);
      return Math.min(props.incomeCents / total, 1);
    },
  },
  {
    key: "expenseCents",
    title: "Gastos",
    subtitle: "Gastos registrados",
    tone: "error",
    pct: (props) => {
      const total = Math.max(props.incomeCents + props.expenseCents, 1);
      return Math.min(props.expenseCents / total, 1);
    },
  },
  {
    key: "profitCents",
    title: "Utilidad Estimada",
    subtitle: "Ingresos menos gastos",
    tone: "cyan",
    pct: (props) => {
      const base = Math.max(Math.abs(props.incomeCents), 1);
      return Math.min(Math.max(props.profitCents, 0) / base, 1);
    },
  },
  {
    key: "upcomingCashFlowCents",
    title: "Flujo Próximo",
    subtitle: "Cobros menos pagos a 30 días",
    tone: "purple",
    pct: (props) => {
      const base = Math.max(Math.abs(props.incomeCents), 1);
      return Math.min(Math.max(props.upcomingCashFlowCents, 0) / base, 1);
    },
  },
];

function toneStyles(tone: MetricCard["tone"]) {
  if (tone === "green") {
    return { color: "#00e383", glow: "drop-shadow-[0_0_6px_rgba(0,227,131,0.8)]" };
  }
  if (tone === "error") {
    return { color: "#ffb4ab", glow: "drop-shadow-[0_0_6px_rgba(255,180,171,0.8)]" };
  }
  if (tone === "purple") {
    return { color: "#d2bbff", glow: "drop-shadow-[0_0_6px_rgba(210,187,255,0.8)]" };
  }
  return { color: "#00F5FF", glow: "drop-shadow-[0_0_6px_rgba(0,245,255,0.8)]" };
}

export function DashboardCards(props: DashboardCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 xl:grid-cols-3">
      {metricCards.map((item) => {
        const pct = item.pct(props);
        const pctDisplay = Math.round(pct * 100);
        const dashOffset = CIRCUMFERENCE * (1 - pct);
        const tone = toneStyles(item.tone);

        return (
          <div
            key={item.key}
            className="glass-panel group relative overflow-hidden rounded-xl transition-all duration-500 hover:scale-[1.02] hover:border-mawi-cyan/40"
          >
            <div className="pointer-events-none absolute inset-0 holographic-overlay opacity-40" />
            <div className="relative z-10 flex h-full flex-col p-6">
              <div className="mb-6 flex items-start justify-between">
                <div>
                  <span className="font-space-grotesk text-[10px] font-bold uppercase tracking-widest text-mawi-cyan/60">
                    Panel KPI
                  </span>
                  <h3 className="font-space-grotesk text-2xl font-medium text-mawi-on-bg">{item.title}</h3>
                </div>
                <div className="relative h-16 w-16">
                  <svg className="progress-ring h-full w-full" viewBox="0 0 100 100">
                    <circle className="text-white/5" cx="50" cy="50" r="40" fill="transparent" stroke="currentColor" strokeWidth="8" />
                    <circle
                      className={tone.glow}
                      cx="50"
                      cy="50"
                      r="40"
                      fill="transparent"
                      stroke={tone.color}
                      strokeDasharray={CIRCUMFERENCE}
                      strokeDashoffset={dashOffset}
                      strokeWidth="8"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center font-inter text-[12px] font-medium text-mawi-on-bg">
                    {pctDisplay}%
                  </div>
                </div>
              </div>
              <p className="font-space-grotesk text-[10px] font-bold uppercase tracking-widest text-mawi-on-bg/40">
                {item.subtitle}
              </p>
              <p className="mt-3 font-space-grotesk text-2xl font-semibold text-mawi-on-bg">
                {formatCurrencyCents(props[item.key])}
              </p>
            </div>
          </div>
        );
      })}
      <div className="glass-panel rounded-xl p-6">
        <p className="font-space-grotesk text-[10px] font-bold uppercase tracking-widest text-mawi-on-bg/40">Riesgo de cobranza y pagos</p>
        <h4 className="mt-2 font-space-grotesk text-lg text-mawi-on-bg">Cuentas vencidas</h4>
        <div className="mt-6 space-y-3 text-sm">
          <p className="flex items-center justify-between text-mawi-on-bg/80">
            <span>Por pagar</span>
            <span className="font-inter text-mawi-error">{formatCurrencyCents(props.overduePayableCents)}</span>
          </p>
          <p className="flex items-center justify-between text-mawi-on-bg/80">
            <span>Por cobrar</span>
            <span className="font-inter text-mawi-cyan">{formatCurrencyCents(props.overdueReceivableCents)}</span>
          </p>
          <p className="flex items-center justify-between text-mawi-on-bg/80">
            <span>Alertas abiertas</span>
            <span className="font-inter text-mawi-purple">{props.openAlertsCount}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
