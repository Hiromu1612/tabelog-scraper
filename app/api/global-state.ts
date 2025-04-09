// グローバル変数を定義して共有するためのファイル
import type { RestaurantData } from "@/types/restaurant"

interface ScrapingStatus {
  status: "idle" | "running" | "completed" | "error"
  progress: number
  currentPage: number
  totalPages: number
  currentRestaurant: string
  restaurants: RestaurantData[]
  message: string
}

// @ts-ignore
if (typeof global.scrapingStatus === "undefined") {
  // @ts-ignore
  global.scrapingStatus = {
    status: "idle",
    progress: 0,
    currentPage: 0,
    totalPages: 3,
    currentRestaurant: "",
    restaurants: [],
    message: "",
  }
}

// スクレイピング状態を更新する関数
export function updateScrapingStatus(update: Partial<ScrapingStatus>) {
  // @ts-ignore
  global.scrapingStatus = { ...global.scrapingStatus, ...update }
}

// スクレイピング状態を取得する関数
export function getScrapingStatus(): ScrapingStatus {
  // @ts-ignore
  return global.scrapingStatus
}
