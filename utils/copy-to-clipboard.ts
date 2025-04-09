/**
 * テキストをクリップボードにコピーする関数
 */
export const copyToClipboard = (text: string): Promise<boolean> => {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard
      .writeText(text)
      .then(() => true)
      .catch(() => false)
  } else {
    // フォールバック（セキュアコンテキストでない場合）
    const textArea = document.createElement("textarea")
    textArea.value = text
    textArea.style.position = "fixed"
    textArea.style.left = "-999999px"
    textArea.style.top = "-999999px"
    document.body.appendChild(textArea)
    textArea.focus()
    textArea.select()

    return new Promise<boolean>((resolve) => {
      const success = document.execCommand("copy")
      textArea.remove()
      resolve(success)
    })
  }
}
