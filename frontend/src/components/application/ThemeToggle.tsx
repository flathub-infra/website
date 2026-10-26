"use client"

import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { Check, Moon, Sun } from "lucide-react"
import { ButtonGroup } from "@/components/ui/button-group"
import { Button } from "@/components/ui/button"

const ThemeToggle = () => {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const activeTheme = resolvedTheme === "dark" ? "dark" : "light"
  const lightIsActive = mounted && activeTheme === "light"
  const darkIsActive = mounted && activeTheme === "dark"

  const changeTheme = (theme: "light" | "dark") => {
    setTheme(theme)
    // Keep this app-detail override for the current page session only.
    window.localStorage.removeItem("theme")
  }

  return (
    <ButtonGroup aria-label="Color theme">
      <Button
        aria-pressed={lightIsActive}
        size="sm"
        type="button"
        variant={lightIsActive ? "selected" : "outline"}
        onClick={() => changeTheme("light")}
      >
        <Sun aria-hidden="true" className="size-4" />
        Light
        {lightIsActive && <Check aria-hidden="true" className="size-4" />}
      </Button>
      <Button
        aria-pressed={darkIsActive}
        size="sm"
        type="button"
        variant={darkIsActive ? "selected" : "outline"}
        onClick={() => changeTheme("dark")}
      >
        <Moon aria-hidden="true" className="size-4" />
        Dark
        {darkIsActive && <Check aria-hidden="true" className="size-4" />}
      </Button>
    </ButtonGroup>
  )
}

export default ThemeToggle
