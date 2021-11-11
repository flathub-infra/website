export enum Category {
  AudioVideo = 'AudioVideo',
  Development = 'Development',
  Education = 'Education',
  Game = 'Game',
  Graphics = 'Graphics',
  Network = 'Network',
  Office = 'Office',
  Science = 'Science',
  System = 'System',
  Utility = 'Utility',
}

export function categoryToName(category: Category): string {
  switch (category) {
    case Category.AudioVideo:
      return 'Audio & Video'
    case Category.Development:
      return 'Developer Tools'
    case Category.Game:
      return 'Games'
    case Category.Graphics:
      return 'Graphics & Photography'
    case Category.Network:
      return 'Social Networking'
    case Category.Office:
      return 'Productivity'
    case Category.Utility:
      return 'Utilities'
    default:
      return category as string
  }
}
