export enum Collections {
  popular = "Popular",
  recentlyUpdated = "Recently Updated",
  editorsApps = "Editors Picks Apps",
  recentlyAdded = "Recently Added"
}

export type Collection =
  | Collections.popular
  | Collections.recentlyUpdated
  | Collections.editorsApps
  | Collections.recentlyAdded
