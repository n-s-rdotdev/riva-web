import { ProtectedShell } from "@/components/protected-shell"

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <ProtectedShell>{children}</ProtectedShell>
}
