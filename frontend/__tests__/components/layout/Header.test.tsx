import { fireEvent, render, waitFor } from "@testing-library/react"
import Header from "../../../src/components/layout/Header"
import { UserState } from "../../../src/types/Login"
import { UserContext, UserDispatchContext } from "src/context/user-info"
import React from "react"
import { translationMock } from "../../../jest.setup"

beforeEach(() => {
  translationMock.mockImplementation((args) => args)
})

describe("Header tests", () => {
  it("User logs out successfully", async () => {
    const dispatchMock = jest.fn()
    const userState: UserState = {
      loading: false,
      info: {
        auths: {
          github: {
            avatar: "https://avatars.githubusercontent.com/u/27268838?s=200&v=4",
            login: "devflat",
          },
          gitlab: undefined,
          gnome: undefined,
          kde: undefined,
        },
        "is-moderator": false,
        "dev-flatpaks": [],
        "owned-flatpaks": [],
        displayname: "dev-flatpak",
      },
    }
    const expectedUrlValue = "https://wiki.gnome.org"
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ url: expectedUrlValue }),
      }),
    ) as jest.Mock

    const { getByText } = render(
      <>
        <UserContext.Provider value={userState}>
          <UserDispatchContext.Provider value={dispatchMock}>
            <Header />
          </UserDispatchContext.Provider>
        </UserContext.Provider>
      </>,
    )

    await waitFor(() => {
      fireEvent.click(getByText("open-user-menu"))
      fireEvent.click(getByText("log-out"))
    })

    expect(dispatchMock).toHaveBeenCalledWith({ type: "loading" })
    expect(dispatchMock).toHaveBeenCalledWith({ type: "logout" })
  })
})
