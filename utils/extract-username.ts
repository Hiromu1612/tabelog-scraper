/**
 * SNSのURLからユーザー名を抽出する関数
 */
export function extractUsername(url: string | null): string {
  if (!url) return ""

  try {
    // URLからユーザー名部分を抽出
    const urlObj = new URL(url)

    // Twitter/X
    if (urlObj.hostname.includes("twitter.com") || urlObj.hostname.includes("x.com")) {
      // パスの最後の部分を取得 (例: https://twitter.com/username -> username)
      const pathParts = urlObj.pathname.split("/").filter(Boolean)
      return pathParts.length > 0 ? `@${pathParts[0]}` : ""
    }

    // Instagram
    if (urlObj.hostname.includes("instagram.com")) {
      // パスの最後の部分を取得 (例: https://instagram.com/username -> username)
      const pathParts = urlObj.pathname.split("/").filter(Boolean)
      return pathParts.length > 0 ? `@${pathParts[0]}` : ""
    }

    // Facebook
    if (urlObj.hostname.includes("facebook.com")) {
      // パスの最後の部分を取得 (例: https://facebook.com/username -> username)
      const pathParts = urlObj.pathname.split("/").filter(Boolean)
      return pathParts.length > 0 ? pathParts[0] : ""
    }

    // その他のURL（ホームページなど）
    return urlObj.hostname
  } catch (e) {
    // URLのパース中にエラーが発生した場合
    return url
  }
}
