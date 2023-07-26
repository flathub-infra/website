import { fireEvent, render, waitFor } from "@testing-library/react"
import Header from "../../../src/components/layout/Header"
import { UserState } from "../../../src/types/Login"
import { UserContext, UserDispatchContext } from "src/context/user-info"
import { translationMock } from "../../../jest.setup"

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
        "accepted-publisher-agreement-at": ""
      },
    }

    translationMock.mockImplementation((args) => {
      if (args === "user-avatar") {
        return `${userState.info.displayname}'s avatar`
      }
      return args
    })

    const expectedUrlValue = "https://wiki.gnome.org"
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ url: expectedUrlValue }),
      }),
    ) as jest.Mock

    const { getByText, container } = render(
      <>
        <UserContext.Provider value={userState}>
          <UserDispatchContext.Provider value={dispatchMock}>
            <Header />
          </UserDispatchContext.Provider>
        </UserContext.Provider>
      </>,
    )

    const userIconBeforeLogout = container.querySelector("img.rounded-full")
    expect(userIconBeforeLogout).toBeInTheDocument()
    expect(userIconBeforeLogout.alt).toContain(userState.info.displayname)

    jest.replaceProperty(userState, "info", null)

    await waitFor(() => {
      fireEvent.click(getByText("open-user-menu"))
      fireEvent.click(getByText("log-out"))
    })

    expect(userIconBeforeLogout).not.toBeInTheDocument()
    expect(getByText("login")).toBeInTheDocument()
    expect(dispatchMock).toHaveBeenCalledWith({ type: "loading" })
    expect(dispatchMock).toHaveBeenCalledWith({ type: "logout" })
  })
})
