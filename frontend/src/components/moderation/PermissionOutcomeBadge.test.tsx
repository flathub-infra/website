import { renderToStaticMarkup } from "react-dom/server"
import { expect, test } from "vitest"
import PermissionOutcomeBadge from "./PermissionOutcomeBadge"

test.each(["accepted", "pending", "rejected", "error", "approved"])(
  "keeps %s readable without relying on color alone",
  (outcome) => {
    const html = renderToStaticMarkup(
      <PermissionOutcomeBadge outcome={outcome} />,
    )
    expect(html).toContain(`data-outcome="${outcome}"`)
    expect(html).toContain(`>${outcome}</span>`)
    expect(html).toContain('aria-hidden="true"')
  },
)
