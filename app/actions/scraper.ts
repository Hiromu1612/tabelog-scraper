"use server"

import puppeteer from "puppeteer"
import type { RestaurantData } from "@/types/restaurant"

export async function scrapeTabelog(prefecture: string): Promise<{
  success: boolean
  message: string
  restaurants?: RestaurantData[]
  error?: string
}> {
  try {
    const browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    })
    const page = await browser.newPage()

    // ユーザーエージェントを設定
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    )

    // 食べログにアクセス
    await page.goto("https://tabelog.com/rstLst/?srchTg=1&svd=20250409&svt=1900&svps=2&vac_net=1", {
      waitUntil: "networkidle2",
      timeout: 60000,
    })

    // 全国のリンクをクリック
    await page.waitForSelector('a:has-text("全国")')
    await page.click('a:has-text("全国")')

    // 都道府県選択のポップアップが表示されるのを待つ
    await page.waitForSelector(".poplayer")

    // 指定された都道府県をクリック
    const prefectureSelector = `a:has-text("${prefecture}")`
    await page.waitForSelector(prefectureSelector)
    await page.click(prefectureSelector)

    // ページが読み込まれるのを待つ
    await page.waitForNavigation({ waitUntil: "networkidle2" })

    // ネット予約可（日時指定なし）のチェックを外す（もし存在する場合）
    const netReservationCheckbox = await page.$('input[type="checkbox"][id*="net"]')
    if (netReservationCheckbox) {
      const isChecked = await page.evaluate((el) => el.checked, netReservationCheckbox)
      if (isChecked) {
        await netReservationCheckbox.click()
      }
    }

    // こだわり条件まで下にスクロール
    await page.evaluate(() => {
      const element = document.querySelector(".conditions-modal")
      if (element) {
        element.scrollIntoView()
      }
    })

    // 駐車場のチェックボックスを探してクリック
    await page.waitForSelector('label:has-text("駐車場")')
    await page.click('label:has-text("駐車場")')

    // 絞り込むボタンをクリック
    await page.waitForSelector('button:has-text("絞り込む")')
    await page.click('button:has-text("絞り込む")')

    // ページが読み込まれるのを待つ
    await page.waitForNavigation({ waitUntil: "networkidle2" })

    // 検索結果から店舗情報を収集
    const restaurants: RestaurantData[] = []
    let hasNextPage = true
    let currentPage = 1
    const maxPages = 5 // 最大5ページまで取得（テスト用）

    while (hasNextPage && currentPage <= maxPages) {
      console.log(`ページ ${currentPage} の処理を開始します`)

      // 現在のページの店舗リンクを取得
      const restaurantLinks = await page.$$eval(".list-rst__rst-name-target", (links) =>
        links.map((link) => (link as HTMLAnchorElement).href),
      )

      // 各店舗の詳細ページにアクセスしてデータを取得
      for (let i = 0; i < Math.min(restaurantLinks.length, 20); i++) {
        const link = restaurantLinks[i]

        // 店舗詳細ページに移動
        await page.goto(link, { waitUntil: "networkidle2" })

        // 店舗情報を取得
        const restaurantData = await page.evaluate(() => {
          // 店舗名
          const nameElement = document.querySelector(".display-name")
          const name = nameElement ? nameElement.textContent?.trim() : "不明"

          // 基本情報テーブルから情報を取得
          const tableRows = document.querySelectorAll(".rstinfo-table__table-row")
          let address = "不明"
          let phone = "不明"
          let hours = "不明"
          let parking = "不明"
          let twitter = null
          let instagram = null

          tableRows.forEach((row) => {
            const header = row.querySelector(".rstinfo-table__table-title")
            if (!header) return

            const headerText = header.textContent?.trim()
            const content = row.querySelector(".rstinfo-table__table-content")
            const contentText = content ? content.textContent?.trim() : ""

            if (headerText?.includes("住所")) {
              address = contentText || "不明"
            } else if (headerText?.includes("予約・お問い合わせ")) {
              phone = contentText || "不明"
            } else if (headerText?.includes("営業時間")) {
              hours = contentText || "不明"
            } else if (headerText?.includes("駐車場")) {
              // 駐車場 - 新しいセレクタを使用（駐車場欄全体を取得）
              const parkingElement = document.querySelector("table:nth-of-type(2) tr:nth-of-type(6) > td")
              parking = parkingElement ? parkingElement.textContent?.trim() : "不明"
            }
          })

          // SNSアカウント情報を取得
          const snsLinks = document.querySelectorAll(".rstinfo-sns__link")
          snsLinks.forEach((link) => {
            const href = (link as HTMLAnchorElement).href
            if (href.includes("twitter.com")) {
              twitter = href
            } else if (href.includes("instagram.com")) {
              instagram = href
            }
          })

          return {
            name,
            address,
            phone,
            hours,
            parking,
            socialAccounts: {
              twitter,
              instagram,
            },
          }
        })

        restaurants.push(restaurantData)
        console.log(`「${restaurantData.name}」の情報を取得しました`)

        // 負荷軽減のため少し待機
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }

      // 次のページがあるか確認
      const nextPageButton = await page.$('a:has-text("次の20件")')
      if (nextPageButton && currentPage < maxPages) {
        await nextPageButton.click()
        await page.waitForNavigation({ waitUntil: "networkidle2" })
        currentPage++
      } else {
        hasNextPage = false
      }
    }

    await browser.close()

    return {
      success: true,
      message: `${prefecture}の飲食店情報の収集が完了しました`,
      restaurants,
    }
  } catch (error) {
    console.error("スクレイピングエラー:", error)
    return {
      success: false,
      message: "スクレイピング処理中にエラーが発生しました",
      error: error instanceof Error ? error.message : "不明なエラー",
    }
  }
}
