import { render, fireEvent, waitFor } from "@testing-library/react"
import ProviderLink from "../../../src/components/login/ProviderLink"
import { LoginProvider } from "src/types/Login"
import React from "react"
import { toast } from "react-toastify"
import { translationMock } from "../../../jest.setup"

type Props = {
  provider: LoginProvider
  inACard?: boolean
}

const githubProvider: LoginProvider = {
  method: "github",
  name: "GitHub",
}
const githubProps: Props = {
  inACard: true,
  provider: githubProvider,
}

const useStateSpy = jest.spyOn(React, "useState")
const setStateMock = jest.fn()
// @ts-ignore
useStateSpy.mockImplementation((init) => [init, setStateMock])
const useLocalStorageSpy = jest.spyOn(Storage.prototype, "setItem")

jest.mock("react-toastify", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}))

let location: Location
beforeEach(() => {
  location = window.location
  jest.spyOn(window, "location", "get").mockRestore()
  const mockedLocation = {
    ...location,
  }
  jest.spyOn(window, "location", "get").mockReturnValue(mockedLocation)
})

describe("ProviderLink tests", () => {
  it("redirect login with success", async () => {
    const expectedRedirectValue = "https://wiki.gnome.org"
    const expectedReturnToValue = '""'

    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ redirect: expectedRedirectValue }),
      }),
    ) as jest.Mock

    const { getByRole } = render(
      <ProviderLink
        provider={githubProps.provider}
        inACard={githubProps.inACard}
      />,
    )

    await waitFor(() => {
      fireEvent.click(getByRole("button"))
    })

    expect(translationMock.mock.calls[0]).toEqual([
      "login-with-provider",
      { provider: "GitHub" },
    ])
    expect(setStateMock).toHaveBeenCalledWith(true)
    expect(useLocalStorageSpy).toHaveBeenCalledWith(
      "returnTo",
      expectedReturnToValue,
    )
    expect(window.location.href).toEqual(expectedRedirectValue)
  })

  it("redirect login with api error", async () => {
    global.fetch = jest.fn(() => Promise.reject()) as jest.Mock
    const { getByRole } = render(
      <ProviderLink
        provider={githubProps.provider}
        inACard={githubProps.inACard}
      />,
    )

    await waitFor(() => {
      fireEvent.click(getByRole("button"))
    })

    expect(setStateMock.mock.calls).toEqual([[true], [false]])
    expect(translationMock).toHaveBeenCalledWith("network-error-try-again")
    expect(toast.error).toHaveBeenCalled()
  })

  it("redirect login with response error", async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        json: () => Promise.resolve({}),
      }),
    ) as jest.Mock

    const { getByRole } = render(
      <ProviderLink
        provider={githubProps.provider}
        inACard={githubProps.inACard}
      />,
    )

    await waitFor(() => {
      fireEvent.click(getByRole("button"))
    })
    expect(setStateMock.mock.calls).toEqual([[true], [false]])
    expect(toast.error).toHaveBeenCalled()
  })

  it("redirect login test if clicked is true not call api", async () => {
    global.fetch = jest.fn() as jest.Mock
    // @ts-ignore
    useStateSpy.mockImplementation(() => [true, setStateMock])
    const { getByRole } = render(
      <ProviderLink
        provider={githubProps.provider}
        inACard={githubProps.inACard}
      />,
    )

    await waitFor(() => {
      fireEvent.click(getByRole("button"))
      fireEvent.click(getByRole("button"))
      fireEvent.click(getByRole("button"))
    })
    expect(global.fetch).not.toHaveBeenCalled()
    expect(setStateMock).not.toHaveBeenCalled()
  })
})
