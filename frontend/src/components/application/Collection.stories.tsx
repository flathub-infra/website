import { Meta } from "@storybook/nextjs-vite"
import Collection from "./Collection"
import { faker } from "@faker-js/faker"
import { BookmarkMinus } from "lucide-react"
import { Button } from "@/components/ui/button"

export default {
  title: "Components/Application/Collection",
  component: Collection,
  parameters: {
    nextjs: {
      appDirectory: true,
    },
  },
} as Meta<typeof Collection>

export const Generated = () => {
  const myApps = [...Array(faker.number.int({ min: 1, max: 12 }))].map(
    (item, index) => ({
      id: index,
      icon: "https://dl.flathub.org/media/tv/kodi/Kodi/4f8cbfae09dc6c8c55501a5d3f604fbb/icons/128x128/tv.kodi.Kodi.png",
      name: faker.commerce.product(),
      summary: faker.commerce.productDescription(),
    }),
  )

  return <Collection applications={myApps} title={"My apps"} />
}

export const WithEolApps = () => {
  const myApps = [...Array(6)].map((item, index) => ({
    id: `org.example.App${index}`,
    icon: "https://dl.flathub.org/media/tv/kodi/Kodi/4f8cbfae09dc6c8c55501a5d3f604fbb/icons/128x128/tv.kodi.Kodi.png",
    name: faker.commerce.product(),
    summary: faker.commerce.productDescription(),
    is_eol: index === 1 || index === 3,
  }))

  return (
    <Collection applications={myApps} title={"Apps with EOL"} showEolBadge />
  )
}

export const WithItemActions = () => {
  const myApps = [
    {
      id: "tv.kodi.Kodi",
      icon: "https://dl.flathub.org/media/tv/kodi/Kodi/4f8cbfae09dc6c8c55501a5d3f604fbb/icons/128x128/tv.kodi.Kodi.png",
      name: "Kodi",
      summary: "An available app with full AppStream metadata.",
    },
    {
      id: "org.example.Unavailable",
      name: "org.example.Unavailable",
    },
  ]

  return (
    <Collection
      applications={myApps}
      title="Bookmarks"
      variant="nested"
      renderItemAction={(app) => (
        <Button
          variant="ghost"
          size="icon"
          className="text-flathub-sonic-silver hover:bg-destructive/10 hover:text-destructive active:bg-destructive/15 active:text-destructive focus-visible:text-destructive dark:text-flathub-spanish-gray dark:hover:text-destructive"
          aria-label={`Remove ${app.name} from bookmarks`}
        >
          <BookmarkMinus className="size-4" />
        </Button>
      )}
    />
  )
}
