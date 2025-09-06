"use client"

import { useEffect } from "react"
import * as Sentry from "@sentry/nextjs"
import Error from "next/error"

interface Props {
  error: Error & { digest?: string }
  reset: () => void
}

export default function GlobalError({ error, reset }: Props) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html>
      <body>
        <div className="max-w-11/12 sm:w-max-1/2 mx-auto my-0 mt-12 w-11/12 sm:w-1/2 2xl:w-[900px] 2xl:max-w-[900px]">
          <h1 className="mb-8 text-4xl font-extrabold">
            Something went wrong!
          </h1>
          <p>An unexpected error occurred. Please try again.</p>
          <div className="mt-4">
            <button
              className="rounded bg-flathub-celestial-blue px-4 py-2 text-white hover:bg-flathub-celestial-blue-dark"
              onClick={reset}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
