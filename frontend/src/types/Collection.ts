export enum Collections {
  popular = "Popular",
  recentlyUpdated = "Recently Updated",
  editorsApps = "Editors Picks Apps",
  editorsGames = "Editors Picks Games",
  randomApps = "Random Apps",
}

export type Collection =
  | Collections.popular
  | Collections.recentlyUpdated
  | Collections.editorsApps
  | Collections.editorsGames
  | Collection.randomApps
