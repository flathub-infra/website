import { TFunction } from "i18next"

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

export enum GameCategory {
  ActionGame = "ActionGame",
  AdventureGame = "AdventureGame",
  ArcadeGame = "ArcadeGame",
  BlocksGame = "BlocksGame",
  BoardGame = "BoardGame",
  CardGame = "CardGame",
  Emulator = "Emulator",
  KidsGame = "KidsGame",
  LogicGame = "LogicGame",
  RolePlaying = "RolePlaying",
  Shooter = "Shooter",
  Simulation = "Simulation",
  SportsGame = "SportsGame",
  StrategyGame = "StrategyGame",
}

export function gameCategoryToName(
  category: GameCategory,
  t: TFunction<"translation", undefined>,
): string {
  switch (category) {
    case GameCategory.ActionGame:
      return t("action")
    case GameCategory.AdventureGame:
      return t("adventure")
    case GameCategory.ArcadeGame:
      return t("arcade")
    case GameCategory.BlocksGame:
      return t("blocks")
    case GameCategory.BoardGame:
      return t("board")
    case GameCategory.CardGame:
      return t("card")
    case GameCategory.Emulator:
      return t("emulators")
    case GameCategory.KidsGame:
      return t("kids")
    case GameCategory.LogicGame:
      return t("logic")
    case GameCategory.RolePlaying:
      return t("role-playing")
    case GameCategory.Shooter:
      return t("shooter")
    case GameCategory.Simulation:
      return t("simulation")
    case GameCategory.SportsGame:
      return t("sports")
    case GameCategory.StrategyGame:
      return t("strategy")
    default:
      assertUnreachable(category)
  }
}

export enum AudioVideoCategory {
  AudioVideoEditing = "AudioVideoEditing",
  // Database = "Database", //no apps in this category yet
  // DiscBurning = "DiscBurning", //only one app
  Midi = "Midi",
  Mixer = "Mixer",
  Music = "Music",
  Player = "Player",
  Recorder = "Recorder",
  Sequencer = "Sequencer",
  Tuner = "Tuner",
  TV = "TV",
}

export function audioVideoCategoryToName(
  category: AudioVideoCategory,
  t: TFunction<"translation", undefined>,
): string {
  switch (category) {
    // case AudioVideoCategory.Database:
    //   return t("database")
    case AudioVideoCategory.Midi:
      return t("midi")
    case AudioVideoCategory.Mixer:
      return t("mixer")
    case AudioVideoCategory.Sequencer:
      return t("sequencer")
    case AudioVideoCategory.Tuner:
      return t("tuner")
    case AudioVideoCategory.TV:
      return t("tv")
    case AudioVideoCategory.AudioVideoEditing:
      return t("audio-video-editing")
    case AudioVideoCategory.Player:
      return t("player")
    case AudioVideoCategory.Recorder:
      return t("recorder")
    // case AudioVideoCategory.DiscBurning:
    //   return t("disc-burning")
    case AudioVideoCategory.Music:
      return t("music")
    default:
      assertUnreachable(category)
  }
}

export function subcategoryToName(
  category: Category,
  subcategory: string,
  t: TFunction<"translation", undefined>,
): string {
  switch (category) {
    case Category.Game:
      return gameCategoryToName(subcategory as GameCategory, t)
    case Category.AudioVideo:
      return audioVideoCategoryToName(subcategory as AudioVideoCategory, t)
    default:
      return subcategory
  }
}

function assertUnreachable(_x: never): never {
  throw new Error("Didn't expect to get here")
}

export function getSubcategory(category: Category): string[] {
  switch (category) {
    case Category.Game:
      return Object.keys(GameCategory)
    case Category.AudioVideo:
      return Object.keys(AudioVideoCategory)
  }
}
