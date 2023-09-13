import { sanitize } from "isomorphic-dompurify"

export const ConditionalWrapper = ({ condition, wrapper, children }) =>
  condition ? wrapper(children) : children

export const sanitizeAppstreamDescription = (str: string) => {
  return sanitize(str, {
    ALLOWED_TAGS: ["p", "ul", "li", "ol", "em", "code"],
    ALLOWED_ATTR: [],
  })
}
