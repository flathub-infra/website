"use client"

import { useEffect } from "react"
import * as Sentry from "@sentry/nextjs"
import { Button } from "@/components/ui/button"
import "../styles/main.css"

interface Props {
  error: Error & { digest?: string }
  retry: () => void
}

// The root layout (including next-intl's provider) may have failed. Keep this
// last-resort boundary independent of translation and navigation context.
export default function GlobalError({ error, retry }: Props) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="en">
      <head>
        <title>Server error</title>
        <meta name="robots" content="noindex, nofollow" />
        <meta
          httpEquiv="Cache-Control"
          content="no-cache, no-store, must-revalidate"
        />
        <meta httpEquiv="Surrogate-Control" content="no-cache" />
      </head>
      <body>
        <main className="max-w-11/12 sm:w-max-1/2 mx-auto my-0 mt-12 w-11/12 sm:w-1/2 2xl:w-[900px] 2xl:max-w-[900px]">
          <h1 className="mb-8 text-4xl font-extrabold">
            Something went wrong!
          </h1>
          <p>An unexpected error occurred. Please try again.</p>
          <p>
            {/* A full navigation also rebuilds the failed root layout. The
                locale middleware resolves the home page without a provider. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a className="no-underline hover:underline" href="/">
              Go back to the home page
            </a>
          </p>
          <div className="mt-4">
            <Button onClick={retry}>Try again</Button>
          </div>
        </main>
      </body>
    </html>
  )
}
