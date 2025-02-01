import { TFunction } from "i18next"
import { MainCategory } from "src/codegen"

export function stringToCategory(category: string): MainCategory | undefined {
  switch (category.toLowerCase()) {
    case "audiovideo":
      return MainCategory.audiovideo
    case "development":
      return MainCategory.development
    case "education":
      return MainCategory.education
    case "game":
      return MainCategory.game
    case "graphics":
      return MainCategory.graphics
    case "network":
      return MainCategory.network
    case "office":
      return MainCategory.office
    case "science":
      return MainCategory.science
    case "system":
      return MainCategory.system
    case "utility":
      return MainCategory.utility
    default:
      return undefined
  }
}

export function tryParseCategory(
  category: string,
  t: TFunction<"translation", undefined>,
): string | undefined {
  try {
    return categoryToName(stringToCategory(category), t)
  } catch {
    return undefined
  }
}

export function tryParseSubCategory(
  subcategory: string,
  t: TFunction<"translation", undefined>,
): string | undefined {
  try {
    return gameCategoryToName(subcategory as GameCategory, t)
  } catch {
    try {
      return audioVideoCategoryToName(subcategory as AudioVideoCategory, t)
    } catch {
      return undefined
    }
  }
}

export function categoryToName(
  category: MainCategory,
  t: TFunction<"translation", undefined>,
): string {
  switch (category) {
    case MainCategory.audiovideo:
      return t("audio-and-video")
    case MainCategory.development:
      return t("developer-tools")
    case MainCategory.game:
      return t("games")
    case MainCategory.graphics:
      return t("graphics-and-photography")
    case MainCategory.network:
      return t("networking")
    case MainCategory.office:
      return t("productivity")
    case MainCategory.utility:
      return t("utilities")
    case MainCategory.science:
      return t("science")
    case MainCategory.education:
      return t("education")
    case MainCategory.system:
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

function assertUnreachable(_x: never): never {
  throw new Error("Didn't expect to get here")
}

export function getSubcategory(category: string): string[] | undefined {
  if (!category) {
    return undefined
  }

  switch (category.toLowerCase()) {
    case MainCategory.game:
      return Object.keys(GameCategory).filter((x) => x !== "Emulator")
    case MainCategory.audiovideo:
      return Object.keys(AudioVideoCategory)
  }
}

export const gameCategoryFilter = [
  "emulator",
  "packageManager",
  "utility",
  "network",
]
