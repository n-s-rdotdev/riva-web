import { SpaceDetailClient } from "./space-detail-client"

export default async function SpaceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return <SpaceDetailClient spaceId={id} />
}
