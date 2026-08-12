import {
  ArrowLeftRightIcon,
  ClockIcon,
  DatabaseIcon,
  EyeOffIcon,
  MonitorIcon,
  RefreshCwIcon,
  ShieldCheckIcon,
  SmartphoneIcon,
  SquareStackIcon,
  TagIcon,
  WalletIcon,
  type LucideIcon,
} from "lucide-react"
import Link from "next/link"

import { cn } from "@/lib/utils"

import { CtaButton } from "./_components/cta-button"
import { DashboardPreview, MobilePreview } from "./_components/product-preview"
import { RivaMark, RivaWordmark } from "./_components/riva-mark"

const container = "mx-auto w-full max-w-6xl px-6 lg:px-8"

const navLinks = [
  { label: "Spaces", href: "#concepts" },
  { label: "Sources", href: "#concepts" },
  { label: "Sharing", href: "#shared" },
  { label: "Mobile", href: "#web-mobile" },
]

function SectionEyebrow({
  num,
  children,
}: {
  num: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-3 font-mono text-xs tracking-[0.18em] text-muted-foreground uppercase">
      <span className="text-primary">{num}</span>
      <span className="h-px w-6 bg-border" />
      <span>{children}</span>
    </div>
  )
}

function IconBadge({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="inline-flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
      <Icon className="size-5" />
    </span>
  )
}

export default function MarketingPage() {
  return (
    <div className="flex min-h-svh flex-col">
      {/* ---------------------------------------------------------------- Header */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className={cn(container, "flex h-16 items-center justify-between")}>
          <Link href="/" aria-label="Riva home">
            <RivaWordmark />
          </Link>
          <nav className="hidden items-center gap-7 md:flex">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
              </a>
            ))}
          </nav>
          <CtaButton location="header" />
        </div>
      </header>

      <main>
        {/* ------------------------------------------------------------- Hero */}
        <section className="relative overflow-hidden ">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[560px] bg-[radial-gradient(60%_55%_at_50%_-5%,color-mix(in_oklch,var(--primary)_14%,transparent),transparent)]"
          />
          <div
            className={cn(
              container,
              "grid items-center gap-12 py-20 lg:grid-cols-[45fr_55fr] lg:py-28",
            )}
          >
            <div className="flex flex-col items-start gap-6 duration-700 fill-mode-both animate-in fade-in slide-in-from-bottom-3">
              <span className="font-mono text-xs tracking-[0.18em] text-primary uppercase">
                Personal and shared money, organized
              </span>
              <h1 className="font-heading text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
                Track where your money lives, moves, and belongs.
              </h1>
              <p className="max-w-xl text-base text-pretty text-muted-foreground sm:text-lg">
                Riva helps you manage everyday finances across spaces like
                Personal, Family, and Business. Track sources, record
                transactions, add labels, and keep shared money easier to
                understand.
              </p>
              <div className="flex flex-col items-start gap-4">
                <CtaButton location="hero" size="lg" />
                <p className="text-sm text-muted-foreground">
                  Built for web and mobile, with shared data that stays
                  consistent everywhere.
                </p>
              </div>
            </div>
            <div className="duration-700 delay-150 fill-mode-both animate-in fade-in slide-in-from-bottom-4">
              <DashboardPreview />
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------- Problem */}
        <section className="relative py-20 lg:py-28 bg-white/5">
          {/* ambient glow anchoring the section in the page */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-1/2 -z-10 h-[480px] -translate-y-1/2 bg-[radial-gradient(50%_50%_at_50%_50%,color-mix(in_oklch,var(--primary)_8%,transparent),transparent)]"
          />
          <div className={container}>
            <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-[linear-gradient(180deg,color-mix(in_oklch,var(--card)_70%,transparent),color-mix(in_oklch,var(--background)_85%,transparent))] px-6 py-16 shadow-[0_1px_0_0_rgba(255,255,255,0.06)_inset,0_40px_120px_-60px_rgba(0,0,0,0.9)] sm:px-12 lg:py-20">
              {/* grid texture, masked to fade at the edges */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_right,color-mix(in_oklch,var(--foreground)_4%,transparent)_1px,transparent_1px),linear-gradient(to_bottom,color-mix(in_oklch,var(--foreground)_4%,transparent)_1px,transparent_1px)] bg-[size:44px_44px] [mask-image:radial-gradient(75%_60%_at_50%_25%,black,transparent)]"
              />

              <div className="mx-auto max-w-2xl text-center">
                <p className="font-mono text-xs tracking-[0.2em] text-primary uppercase">
                  The problem
                </p>
                <h2 className="mt-4 font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                  Money gets messy when{" "}
                  <span className="text-primary">context is missing</span>.
                </h2>
                <p className="mt-5 text-base text-pretty text-muted-foreground">
                  A bank balance only tells part of the story. Cash, cards,
                  wallets, shared expenses, and family spending often live in
                  different places. Riva gives each part a clear home so you can
                  see what happened, where it happened, and who it belongs to.
                </p>
              </div>

              <div className="mt-14 grid gap-5 sm:grid-cols-3">
                {[
                  {
                    icon: SquareStackIcon,
                    index: "01",
                    title: "Spaces",
                    body: "Separate personal, family, and business money into spaces.",
                  },
                  {
                    icon: WalletIcon,
                    index: "02",
                    title: "Sources",
                    body: "Track bank accounts, wallets, cash, cards, and other sources.",
                  },
                  {
                    icon: TagIcon,
                    index: "03",
                    title: "Labels",
                    body: "Use labels to understand why money moved, not just that it moved.",
                  },
                ].map((card) => (
                  <div
                    key={card.title}
                    className="group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.05] to-white/[0.01] p-6 shadow-[0_1px_0_0_rgba(255,255,255,0.05)_inset] transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-[0_1px_0_0_rgba(255,255,255,0.08)_inset,0_24px_48px_-24px_color-mix(in_oklch,var(--primary)_45%,transparent)]"
                  >
                    {/* hover glow */}
                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-0 -z-10 opacity-0 transition-opacity duration-300 group-hover:opacity-100 bg-[radial-gradient(70%_50%_at_50%_0%,color-mix(in_oklch,var(--primary)_12%,transparent),transparent)]"
                    />
                    <span
                      aria-hidden
                      className="absolute top-5 right-6 font-mono text-sm text-muted-foreground/40 transition-colors duration-300 group-hover:text-primary/60"
                    >
                      {card.index}
                    </span>
                    <span className="inline-flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary/25 to-primary/5 text-primary ring-1 ring-primary/25 ring-inset shadow-[0_8px_24px_-8px_color-mix(in_oklch,var(--primary)_55%,transparent)] transition-transform duration-300 group-hover:scale-105">
                      <card.icon className="size-5" />
                    </span>
                    <h3 className="mt-5 font-heading text-lg font-semibold text-card-foreground">
                      {card.title}
                    </h3>
                    <p className="mt-1.5 text-sm text-pretty text-muted-foreground">
                      {card.body}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------- Core Concepts */}
        <section
          id="concepts"
          className="scroll-mt-20 border-t border-border/60 py-20 lg:py-28"
        >
          <div className={container}>
            <SectionEyebrow num="01">Core concepts</SectionEyebrow>
            <h2 className="mt-4 max-w-2xl font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              A simple structure for real-life money.
            </h2>
            <div className="mt-14 grid gap-5 lg:grid-cols-3">
              {[
                {
                  icon: SquareStackIcon,
                  title: "Spaces",
                  body: "Keep different financial contexts apart. Use spaces for Personal, Family, Business, trips, or anything else you want to track separately.",
                },
                {
                  icon: DatabaseIcon,
                  title: "Sources",
                  body: "Represent where money lives: bank accounts, cash, cards, UPI wallets, digital wallets, or investment accounts.",
                },
                {
                  icon: ArrowLeftRightIcon,
                  title: "Transactions",
                  body: "Record money moving in or out, connect it to a source and space, then label it for better understanding later.",
                },
              ].map((card) => (
                <div
                  key={card.title}
                  className="rounded-xl border border-border bg-card p-6"
                >
                  <IconBadge icon={card.icon} />
                  <h3 className="mt-4 font-heading text-lg font-medium">
                    {card.title}
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {card.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------- Shared Spaces */}
        <section
          id="shared"
          className="scroll-mt-20 border-t border-border/60 py-20 lg:py-28"
        >
          <div
            className={cn(container, "grid items-center gap-12 lg:grid-cols-2")}
          >
            <div>
              <SectionEyebrow num="02">Shared spaces</SectionEyebrow>
              <h2 className="mt-4 font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                Designed for money you manage with others.
              </h2>
              <p className="mt-5 text-base text-pretty text-muted-foreground">
                Invite people into a shared space when money is not just yours to
                track. Riva keeps the shared context separate from your personal
                one, so family or group finances stay easier to follow.
              </p>
              <ul className="mt-8 space-y-4">
                {[
                  "Create invite codes that expire after 24 hours.",
                  "Review join requests before someone enters a space.",
                  "Keep each user’s default space quick to access.",
                ].map((point) => (
                  <li key={point} className="flex items-start gap-3">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                    <span className="text-sm text-muted-foreground">
                      {point}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <InvitePreview />
          </div>
        </section>

        {/* ------------------------------------------------- Everyday Workflow */}
        <section
          id="workflow"
          className="scroll-mt-20 border-t border-border/60 py-20 lg:py-28"
        >
          <div className={container}>
            <SectionEyebrow num="03">Everyday workflow</SectionEyebrow>
            <h2 className="mt-4 max-w-2xl font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              From setup to daily tracking in a few steps.
            </h2>
            <ol className="mt-14 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  title: "Create your first space",
                  body: "Start with Personal, Family, Business, or any context that fits your life.",
                },
                {
                  title: "Add your money sources",
                  body: "Set up accounts, wallets, cash, cards, and source types.",
                },
                {
                  title: "Record transactions",
                  body: "Add debit or credit entries with labels so your history stays useful.",
                },
                {
                  title: "Review your dashboard",
                  body: "See summaries, recent activity, and patterns without rebuilding the picture from scratch.",
                },
              ].map((step, i) => (
                <li key={step.title} className="relative">
                  <span className="font-mono text-sm text-primary">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="mt-3 h-px w-full bg-border" />
                  <h3 className="mt-4 font-heading text-base font-medium">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {step.body}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ----------------------------------------------------- Web & Mobile */}
        <section
          id="web-mobile"
          className="scroll-mt-20 border-t border-border/60 py-20 lg:py-28"
        >
          <div
            className={cn(container, "grid items-center gap-12 lg:grid-cols-2")}
          >
            <div>
              <SectionEyebrow num="04">Web and mobile</SectionEyebrow>
              <h2 className="mt-4 font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                One finance system for web and mobile.
              </h2>
              <p className="mt-5 text-base text-pretty text-muted-foreground">
                Riva is being built as a shared product across web and mobile.
                The same spaces, sources, labels, and transactions will be
                available wherever you track money.
              </p>
              <ul className="mt-8 space-y-5">
                {[
                  {
                    icon: MonitorIcon,
                    text: "Web app for focused review and management.",
                  },
                  {
                    icon: SmartphoneIcon,
                    text: "Mobile app for quick checks and on-the-go entry.",
                  },
                  {
                    icon: RefreshCwIcon,
                    text: "Shared APIs keep both clients aligned.",
                  },
                ].map((item) => (
                  <li key={item.text} className="flex items-center gap-3">
                    <span className="inline-flex size-9 items-center justify-center rounded-lg bg-muted text-foreground/70">
                      <item.icon className="size-4.5" />
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {item.text}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex items-end justify-center gap-6">
              <DashboardPreview className="hidden flex-1 sm:block" />
              <MobilePreview className="shrink-0" />
            </div>
          </div>
        </section>

        {/* --------------------------------------------- Privacy & Reliability */}
        <section className="border-t border-border/60 bg-muted/30 py-20 lg:py-28">
          <div className={container}>
            <div className="max-w-2xl">
              <SectionEyebrow num="05">Privacy and reliability</SectionEyebrow>
              <h2 className="mt-4 font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                Built with careful defaults.
              </h2>
              <p className="mt-5 text-base text-pretty text-muted-foreground">
                Finance tools should be deliberate about data. Riva keeps durable
                records in Postgres, uses Redis only for faster access and
                short-lived operational data, and avoids sending sensitive
                financial details to analytics.
              </p>
            </div>
            <div className="mt-12 grid gap-8 sm:grid-cols-3">
              {[
                {
                  icon: ClockIcon,
                  text: "Invite codes are durable, expire after 24 hours, and are never stored only in cache.",
                },
                {
                  icon: EyeOffIcon,
                  text: "Analytics are privacy-conscious and avoid raw amounts, descriptions, source names, and invite codes.",
                },
                {
                  icon: RefreshCwIcon,
                  text: "Product data stays recoverable even if cache data is cleared.",
                },
              ].map((point) => (
                <div key={point.text} className="flex flex-col gap-3">
                  <span className="text-primary">
                    <point.icon className="size-5" />
                  </span>
                  <p className="text-sm text-muted-foreground">{point.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* --------------------------------------------------- Feature Preview */}
        <section className="border-t border-border/60 py-20 lg:py-28">
          <div className={container}>
            <SectionEyebrow num="06">Feature preview</SectionEyebrow>
            <h2 className="mt-4 max-w-2xl font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              What Riva will help you manage
            </h2>
            <ul className="mt-12 grid gap-x-10 gap-y-px sm:grid-cols-2">
              {[
                "Spaces for personal, family, and business contexts",
                "Sources for accounts, wallets, cash, cards, and more",
                "Transaction tracking with debit and credit entries",
                "Labels for needs, wants, savings, rent, food, utilities, and custom categories",
                "Shared spaces with invite requests",
                "Dashboard summaries and recent activity",
                "Web and mobile access",
                "Feature flags and analytics to improve carefully over time",
              ].map((feature) => (
                <li
                  key={feature}
                  className="flex items-start gap-3 border-b border-border/60 py-4"
                >
                  <ShieldCheckIcon className="mt-0.5 size-4.5 shrink-0 text-primary" />
                  <span className="text-sm text-foreground/90">{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ------------------------------------------------------- Final CTA */}
        <section className="border-t border-border/60 py-24 lg:py-32">
          <div className={cn(container, "flex flex-col items-center text-center")}>
            <h2 className="max-w-2xl font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              Start with one space. Build clarity from there.
            </h2>
            <p className="mt-5 max-w-xl text-base text-pretty text-muted-foreground">
              Set up your first space, add a source, and begin tracking money
              with the context it deserves.
            </p>
            <CtaButton location="final" size="lg" className="mt-8" />
          </div>
        </section>
      </main>

      {/* ---------------------------------------------------------------- Footer */}
      <footer className="border-t border-border/60 py-10">
        <div
          className={cn(
            container,
            "flex flex-col items-center justify-between gap-4 sm:flex-row",
          )}
        >
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <RivaMark className="size-5 text-primary" />
            <span>Riva — personal and shared money, organized.</span>
          </div>
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Riva
          </p>
        </div>
      </footer>
    </div>
  )
}

/** Abstract invite / join-request mockup for the shared spaces section. */
function InvitePreview() {
  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-xl shadow-black/20">
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs tracking-[0.18em] text-muted-foreground uppercase">
          Family
        </span>
        <span className="rounded-full bg-primary/10 px-2.5 py-1 font-mono text-xs text-primary">
          Shared space
        </span>
      </div>

      <div className="mt-5 rounded-lg bg-muted/50 p-4">
        <p className="text-xs text-muted-foreground">Invite code</p>
        <div className="mt-2 flex items-center justify-between gap-3">
          <span className="font-mono text-lg tracking-[0.3em] text-foreground">
            7K2P-9M4Q-L8RA
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <ClockIcon className="size-3.5" />
            Expires in 24h
          </span>
        </div>
      </div>

      <p className="mt-6 text-xs text-muted-foreground">Join requests</p>
      <div className="mt-3 space-y-3">
        {[true, false].map((pending, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-lg border border-border/60 p-3"
          >
            <span className="size-8 shrink-0 rounded-full bg-foreground/10" />
            <div className="flex-1 space-y-1.5">
              <div className="h-2 w-24 rounded-full bg-foreground/25" />
              <div className="h-1.5 w-16 rounded-full bg-foreground/10" />
            </div>
            {pending ? (
              <div className="flex gap-1.5">
                <span className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground">
                  Approve
                </span>
                <span className="rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground">
                  Deny
                </span>
              </div>
            ) : (
              <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                Approved
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
