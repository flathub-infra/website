"use client"

import * as React from "react"
import { Tooltip as TooltipPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

const TooltipTouchContext = React.createContext<(() => void) | null>(null)

function TooltipProvider({
  delayDuration = 0,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      {...props}
    />
  )
}

function Tooltip({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  const [radixOpen, setRadixOpen] = React.useState(
    controlledOpen ?? defaultOpen,
  )
  const [touchOpen, setTouchOpen] = React.useState(false)
  const touchOpenRef = React.useRef(false)
  const touchTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  )
  const isControlled = controlledOpen !== undefined

  const clearTouchTimeout = React.useCallback(() => {
    if (touchTimeoutRef.current) {
      clearTimeout(touchTimeoutRef.current)
      touchTimeoutRef.current = null
    }
  }, [])

  const toggleTouchOpen = React.useCallback(() => {
    clearTouchTimeout()
    if (touchOpenRef.current) {
      touchOpenRef.current = false
      setTouchOpen(false)
      if (isControlled) onOpenChange?.(false)
      else setRadixOpen(false)
      return
    }

    touchOpenRef.current = true
    setTouchOpen(true)
    if (isControlled) onOpenChange?.(true)
    touchTimeoutRef.current = setTimeout(() => {
      touchOpenRef.current = false
      setTouchOpen(false)
      if (isControlled) onOpenChange?.(false)
      else setRadixOpen(false)
      touchTimeoutRef.current = null
    }, 4000)
  }, [clearTouchTimeout, isControlled, onOpenChange])

  React.useEffect(() => clearTouchTimeout, [clearTouchTimeout])

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && touchOpenRef.current) return
    if (!isControlled) setRadixOpen(nextOpen)
    onOpenChange?.(nextOpen)
  }

  return (
    <TooltipProvider>
      <TooltipTouchContext.Provider value={toggleTouchOpen}>
        <TooltipPrimitive.Root
          data-slot="tooltip"
          {...props}
          open={isControlled ? controlledOpen : radixOpen || touchOpen}
          onOpenChange={handleOpenChange}
        />
      </TooltipTouchContext.Provider>
    </TooltipProvider>
  )
}

type TooltipTriggerProps = React.ComponentProps<
  typeof TooltipPrimitive.Trigger
> & {
  keepOpenOnTouch?: boolean
}

function TooltipTrigger({
  keepOpenOnTouch = true,
  onClick,
  ...props
}: TooltipTriggerProps) {
  const toggleTouchOpen = React.useContext(TooltipTouchContext)

  return (
    <TooltipPrimitive.Trigger
      data-slot="tooltip-trigger"
      {...props}
      onClick={(event) => {
        onClick?.(event)
        if (
          keepOpenOnTouch &&
          (event.nativeEvent as PointerEvent).pointerType === "touch"
        ) {
          toggleTouchOpen?.()
        }
      }}
    />
  )
}

function TooltipContent({
  className,
  sideOffset = 0,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(
          "z-50 overflow-hidden rounded-xl p-3 text-xs animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-end-2 data-[side=right]:slide-in-from-start-2 data-[side=top]:slide-in-from-bottom-2",
          "drop-shadow-sm",
          "bg-flathub-white dark:bg-flathub-granite-gray dark:text-flathub-gainsborow text-flathub-arsenic",
          "font-semibold",
          className,
        )}
        {...props}
      >
        {children as React.ReactNode}
        <TooltipPrimitive.Arrow className="bg-flathub-white dark:bg-flathub-granite-gray fill-flathub-white dark:fill-flathub-granite-gray z-50 size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px]" />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  )
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
