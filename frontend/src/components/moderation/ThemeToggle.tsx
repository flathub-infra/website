"use client"

import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { Moon, Sun } from "lucide-react"

const ThemeToggle = () => {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const activeTheme = resolvedTheme === "dark" ? "dark" : "light"

  const changeTheme = (theme: "light" | "dark") => {
    setTheme(theme)
    // Keep this moderation-panel override for the current page session only.
    window.localStorage.removeItem("theme")
  }

  return (
    <div
      aria-label="Color theme"
      className="inline-flex items-center rounded-lg border border-flathub-gainsborow p-1 dark:border-flathub-dark-gunmetal"
      role="group"
    >
      <button
        aria-pressed={mounted && activeTheme === "light"}
        className="inline-flex min-h-8 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium transition-colors hover:bg-flathub-gainsborow/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flathub-celestial-blue aria-pressed:bg-flathub-gainsborow dark:hover:bg-flathub-dark-gunmetal dark:aria-pressed:bg-flathub-dark-gunmetal"
        onClick={() => changeTheme("light")}
        type="button"
      >
        <Sun aria-hidden="true" className="h-4 w-4" />
        Light
      </button>
      <button
        aria-pressed={mounted && activeTheme === "dark"}
        className="inline-flex min-h-8 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium transition-colors hover:bg-flathub-gainsborow/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flathub-celestial-blue aria-pressed:bg-flathub-gainsborow dark:hover:bg-flathub-dark-gunmetal dark:aria-pressed:bg-flathub-dark-gunmetal"
        onClick={() => changeTheme("dark")}
        type="button"
      >
        <Moon aria-hidden="true" className="h-4 w-4" />
        Dark
      </button>
    </div>
  )
}

export default ThemeToggle
