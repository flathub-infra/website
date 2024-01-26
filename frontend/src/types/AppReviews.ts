export interface AppReviews {
  average_rating: number
}

export interface AppRating {
  average_rating: number
}

export interface LoadMultiAppRatings {
  ratings: { [key: string]: AppRating }
}
