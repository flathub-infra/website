export function calculateHumanReadableSize(size: number) {
  // First letters of multiples of 2, more precisely of 2^10.
  const UNIT_CHARS = ["B", "K", "M", "G", "T", "P", "E", "Z", "Y"]
  const i = "i" // From "binary".
  const POW10 = 1024 // 2^10
  if (size < POW10) {
    return size.toString() + " " + UNIT_CHARS[0].toString()
  }
  // Shows which multiple of 2^10 the `size` is (i.e., 2^10^0).
  const pow10Count = Math.min(
    Math.floor(Math.log(size) / Math.log(POW10)),
    UNIT_CHARS.length - 1,
  )
  const value = size / Math.pow(POW10, pow10Count)
  return (
    // .toFixed() will round to fixed number of digits,
    // parseFloat() will convert strings like 1.00 to 1 and 1.10 to 1.1.
    parseFloat(value.toFixed(2)).toString() +
    " " +
    `${UNIT_CHARS[pow10Count]}${i}${UNIT_CHARS[0]}`
  )
}
