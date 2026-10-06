// Arrow keys follow the reading direction: in RTL, ArrowLeft goes to the next slide.
export function getArrowKeyAction(
  key: string,
  direction?: "ltr" | "rtl",
): "prev" | "next" | null {
  if (key !== "ArrowLeft" && key !== "ArrowRight") {
    return null
  }
  return (key === "ArrowLeft") === (direction === "rtl") ? "next" : "prev"
}
