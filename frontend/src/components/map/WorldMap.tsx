import React, { createRef, useMemo, useRef, useState } from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"
import { TooltipContent, TooltipProvider } from "@/components/ui/tooltip"
import geoData from "./countries.geo"

export type ISOCode = string

export type SizeOption = "sm" | "md" | "lg" | "xl" | "xxl"

export interface DataItem<T extends string | number = number> {
  country: string
  value: T
}

export interface CountryContext<T extends string | number = number> {
  countryCode: ISOCode
  countryName: string
  countryValue?: T | undefined
  color: string
  minValue: number
  maxValue: number
  prefix: string
  suffix: string
}

export interface WorldMapProps<T extends string | number = number> {
  data: DataItem<T>[]
  color?: string
  backgroundColor?: string
  borderColor?: string
  size?: SizeOption | "responsive" | number
  rtl?: boolean
  strokeOpacity?: number
  valuePrefix?: string
  valueSuffix?: string
  tooltipTextFunction?: (context: CountryContext<T>) => string
  onClickFunction?: (
    context: CountryContext<T> & { event: React.MouseEvent<SVGPathElement> },
  ) => void
}

const defaultColor = "#dddddd"
const heightRatio = 3 / 4
const sizeMap: Record<SizeOption, number> = {
  sm: 240,
  md: 336,
  lg: 480,
  xl: 640,
  xxl: 1200,
}

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect

const useWindowWidth = () => {
  const [width, setWidth] = useState(sizeMap.xl)

  useIsomorphicLayoutEffect(() => {
    const updateWidth = () => {
      setWidth(window.innerWidth)
    }

    window.addEventListener("resize", updateWidth)
    updateWidth()

    return () => window.removeEventListener("resize", updateWidth)
  }, [])

  return width
}

const responsify = (
  sizeOption: SizeOption | "responsive",
  windowWidth: number,
): number => {
  if (sizeOption === "responsive") {
    if (typeof window === "undefined") {
      return sizeMap.xl
    }
    return Math.min(window.innerHeight, window.innerWidth) * 0.75
  }

  if (typeof window === "undefined") {
    return sizeMap[sizeOption]
  }

  const fittingSize =
    Object.values(sizeMap)
      .reverse()
      .find((size) => size <= windowWidth) ?? sizeMap.sm

  return Math.min(fittingSize, sizeMap[sizeOption])
}

const toNumberValue = (
  value: string | number | undefined,
): number | undefined => (typeof value === "string" ? undefined : value)

const getOpacity = (
  value: number | undefined,
  minValue: number,
  maxValue: number,
) => {
  if (value === undefined) {
    return 0
  }
  if (maxValue === minValue) {
    return 0.8
  }
  const opacity = 0.2 + 0.6 * ((value - minValue) / (maxValue - minValue))
  return Number.isNaN(opacity) ? 0.8 : opacity
}

type Projector = (lon: number, lat: number) => readonly [number, number]

const maxLat = 85.05112878

const projectRaw = (lon: number, lat: number, width: number) => {
  const x = ((lon + 180) * width) / 360
  const clampedLat = Math.max(Math.min(lat, maxLat), -maxLat)
  const latRad = (clampedLat * Math.PI) / 180
  const mercN = Math.log(Math.tan(Math.PI / 4 + latRad / 2))
  const y = width / 2 - (width / (2 * Math.PI)) * mercN
  return [x, y] as const
}

const createProjector = (
  width: number,
  height: number,
  coordinates: CoordinateArray[],
): Projector => {
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity

  for (const feature of coordinates) {
    for (const polygon of feature) {
      for (const ring of polygon) {
        for (const [lon, lat] of ring) {
          const [x, y] = projectRaw(lon, lat, width)
          if (x < minX) minX = x
          if (x > maxX) maxX = x
          if (y < minY) minY = y
          if (y > maxY) maxY = y
        }
      }
    }
  }

  const xRange = maxX - minX
  const yRange = maxY - minY
  const scale = Math.min(width / xRange, height / yRange)
  const offsetX = (width - xRange * scale) / 2 - minX * scale
  const offsetY = (height - yRange * scale) / 2 - minY * scale

  return (lon: number, lat: number) => {
    const [x, y] = projectRaw(lon, lat, width)
    return [x * scale + offsetX, y * scale + offsetY] as const
  }
}

type CoordinateArray = readonly (readonly (readonly (readonly number[])[])[])[]

const buildPath = (coordinates: CoordinateArray, project: Projector) => {
  let path = ""

  for (const polygon of coordinates) {
    for (const ring of polygon) {
      ring.forEach(([lon, lat], index) => {
        const [x, y] = project(lon, lat)
        path += `${index === 0 ? "M" : "L"}${x.toFixed(3)} ${y.toFixed(3)}`
      })
      path += "Z"
    }
  }

  return path
}

const defaultTooltip = <T extends string | number>(
  context: CountryContext<T>,
) => {
  const { countryName, countryValue, prefix, suffix } = context
  if (countryValue === undefined) {
    return countryName
  }
  return `${countryName} ${prefix} ${countryValue.toLocaleString()} ${suffix}`
}

const WorldMap = <T extends string | number = number>({
  data,
  color = defaultColor,
  backgroundColor = "white",
  borderColor = "black",
  size = "xl",
  rtl = false,
  strokeOpacity = 0.2,
  valuePrefix = "",
  valueSuffix = "",
  tooltipTextFunction = defaultTooltip<T>,
  onClickFunction,
}: WorldMapProps<T>) => {
  const windowWidth = useWindowWidth()
  const width = typeof size === "number" ? size : responsify(size, windowWidth)
  const height = width * heightRatio
  const containerRef = createRef<SVGSVGElement>()
  const [tooltipOpen, setTooltipOpen] = useState(false)
  const [tooltipText, setTooltipText] = useState("")
  const [cursorPosition, setCursorPosition] = useState({ x: 0, y: 0 })
  const [hoveredKey, setHoveredKey] = useState<string | null>(null)
  const rafRef = useRef<number | null>(null)
  const pendingPositionRef = useRef({ x: 0, y: 0 })

  const countryValueMap = useMemo(() => {
    return Object.fromEntries(
      data.map(({ country, value }) => [country.toUpperCase(), value]),
    )
  }, [data])

  const numericValues = data
    .map(({ value }) => toNumberValue(value))
    .filter((value): value is number => value !== undefined)

  const minValue = numericValues.length ? Math.min(...numericValues) : 0
  const maxValue = numericValues.length ? Math.max(...numericValues) : 0

  const regions = useMemo(() => {
    const projector = createProjector(
      width,
      height,
      geoData.features.map((feature) => feature.C),
    )
    return geoData.features.map((feature) => {
      const triggerRef = createRef<SVGPathElement>()
      const { I: isoCode, N: countryName, C: coordinates } = feature

      const countryValue = countryValueMap[isoCode]

      const context: CountryContext<T> = {
        countryCode: isoCode,
        countryName,
        countryValue,
        color,
        minValue,
        maxValue,
        prefix: valuePrefix,
        suffix: valueSuffix,
      }

      const opacity = getOpacity(
        toNumberValue(countryValue as unknown as number | string | undefined),
        minValue,
        maxValue,
      )

      const path = buildPath(coordinates, projector)
      const tooltip =
        typeof countryValue === "undefined"
          ? countryName
          : tooltipTextFunction(context)

      const handleClick = (event: React.MouseEvent<SVGPathElement>) => {
        onClickFunction?.({ ...context, event })
      }

      return {
        key: countryName,
        path,
        tooltip,
        onClick: handleClick,
        ref: triggerRef,
        style: {
          fill: color,
          fillOpacity: opacity,
          stroke: borderColor,
          strokeWidth: 1,
          strokeOpacity,
          cursor: onClickFunction ? "pointer" : "default",
        } as React.CSSProperties,
      }
    })
  }, [
    borderColor,
    color,
    countryValueMap,
    maxValue,
    minValue,
    onClickFunction,
    strokeOpacity,
    tooltipTextFunction,
    valuePrefix,
    valueSuffix,
    width,
    height,
  ])

  const rtlTransform = rtl ? `translate(${width}, 0) scale(-1, 1)` : undefined

  return (
    <figure
      className="worldmap__figure-container"
      style={{ backgroundColor, position: "relative" }}
    >
      <TooltipProvider>
        <TooltipPrimitive.Root open={tooltipOpen}>
          <TooltipPrimitive.Trigger asChild>
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                left: cursorPosition.x,
                top: cursorPosition.y,
                width: 1,
                height: 1,
                pointerEvents: "none",
              }}
            />
          </TooltipPrimitive.Trigger>
          <TooltipContent sideOffset={8} align="center">
            {tooltipText}
          </TooltipContent>
        </TooltipPrimitive.Root>
        <svg
          ref={containerRef}
          height={`${height}px`}
          width={`${width}px`}
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="World map"
          onPointerLeave={() => setTooltipOpen(false)}
          onPointerMove={(event) => {
            const rect = event.currentTarget.getBoundingClientRect()
            pendingPositionRef.current = {
              x: event.clientX - rect.left,
              y: event.clientY - rect.top,
            }

            if (rafRef.current === null) {
              rafRef.current = requestAnimationFrame(() => {
                rafRef.current = null
                setCursorPosition(pendingPositionRef.current)
              })
            }

            const target = event.target as SVGPathElement | null
            const nextTooltip = target?.dataset.tooltip ?? ""
            const nextKey = target?.dataset.key ?? null
            if (nextKey !== hoveredKey) {
              setHoveredKey(nextKey)
            }
            if (nextTooltip) {
              if (nextTooltip !== tooltipText) {
                setTooltipText(nextTooltip)
              }
              if (!tooltipOpen) setTooltipOpen(true)
            } else if (tooltipOpen) {
              setTooltipOpen(false)
            }
          }}
        >
          <g transform={rtlTransform}>
            {regions.map((region) => {
              const baseStrokeWidth =
                typeof region.style.strokeWidth === "number"
                  ? region.style.strokeWidth
                  : 1
              return (
                <path
                  key={region.key}
                  d={region.path}
                  style={{
                    ...region.style,
                    strokeWidth:
                      hoveredKey === region.key
                        ? baseStrokeWidth + 1
                        : baseStrokeWidth,
                  }}
                  onClick={region.onClick}
                  aria-label={region.tooltip}
                  pointerEvents="all"
                  data-tooltip={region.tooltip}
                  data-key={region.key}
                />
              )
            })}
          </g>
        </svg>
      </TooltipProvider>
    </figure>
  )
}

export default WorldMap
