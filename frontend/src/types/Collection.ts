export enum Collections {
  popular = "Popular",
  recentlyUpdated = "Recently Updated",
  recentlyAdded = "Recently Added",
}

export type Collection =
  | Collections.popular
  | Collections.recentlyUpdated
  | Collections.recentlyAdded
