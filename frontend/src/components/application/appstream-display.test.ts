import { describe, expect, it } from "vitest"
import { sanitizeAppstreamDescription } from "@/lib/helpers"
import { formatDescription } from "./format-description"
import { appstreamUrl } from "./appstream-url"

describe("AppStream display", () => {
  it("keeps bold markers within one paragraph, including inline formatting", () => {
    const split = "<p>**first</p><p>second**</p>"
    expect(formatDescription(split)).toBe(split)
    expect(formatDescription("<p>**one <em>heading</em>**</p>")).toBe(
      "<p><b>one <em>heading</em></b></p>",
    )
  })

  it("preserves generated links without trusting supplied links", () => {
    const description =
      '<p><a href="https://other.example">notes</a> https://example.org and info@example.org</p>'
    const html = formatDescription(description)
    expect(html).not.toContain("other.example")
    expect(html).toContain('href="https://example.org"')
    expect(html).toContain('href="mailto:info@example.org"')
    expect(html).toContain('rel="noopener noreferrer"')
    expect(html).toContain('target="_blank"')
    expect(sanitizeAppstreamDescription(description)).toBe(
      "<p>notes https://example.org and info@example.org</p>",
    )
  })

  it("allows absolute web destinations and reserves mail links for contact", () => {
    expect(appstreamUrl("https://example.org/notes")).toBe(
      "https://example.org/notes",
    )
    expect(appstreamUrl("/notes")).toBeUndefined()
    expect(appstreamUrl("ftp://example.org")).toBeUndefined()
    const mail = "mailto:info@example.org"
    expect(appstreamUrl(mail)).toBeUndefined()
    expect(appstreamUrl(mail, true)).toBe(mail)
  })
})
