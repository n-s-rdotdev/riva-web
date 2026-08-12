import { SourceDetailClient } from "./source-detail-client"

export default async function SourceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return <SourceDetailClient sourceId={id} />
}
