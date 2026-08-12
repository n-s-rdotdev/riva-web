import {
  CalendarDaysIcon,
  DatabaseIcon,
  LayoutDashboardIcon,
  SquareStackIcon,
  WalletCardsIcon,
  type LucideIcon,
} from "lucide-react"

export type NavigationItem = {
  title: string
  href: string
  icon: LucideIcon
  keywords: string[]
}

export const navigations: NavigationItem[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboardIcon,
    keywords: ["dashboard", "overview"],
  },
  {
    title: "Transactions",
    href: "/transactions",
    icon: WalletCardsIcon,
    keywords: ["transactions", "transaction"],
  },
  {
    title: "Spaces",
    href: "/spaces",
    icon: SquareStackIcon,
    keywords: ["spaces", "space"],
  },
  {
    title: "Sources",
    href: "/sources",
    icon: DatabaseIcon,
    keywords: ["sources", "source"],
  },
  {
    title: "Calendar",
    href: "/calender",
    icon: CalendarDaysIcon,
    keywords: ["calendar", "calender", "schedule"],
  },
]
