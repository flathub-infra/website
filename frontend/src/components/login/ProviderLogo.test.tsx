import { expect, test } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { ConnectedAccountProvider } from "src/codegen"
import { ProviderLogo } from "./ProviderLogo"

test("renders a logo for email accounts", () => {
  expect(() =>
    renderToStaticMarkup(
      <ProviderLogo provider={ConnectedAccountProvider.email} />,
    ),
  ).not.toThrow()
})
