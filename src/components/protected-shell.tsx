import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { SiteHeader } from "@/components/navigation/site-header"
import { SiteSidebar } from "@/components/navigation/site-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { db } from "@/db"
import { userSchema } from "@/db/schema"
import { auth } from "@/lib/auth"
import { eq } from "drizzle-orm"

export async function ProtectedShell({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session?.user) {
    redirect("/login")
  }

  const [user] = await db
    .select({
      onboarded: userSchema.onboarded,
      accountStatus: userSchema.accountStatus,
    })
    .from(userSchema)
    .where(eq(userSchema.id, session.user.id))
    .limit(1)

  if (user?.accountStatus === "deactivated") {
    redirect("/deactivated")
  }

  if (!user?.onboarded) {
    redirect("/onboarding")
  }

  return (
    <div className="min-h-svh [--header-height:calc(--spacing(18))]">
      <SidebarProvider className="flex flex-col">
        <SiteHeader />
        <div className="flex flex-1">
          <SiteSidebar />
          <SidebarInset>
            <div className="flex flex-1 flex-col bg-muted/20 p-4 md:p-6">
              <div className="min-h-[calc(100svh-var(--header-height)-2rem)] rounded-lg border bg-background p-4 md:p-6">
                {children}
              </div>
            </div>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </div>
  )
}
