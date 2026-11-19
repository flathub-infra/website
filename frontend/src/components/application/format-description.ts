import { sanitize } from "isomorphic-dompurify"
import linkifyHtml from "linkify-html"
import {
  appstreamDescriptionTags,
  sanitizeAppstreamDescription,
} from "@/lib/helpers"

export function formatDescription(value: string) {
  const paragraphs = sanitizeAppstreamDescription(value).replace(
    /<p>\s*\*\*((?:(?!<\/p>)[\s\S])*?)\*\*\s*<\/p>/gi,
    "<p><b>$1</b></p>",
  )
  const linked = linkifyHtml(paragraphs, {
    rel: "noopener noreferrer",
    target: "_blank",
    validate: { url: (url) => /^https:\/\//.test(url) },
  })
  return sanitize(linked, {
    ALLOWED_TAGS: [...appstreamDescriptionTags, "b", "a"],
    ALLOWED_ATTR: ["href", "target", "rel"],
    ADD_URI_SAFE_ATTR: ["target", "rel"],
    ALLOWED_URI_REGEXP: /^(?:https:\/\/|mailto:)/i,
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false,
  })
}
