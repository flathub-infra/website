import { Inter } from "next/font/google"
// We want to use the normal link here
import Link from "next/link"

const inter = Inter({
  subsets: ["latin"],
  fallback: ["sans-serif"],
})

export async function generateMetadata() {
  return {
    title: "404 - Page Not Found",
    openGraph: {
      url: `${process.env.NEXT_PUBLIC_SITE_BASE_URI}/404`,
    },
    robots: {
      index: false,
      follow: false,
    },
  }
}

export default async function GlobalNotFound() {
  return (
    <html lang="en" className={inter.className}>
      <body>
        <div className="max-w-11/12 sm:w-max-1/2 mx-auto my-0 mt-12 w-11/12 sm:w-1/2 2xl:w-[900px] 2xl:max-w-[900px]">
          <h1 className="mb-8 text-4xl font-extrabold">404 - Page Not Found</h1>
          <p>The page you are looking for could not be found.</p>
          <p>
            <Link className="no-underline hover:underline" href="/">
              Go back to the home page
            </Link>
          </p>
        </div>
      </body>
    </html>
  )
}
