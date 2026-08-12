import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Riva — Track where your money lives, moves, and belongs",
  description:
    "Riva helps you manage everyday finances across spaces like Personal, Family, and Business. Track sources, record transactions, add labels, and keep shared money easier to understand.",
}

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <div className="flex flex-1 flex-col">{children}</div>
}
