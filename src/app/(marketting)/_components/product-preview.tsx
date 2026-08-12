import { cn } from "@/lib/utils"

/**
 * Abstract product previews. These are intentionally schematic shapes, not
 * screenshots — per the marketing plan we suggest the dashboard's structure
 * (summary cards, chart shapes, source/transaction lists) without implying
 * finished features or showing real financial data.
 */

function Bar({ className }: { className?: string }) {
  return <div className={cn("h-2 rounded-full bg-foreground/15", className)} />
}

function ChromeDots() {
  return (
    <div className="flex items-center gap-1.5">
      <span className="size-2.5 rounded-full bg-foreground/15" />
      <span className="size-2.5 rounded-full bg-foreground/15" />
      <span className="size-2.5 rounded-full bg-foreground/15" />
    </div>
  )
}

function SummaryTile({ accent = false }: { accent?: boolean }) {
  return (
    <div className="rounded-lg bg-muted/40 p-3">
      <Bar className="w-2/3" />
      <div
        className={cn(
          "mt-2.5 h-3.5 w-3/4 rounded-full",
          accent ? "bg-primary/70" : "bg-foreground/35",
        )}
      />
      <Bar className={cn("mt-2 w-1/2", accent && "bg-primary/40")} />
    </div>
  )
}

function AreaChart() {
  return (
    <div className="flex flex-col rounded-lg bg-muted/40 p-3">
      <div className="mb-3 flex items-center justify-between">
        <Bar className="w-16" />
        <Bar className="w-8 bg-foreground/10" />
      </div>
      <svg
        viewBox="0 0 280 96"
        fill="none"
        preserveAspectRatio="none"
        className="h-[88px] w-full"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="riva-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[24, 48, 72].map((y) => (
          <line
            key={y}
            x1="0"
            x2="280"
            y1={y}
            y2={y}
            stroke="currentColor"
            strokeOpacity="0.07"
            strokeWidth="1"
          />
        ))}
        <path
          d="M0,72 C30,46 52,58 80,46 S132,32 160,48 S212,22 244,34 S272,30 280,32 L280,96 L0,96 Z"
          fill="url(#riva-area)"
        />
        <path
          d="M0,72 C30,46 52,58 80,46 S132,32 160,48 S212,22 244,34 S272,30 280,32"
          fill="none"
          stroke="var(--primary)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
    </div>
  )
}

function DonutCard() {
  const circumference = 2 * Math.PI * 30
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg bg-muted/40 p-3">
      <svg viewBox="0 0 80 80" className="size-20" aria-hidden="true">
        <circle
          cx="40"
          cy="40"
          r="30"
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.1"
          strokeWidth="10"
        />
        <circle
          cx="40"
          cy="40"
          r="30"
          fill="none"
          stroke="var(--primary)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${circumference * 0.62} ${circumference}`}
          transform="rotate(-90 40 40)"
        />
      </svg>
      <div className="w-full space-y-1.5">
        <div className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-primary/70" />
          <Bar className="w-full" />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-foreground/20" />
          <Bar className="w-2/3" />
        </div>
      </div>
    </div>
  )
}

function ListRow({ accent = false }: { accent?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={cn(
          "size-7 shrink-0 rounded-full",
          accent ? "bg-primary/20" : "bg-foreground/10",
        )}
      />
      <div className="flex-1 space-y-1.5">
        <Bar className="w-2/5 bg-foreground/25" />
        <Bar className="w-1/4 bg-foreground/10" />
      </div>
      <Bar className="w-12 bg-foreground/25" />
    </div>
  )
}

export function DashboardPreview({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-card shadow-2xl shadow-black/30 ring-1 ring-foreground/5",
        className,
      )}
    >
      <div className="flex items-center gap-3 border-b border-border/60 px-4 py-3">
        <ChromeDots />
        <span className="ml-1 font-mono text-[11px] text-muted-foreground">
          riva / dashboard
        </span>
        <span className="ml-auto h-5 w-20 rounded-full bg-muted" />
      </div>
      <div className="space-y-3 p-4">
        <div className="grid grid-cols-3 gap-3">
          <SummaryTile accent />
          <SummaryTile />
          <SummaryTile />
        </div>
        <div className="grid grid-cols-[1.7fr_1fr] gap-3">
          <AreaChart />
          <DonutCard />
        </div>
        <div className="space-y-3 rounded-lg border border-border/60 p-3">
          <ListRow accent />
          <ListRow />
          <ListRow />
        </div>
      </div>
    </div>
  )
}

export function MobilePreview({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "w-[200px] rounded-[2rem] border-[6px] border-foreground/15 bg-card p-2 shadow-2xl shadow-black/30",
        className,
      )}
    >
      <div className="relative overflow-hidden rounded-[1.4rem] bg-background">
        <div className="absolute left-1/2 top-2 h-1.5 w-12 -translate-x-1/2 rounded-full bg-foreground/15" />
        <div className="space-y-3 px-3 pb-4 pt-7">
          <div className="flex items-center justify-between">
            <Bar className="w-16 bg-foreground/25" />
            <span className="size-6 rounded-full bg-muted" />
          </div>
          <div className="rounded-lg bg-muted/50 p-3">
            <Bar className="w-1/3" />
            <div className="mt-2 h-4 w-2/3 rounded-full bg-primary/60" />
          </div>
          <div className="space-y-3 rounded-lg border border-border/60 p-3">
            <ListRow accent />
            <ListRow />
            <ListRow />
          </div>
        </div>
      </div>
    </div>
  )
}
