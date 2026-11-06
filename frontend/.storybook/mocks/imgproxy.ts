// Show source images directly instead of sending Storybook fixtures to the
// production image proxy, which cannot fetch all fixture URLs.
export function generateUnsignedImageUrl(url: string) {
  return url
}
