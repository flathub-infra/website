export enum Collections {
  popular = "Popular",
  recentlyUpdated = "Recently Updated",
  recentlyAdded = "Recently Added",
  verified = "Verified",
}

export type Collection =
  | Collections.popular
  | Collections.recentlyUpdated
  | Collections.recentlyAdded
  | Collections.verified
