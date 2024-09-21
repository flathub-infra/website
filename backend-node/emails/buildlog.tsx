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
  return <a href={buildLogUrl}>#{buildId}</a>
}
