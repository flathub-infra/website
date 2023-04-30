import { TFunction } from "react-i18next"

export enum Category {
  AudioVideo = "AudioVideo",
  Development = "Development",
  Education = "Education",
  Game = "Game",
  Graphics = "Graphics",
  Network = "Network",
  Office = "Office",
  Science = "Science",
  System = "System",
  Utility = "Utility",
}

export function stringToCategory(category: string): Category | undefined {
  switch (category.toLowerCase()) {
    case "audiovideo":
      return Category.AudioVideo
    case "development":
      return Category.Development
    case "education":
      return Category.Education
    case "game":
      return Category.Game
    case "graphics":
      return Category.Graphics
    case "network":
      return Category.Network
    case "office":
      return Category.Office
    case "science":
      return Category.Science
    case "system":
      return Category.System
    case "utility":
      return Category.Utility
    default:
      return undefined
  }
}

export function categoryToName(
  category: Category,
  t: TFunction<"translation", undefined>,
): string {
  switch (category) {
    case Category.AudioVideo:
      return t("audio-and-video")
    case Category.Development:
      return t("developer-tools")
    case Category.Game:
      return t("games")
    case Category.Graphics:
      return t("graphics-and-photography")
    case Category.Network:
      return t("networking")
    case Category.Office:
      return t("productivity")
    case Category.Utility:
      return t("utilities")
    case Category.Science:
      return t("science")
    case Category.Education:
      return t("education")
    case Category.System:
      return t("system")
    default:
      assertUnreachable(category)
  }
}

function assertUnreachable(_x: never): never {
  throw new Error("Didn't expect to get here")
}
