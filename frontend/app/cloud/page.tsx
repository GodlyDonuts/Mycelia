import type { Metadata } from "next"
import { AppShell } from "@/components/dashboard/app-shell"
import { CloudConsole } from "@/components/cloud/cloud-console"

export const metadata: Metadata = {
  title: "Cloud — Mycelia",
  description: "The AWS-integration console: which managed database the app is bound to, the live IAM-token / TLS / keep-alive / 40001-retry telemetry, and the request-flow architecture.",
}

export default function CloudPage() {
  return (
    <AppShell active="Cloud" title="Cloud Integration" subtitle="aws · data layer">
      <CloudConsole />
    </AppShell>
  )
}
