import sanitizeHtml from "sanitize-html"

export function sanitizeAppstreamDescription(str: string) {
  return sanitizeHtml(str, {
    allowedTags: ["p", "ul", "li", "ol", "em", "code"],
    allowedAttributes: {},
  })
}
