import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { eq } from "drizzle-orm"

import { db } from "@/db"
import { userSchema } from "@/db/schema"
import { auth } from "@/lib/auth"
import { OnboardingForm } from "./onboarding-form"

export default async function OnboardingPage() {
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

  if (user?.onboarded) {
    redirect("/dashboard")
  }

  return (
    <main className="min-h-svh bg-background">
      <OnboardingForm />
    </main>
  )
}
