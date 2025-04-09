import { NextResponse } from "next/server"
import { getScrapingStatus } from "../global-state"

// スクレイピングの状態を取得する
export async function GET() {
  try {
    // グローバル状態からスクレイピング状態を取得
    const status = getScrapingStatus()

    // キャッシュを防ぐためのヘッダーを追加
    return new NextResponse(JSON.stringify(status), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    })
  } catch (error) {
    console.error("ステータス取得エラー:", error)
    return NextResponse.json({
      status: "error",
      message: "ステータス取得中にエラーが発生しました",
      error: error instanceof Error ? error.message : "不明なエラー",
    })
  }
}
