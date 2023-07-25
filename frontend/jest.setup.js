import "@testing-library/jest-dom/extend-expect"

afterEach(() => {
  jest.clearAllMocks()
})

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

export { translationMock }
