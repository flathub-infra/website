import { NextIntlClientProvider } from "next-intl"
import { renderToStaticMarkup } from "react-dom/server"
import { expect, test } from "vitest"
import common from "../../../public/locales/en/common.json"
import PopulationSource from "./PopulationSource"

test("renders shared population attribution with caller layout and description ID", () => {
  const html = renderToStaticMarkup(
    <NextIntlClientProvider locale="en" messages={common} timeZone="UTC">
      <PopulationSource
        id="population-description"
        year={2024}
        revision="2024 (revision 1)"
        className="max-w-4xl text-foreground/80 [&_a:last-of-type]:whitespace-nowrap"
      />
    </NextIntlClientProvider>,
  )
  expect(html).toContain('id="population-description"')
  expect(html).toContain("<details")
  expect(html).not.toContain(" open")
  expect(html).toContain("Population data for 2024")
  expect(html).toContain("2024 midyear population")
  expect(html).toContain("World Population Prospects 2024 (revision 1)")
  expect(html).toContain('href="https://population.un.org/wpp/"')
  expect(html).toContain(
    'href="https://creativecommons.org/licenses/by/3.0/igo/"',
  )
  expect(html).toContain("max-w-4xl")
  expect(html).toContain("text-foreground/80")
  expect(html).not.toContain("text-muted-foreground")
})
