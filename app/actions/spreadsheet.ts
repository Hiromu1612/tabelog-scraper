"use server"

import { google } from "googleapis"
import type { RestaurantData } from "@/types/restaurant"
import { formatBusinessHours } from "@/utils/format-business-hours"

export async function saveToSpreadsheet(prefecture: string, restaurants: RestaurantData[]) {
  try {
    // 環境変数から認証情報を取得
    const GOOGLE_API_CREDENTIALS = process.env.GOOGLE_API_CREDENTIALS
    const SPREADSHEET_ID = process.env.SPREADSHEET_ID

    if (!GOOGLE_API_CREDENTIALS || !SPREADSHEET_ID) {
      throw new Error("Google API認証情報またはスプレッドシートIDが設定されていません")
    }

    console.log("スプレッドシートIDを取得しました:", SPREADSHEET_ID)

    // Google Sheets APIの認証
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(GOOGLE_API_CREDENTIALS),
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    })

    console.log("Google認証に成功しました")

    const sheets = google.sheets({ version: "v4", auth })
    console.log("Sheetsクライアントを作成しました")

    // スプレッドシートにシートが存在するか確認し、なければ作成
    console.log("スプレッドシート情報を取得します...")
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    })

    const sheetExists = spreadsheet.data.sheets?.some((sheet) => sheet.properties?.title === prefecture)
    console.log(`シート「${prefecture}」の存在: ${sheetExists ? "あり" : "なし"}`)

    if (!sheetExists) {
      console.log(`シート「${prefecture}」を作成します...`)
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: prefecture,
                },
              },
            },
          ],
        },
      })
      console.log(`シート「${prefecture}」を作成しました`)
    }

    // スプレッドシートにデータを書き込む
    console.log(`シート「${prefecture}」のデータをクリアします...`)
    await sheets.spreadsheets.values.clear({
      spreadsheetId: SPREADSHEET_ID,
      range: `${prefecture}!A1:Z1000`,
    })
    console.log(`シート「${prefecture}」のデータをクリアしました`)

    console.log(`シート「${prefecture}」にデータを書き込みます...`)
    const values = [
      [
        "No.",
        "店舗名",
        "住所",
        "電話番号",
        "営業日",
        "営業時間",
        "駐車場",
        "HP",
        "食べログ",
        "Twitter",
        "Instagram",
        "Facebook",
      ],
      ...restaurants.map((r, index) => [
        index + 1,
        r.name,
        r.address,
        r.phone,
        r.businessDays,
        formatBusinessHours(r.businessHours),
        r.parking,
        r.homepage || "",
        r.tabelogUrl || "",
        r.socialAccounts.twitter || "",
        r.socialAccounts.instagram || "",
        r.socialAccounts.facebook || "",
      ]),
    ]
    console.log(`書き込むデータ行数: ${values.length}行`)

    const appendResponse = await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${prefecture}!A1`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: values,
      },
    })
    console.log(`データ書き込み完了: ${appendResponse.data.updates?.updatedCells || 0}セル更新されました`)

    return {
      success: true,
      message: `${prefecture}の飲食店情報をスプレッドシートに保存しました`,
      count: restaurants.length,
    }
  } catch (error) {
    console.error("スプレッドシート保存エラー:", error)
    return {
      success: false,
      message: "スプレッドシートへの保存中にエラーが発生しました",
      error: error instanceof Error ? error.message : "不明なエラー",
    }
  }
}
