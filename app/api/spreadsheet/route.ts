import { NextResponse } from "next/server"
import { saveToSpreadsheet } from "@/app/actions/spreadsheet"
import { formatBusinessHours } from "@/utils/format-business-hours"

export async function POST(request: Request) {
  try {
    const { prefecture, restaurants } = await request.json()

    if (!prefecture || !restaurants || !Array.isArray(restaurants)) {
      return NextResponse.json({ error: "無効なリクエストデータです" }, { status: 400 })
    }

    // 営業時間をフォーマットしてからスプレッドシートに保存
    const formattedRestaurants = restaurants.map((restaurant) => ({
      ...restaurant,
      businessHours: formatBusinessHours(restaurant.businessHours),
    }))

    // スプレッドシートに保存
    const result = await saveToSpreadsheet(prefecture, formattedRestaurants)

    return NextResponse.json(result)
  } catch (error) {
    console.error("スプレッドシート保存エラー:", error)
    return NextResponse.json(
      {
        success: false,
        message: "スプレッドシートへの保存中にエラーが発生しました",
        error: error instanceof Error ? error.message : "不明なエラー",
      },
      { status: 500 },
    )
  }
}
