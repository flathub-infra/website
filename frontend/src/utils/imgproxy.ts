import { generateUrl, type Options } from "@imgproxy/imgproxy-js-core"

// Browser image URLs are unsigned. Keep the Node builder (and its crypto
// dependencies) out of this shared server/client path.
export function generateUnsignedImageUrl(url: string, options?: Options) {
  const bytes = new TextEncoder().encode(url)
  const encodedUrl = btoa(
    Array.from(bytes, (byte) => String.fromCharCode(byte)).join(""),
  )
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")

  return `https://imgproxy.flathub.org/insecure${generateUrl(
    { value: encodedUrl, type: "base64" },
    options,
  )}`
}
