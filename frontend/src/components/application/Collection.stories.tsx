import { Meta } from "@storybook/nextjs-vite"
import Collection from "./Collection"
import { faker } from "@faker-js/faker"
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
          size="sm"
          className="text-sm text-flathub-granite-gray transition-colors hover:bg-black/5 hover:text-flathub-dark-gunmetal active:bg-black/10 active:text-flathub-dark-gunmetal dark:text-flathub-gainsborow dark:hover:bg-white/5 dark:hover:text-flathub-gainsborow dark:active:bg-white/10 dark:active:text-flathub-gainsborow"
          aria-label={`Remove ${app.name} from bookmarks`}
        >
          Remove bookmark
        </Button>
      )}
    />
  )
}
