"use client"

import { useId } from "react"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export default function PermissionStatsSelect({
  label,
  ariaLabel = label,
  value,
  onValueChange,
  options,
  disabled,
  hideLabel = false,
}: {
  label: string
  ariaLabel?: string
  value: string
  onValueChange: (value: string) => void
  options: { value: string; label: string }[]
  disabled?: boolean
  hideLabel?: boolean
}) {
  const id = useId()
  return (
    <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">
      <label
        htmlFor={id}
        className={hideLabel ? "sr-only" : "text-sm text-muted-foreground"}
      >
        {label}
      </label>
      <Select value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger
          id={id}
          aria-label={ariaLabel}
          className="min-w-0 max-w-full"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  )
}
