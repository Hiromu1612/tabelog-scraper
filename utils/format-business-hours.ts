/**
 * 営業時間の文字列からL.O.以降の情報を除去する関数
 */
export function formatBusinessHours(hours: string): string {
  if (!hours) return "不明"

  // 複数の営業時間を「/」で区切って処理
  const timeSlots = hours.split("/")

  // 各時間帯からL.O.以降を削除
  const formattedSlots = timeSlots.map((slot) => {
    // L.O.が含まれる場合、その前までの文字列を取得
    const loIndex = slot.toLowerCase().indexOf("l.o.")
    if (loIndex !== -1) {
      return slot.substring(0, loIndex).trim()
    }
    return slot.trim()
  })

  // 整形した時間帯を「/」で結合して返す
  return formattedSlots.join(" / ")
}
