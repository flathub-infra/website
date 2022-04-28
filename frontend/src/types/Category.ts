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
    default:
      return category as string
  }
}
