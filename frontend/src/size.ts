function roundNumber(number: number, digits: number) {
  const multiple = Math.pow(10, digits)
  return Math.floor(number * multiple + 0.50000000000001) / multiple
}

export function calculateHumanReadableSize(size: number) {
  // (Maximum) number of digits to round to after floating point.
  const ROUND_DIGITS = 2

  // First letters of multiples of 2, more precisely of 2^10.
  const UNIT_LETTERS = ["B", "K", "M", "G", "T", "P", "E", "Z", "Y"]

  const i = "i" // From "binary".
  const POW10 = 1024 // 2 to the power of 10.

  if (size < POW10) {
    // Explicit whitespace for good measures.
    return `${size}` + " " + `${UNIT_LETTERS[0]}`
  }
  let pow10Count = 0 // Shows which multiple of 2^10 the `value` is (i.e., 2^10^0).
  let value = size
  while (value >= POW10 && pow10Count < UNIT_LETTERS.length - 1) {
    value /= POW10
    pow10Count++
  }
  return (
    `${roundNumber(value, ROUND_DIGITS)}` +
    " " +
    `${UNIT_LETTERS[pow10Count]}${i}${UNIT_LETTERS[0]}`
  )
}
