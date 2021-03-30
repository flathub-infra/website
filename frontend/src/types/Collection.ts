enum Collections {
  popular = "Popular",
  recenltyUpdated = "Recenlty Updated",
  editorsApps = "Editors Picks Apps",
  editorsGames = "Editors Picks Games"
}
export type Collection = Collections.popular
  | Collections.recenltyUpdated
  | Collections.editorsApps
  | Collections.editorsGames;

export default Collections;
