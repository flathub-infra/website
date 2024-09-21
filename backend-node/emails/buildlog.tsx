import { Link } from "@react-email/components"

export const BuildLog = ({
  buildLogUrl,
  buildId,
}: {
  buildLogUrl: string | null
  buildId: number
}) => {
  if (!buildLogUrl) {
    return `#${buildId}`
  }
  return <Link href={buildLogUrl}>#{buildId}</Link>
}
