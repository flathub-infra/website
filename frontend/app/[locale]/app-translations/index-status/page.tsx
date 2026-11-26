import IndexStatus from "./status"

export const metadata = {
  title: "Translation index status",
  robots: { index: false },
}

export default function Page() {
  return <IndexStatus />
}
