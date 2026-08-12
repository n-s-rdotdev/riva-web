"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  BadgeCheckIcon,
  BellIcon,
  ChevronsUpDownIcon,
  CreditCardIcon,
  LogOutIcon,
  SparklesIcon,
} from "lucide-react"

import { authClient } from "@/lib/auth-client"
import { analyticsEvents, resetAnalytics, trackEvent } from "@/lib/analytics/web"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"

function getFallbackLabel(name?: string | null, email?: string | null) {
  const label = name || email || "User"

  return label
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

export function NavUser() {
  const router = useRouter()
  const { isMobile } = useSidebar()
  const [imageLoadFailed, setImageLoadFailed] = useState(false)
  const { data: session, isPending } = authClient.useSession()

  if (isPending) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <div className="grid flex-1 gap-1 text-left text-sm leading-tight">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-4 w-4" />
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  const name = session?.user.name || "Guest"
  const email = session?.user.email || "Not signed in"
  const fallbackLabel = getFallbackLabel(name, email)
  const avatarSrc = !imageLoadFailed && session?.user.image ? session.user.image : null

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                className="data-[popup-open]:bg-sidebar-accent data-[popup-open]:text-sidebar-accent-foreground"
              />
            }
          >
            <Avatar className="h-8 w-8 rounded-lg">
              {avatarSrc ? (
                <AvatarImage
                  alt={name}
                  onError={() => setImageLoadFailed(true)}
                  referrerPolicy="no-referrer"
                  src={avatarSrc}
                />
              ) : null}
              <AvatarFallback className="rounded-lg">
                {fallbackLabel || "U"}
              </AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{name}</span>
              <span className="truncate text-xs text-sidebar-foreground/70">
                {email}
              </span>
            </div>
            <ChevronsUpDownIcon className="ml-auto size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                  <Avatar className="h-8 w-8 rounded-lg">
                    {avatarSrc ? (
                      <AvatarImage
                        alt={name}
                        onError={() => setImageLoadFailed(true)}
                        referrerPolicy="no-referrer"
                        src={avatarSrc}
                      />
                    ) : null}
                    <AvatarFallback className="rounded-lg">
                      {fallbackLabel || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{name}</span>
                    <span className="truncate text-xs">{email}</span>
                  </div>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => router.push("/billing")}>
                <SparklesIcon />
                Upgrade to Pro
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => router.push("/account")}>
                <BadgeCheckIcon />
                Account
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/billing")}>
                <CreditCardIcon />
                Billing
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/notifications")}>
                <BellIcon />
                Notifications
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            {session ? (
              <DropdownMenuItem
                onClick={async () => {
                  await authClient.signOut({
                    fetchOptions: {
                      onSuccess: () => {
                        trackEvent(analyticsEvents.signedOut, {
                          platform: "web",
                        })
                        resetAnalytics()
                        router.replace("/login")
                        router.refresh()
                      },
                    },
                  })
                }}
                variant="destructive"
              >
                <LogOutIcon />
                Log out
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={() => router.push("/login")}>
                <LogOutIcon />
                Log in
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
