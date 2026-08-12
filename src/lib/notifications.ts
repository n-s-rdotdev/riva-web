import {
  BellIcon,
  CircleCheckIcon,
  CircleXIcon,
  SparklesIcon,
  UserPlusIcon,
  WalletCardsIcon,
  type LucideIcon,
} from "lucide-react"

type NotificationVisual = {
  Icon: LucideIcon
  accent: string
}

const visuals: Record<string, NotificationVisual> = {
  welcome: { Icon: SparklesIcon, accent: "text-primary" },
  space_join_requested: { Icon: UserPlusIcon, accent: "text-blue-500" },
  space_join_accepted: { Icon: CircleCheckIcon, accent: "text-emerald-500" },
  space_join_rejected: { Icon: CircleXIcon, accent: "text-muted-foreground" },
  transaction_milestone: { Icon: WalletCardsIcon, accent: "text-primary" },
}

export function notificationVisual(type: string): NotificationVisual {
  return visuals[type] ?? { Icon: BellIcon, accent: "text-muted-foreground" }
}

/** Compact relative time like "2h", "3d", or "just now". */
export function relativeTime(value: Date | string): string {
  const date = new Date(value)
  const seconds = Math.round((Date.now() - date.getTime()) / 1000)

  if (seconds < 45) return "just now"
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days}d`
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}
