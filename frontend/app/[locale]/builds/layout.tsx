import { ReactNode } from "react"

export default function BuildsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <footer className="mx-auto mt-10 w-11/12 text-center text-sm text-muted-foreground 2xl:w-[1400px]">
        Build infrastructure sponsored by{" "}
        <a href="https://aws.amazon.com" className="underline">
          AWS
        </a>{" "}
        and{" "}
        <a href="https://runs-on.com" className="underline">
          RunsOn
        </a>
        .
      </footer>
    </>
  )
}
