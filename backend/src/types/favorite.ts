export interface Favorite {
  id: number
  user_id: number
  url: string
  title: string
  thumbnail: string
  duration: number
  added_at: string
}

export interface CreateFavorite {
  user_id: number
  url: string
  title: string
  thumbnail: string
  duration: number
}
