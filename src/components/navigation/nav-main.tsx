"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import type { NavigationItem } from "@/lib/site-config"
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export function NavMain({ items }: { items: NavigationItem[] }) {
  const pathname = usePathname()

  return (
    <SidebarGroup>
      <SidebarMenu className="gap-2">
        {items.map((item) => {
          const isActive = pathname === item.href

          return (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                aria-current={isActive ? "page" : undefined}
                className="py-6"
                isActive={isActive}
                tooltip={item.title}
                render={<Link href={item.href} prefetch />}
              >
                <item.icon className="size-5" />
                <span>{item.title}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )
        })}
      </SidebarMenu>
    </SidebarGroup>
  )
}
