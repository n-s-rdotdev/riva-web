"use client"

import * as React from "react"
import {
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
} from "lucide-react"

import { NavMain } from "@/components/navigation/nav-main"
import { NavUser } from "@/components/navigation/nav-user"
import { Kbd } from "@/components/ui/kbd"
import { Separator } from "@/components/ui/separator"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenuButton,
  useSidebar,
} from "@/components/ui/sidebar"
import { navigations } from "@/lib/site-config"

export function SiteSidebar({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  const { state, toggleSidebar } = useSidebar()
  const isCollapsed = state === "collapsed"

  return (
    <Sidebar
      className="top-(--header-height) h-[calc(100svh-var(--header-height))]!"
      collapsible="icon"
      {...props}
    >
      <SidebarHeader>
        <SidebarMenuButton
          className="hover:bg-input hover:text-sidebar-foreground"
          onClick={toggleSidebar}
          tooltip="Expand Menu (⌘ B)"
        >
          {isCollapsed ? <PanelLeftOpenIcon /> : <PanelLeftCloseIcon />}
          <span className="truncate group-data-[collapsible=icon]:hidden">
            Collapse Menu
          </span>
          <Kbd className="ml-auto group-data-[collapsible=icon]:hidden">
            ⌘ B
          </Kbd>
        </SidebarMenuButton>
      </SidebarHeader>
      <Separator />
      <SidebarContent>
        <NavMain items={navigations} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  )
}
