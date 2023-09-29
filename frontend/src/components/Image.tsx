import NextImage, { ImageProps } from "next/image"

// opt-out of image optimization, no-op
const customLoader = ({ src }) => {
  return src
}

export default function FlathubImage(props: ImageProps) {
  return <NextImage unoptimized {...props} loader={customLoader} />
}
