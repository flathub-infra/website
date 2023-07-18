import { render } from "@testing-library/react"
import Search from "pages/apps/search"

jest.mock("next/router", () => ({
  useRouter() {
    return {
      route: "/",
      pathname: "",
      query: "",
      asPath: "",
      push: jest.fn(),
      events: {
        on: jest.fn(),
        off: jest.fn(),
      },
      beforePopState: jest.fn(() => null),
      prefetch: jest.fn(() => null),
    }
  },
}))

const translationMock = jest.fn()
jest.mock("react-i18next", () => ({
  useTranslation: () => {
    return {
      t: translationMock,
      i18n: {
        changeLanguage: () => new Promise(() => {}),
        dir: jest.fn(),
      },
    }
  },
}))

global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: false,
    json: () => Promise.resolve({}),
  }),
) as jest.Mock

test("search result", async () => {
  // render(<Search />)
})
