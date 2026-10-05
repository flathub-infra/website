type ImageUrlOptions = {
  url: string
}

// Storybook only needs to show the source image; URL signing/transformation is
// covered by the production implementation and requires Node APIs.
export function generateImageUrl({ url }: ImageUrlOptions) {
  return url
}
