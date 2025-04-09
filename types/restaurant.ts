export interface RestaurantData {
  name: string
  address: string
  phone: string
  hours: string
  parking: string
  socialAccounts: {
    twitter: string | null
    instagram: string | null
  }
}
