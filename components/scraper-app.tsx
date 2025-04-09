"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  Play,
  Pause,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  Copy,
  Check,
  Database,
  FileText,
  FileDown,
  ArrowUpDown,
} from "lucide-react"
import { prefectures } from "@/lib/prefectures"
import type { RestaurantData } from "@/types/restaurant"
import { extractUsername } from "@/utils/extract-username"
import { formatBusinessHours } from "@/utils/format-business-hours"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { copyToClipboard } from "@/utils/copy-to-clipboard"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

export function ScraperApp() {
  const [selectedPrefecture, setSelectedPrefecture] = useState<string>("")
  const [isRunning, setIsRunning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [currentRestaurant, setCurrentRestaurant] = useState("")
  const [restaurants, setRestaurants] = useState<RestaurantData[]>([])
  const [sortedRestaurants, setSortedRestaurants] = useState<RestaurantData[]>([])
  const [logs, setLogs] = useState<string[]>([])
  const [status, setStatus] = useState<"idle" | "running" | "completed" | "error">("idle")
  const [isSaving, setIsSaving] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [saveResult, setSaveResult] = useState<{ success: boolean; message: string } | null>(null)
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null)
  const [copiedLinks, setCopiedLinks] = useState<{ [key: string]: boolean }>({})
  const [emailTemplate, setEmailTemplate] = useState<string>(
    `お世話になっております。
〇〇と申します。

貴店のサービスに興味を持ち、ご連絡させていただきました。
ぜひ一度、お話をさせていただければと思います。

よろしくお願いいたします。`,
  )
  const [useEmailTemplate, setUseEmailTemplate] = useState<boolean>(false)
  const [templateInsert, setTemplateInsert] = useState<string>("担当者様")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")
  // ヘッドレスモードの初期値をfalse（オフ）に変更
  const [isHeadlessMode, setIsHeadlessMode] = useState<boolean>(false)

  // ローカルストレージからデータを読み込む
  useEffect(() => {
    const savedData = localStorage.getItem("tabelog-scraper-data")
    if (savedData) {
      try {
        const parsedData = JSON.parse(savedData)
        if (parsedData.restaurants && Array.isArray(parsedData.restaurants)) {
          setRestaurants(parsedData.restaurants)
          setSortedRestaurants(parsedData.restaurants)
          setSelectedPrefecture(parsedData.prefecture || "")
          addLog(`前回のデータを読み込みました（${parsedData.restaurants.length}件）`)
        }
      } catch (error) {
        console.error("保存データの読み込みエラー:", error)
      }
    }

    // メールテンプレートを読み込む
    const savedTemplate = localStorage.getItem("tabelog-email-template")
    if (savedTemplate) {
      setEmailTemplate(savedTemplate)
    }

    // テンプレート使用設定を読み込む
    const savedUseTemplate = localStorage.getItem("tabelog-use-email-template")
    if (savedUseTemplate) {
      setUseEmailTemplate(savedUseTemplate === "true")
    }

    // テンプレート挿入テキストを読み込む
    const savedTemplateInsert = localStorage.getItem("tabelog-email-template-insert")
    if (savedTemplateInsert) {
      setTemplateInsert(savedTemplateInsert)
    }

    // ローカルストレージからヘッドレスモード設定を読み込む処理を追加（useEffect内）
    // メールテンプレートを読み込む処理の後に追加
    const savedHeadlessMode = localStorage.getItem("tabelog-headless-mode")
    if (savedHeadlessMode) {
      setIsHeadlessMode(savedHeadlessMode === "true")
    }
  }, [])

  // レストランデータが変更されたらソートされたデータも更新
  useEffect(() => {
    sortRestaurantsByParking(sortDirection)
  }, [restaurants])

  // メールテンプレートが変更されたら保存
  useEffect(() => {
    localStorage.setItem("tabelog-email-template", emailTemplate)
  }, [emailTemplate])

  // テンプレート使用設定が変更されたら保存
  useEffect(() => {
    localStorage.setItem("tabelog-use-email-template", useEmailTemplate.toString())
  }, [useEmailTemplate])

  // テンプレート挿入テキストが変更されたら保存
  useEffect(() => {
    localStorage.setItem("tabelog-email-template-insert", templateInsert)
  }, [templateInsert])

  // ヘッドレスモード設定が変更されたら保存する処理を追加（useEffect内）
  // テンプレート挿入テキストの保存処理の後に追加
  useEffect(() => {
    localStorage.setItem("tabelog-headless-mode", isHeadlessMode.toString())
  }, [isHeadlessMode])

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval)
      }
    }
  }, [pollingInterval])

  const addLog = (message: string) => {
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`])
  }

  // 駐車場の台数を抽出する関数
  const extractParkingNumber = (parkingText: string): number => {
    if (!parkingText) return -1

    // 数字を抽出する正規表現
    const match = parkingText.match(/(\d+)台/)
    if (match && match[1]) {
      return Number.parseInt(match[1], 10)
    }
    return -1 // 数字がない場合は-1を返す
  }

  // 駐車場の台数でソートする関数
  const sortRestaurantsByParking = (direction: "asc" | "desc") => {
    setSortDirection(direction)

    const sorted = [...restaurants].sort((a, b) => {
      const parkingA = extractParkingNumber(a.parking)
      const parkingB = extractParkingNumber(b.parking)

      // 数字がない場合は下に表示
      if (parkingA === -1 && parkingB === -1) return 0
      if (parkingA === -1) return 1
      if (parkingB === -1) return -1

      // 昇順または降順でソート
      return direction === "asc" ? parkingA - parkingB : parkingB - parkingA
    })

    setSortedRestaurants(sorted)
  }

  // ポーリング関数を改善
  const startPolling = () => {
    // 既存のポーリングをクリア
    if (pollingInterval) {
      clearInterval(pollingInterval)
    }

    // 3秒ごとにAPIをポーリング
    const interval = setInterval(async () => {
      try {
        // スクレイピング状態を取得
        const response = await fetch("/api/status", {
          method: "GET",
          cache: "no-store", // キャッシュを無効化
          headers: {
            "Cache-Control": "no-cache",
            Pragma: "no-cache",
          },
        })

        if (response.ok) {
          const data = await response.json()

          // 進捗状況を更新
          setProgress(data.progress || 0)
          setCurrentPage(data.currentPage || 1)
          setTotalPages(data.totalPages || 3)

          // 現在処理中の店舗名を更新
          if (data.currentRestaurant && data.currentRestaurant !== currentRestaurant) {
            setCurrentRestaurant(data.currentRestaurant)
            addLog(`「${data.currentRestaurant}」の情報を取得しました`)
          }

          // 取得したレストラン情報を更新
          if (data.restaurants && data.restaurants.length > 0) {
            setRestaurants(data.restaurants)

            // ローカルストレージに保存
            localStorage.setItem(
              "tabelog-scraper-data",
              JSON.stringify({
                prefecture: selectedPrefecture,
                restaurants: data.restaurants,
                timestamp: new Date().toISOString(),
              }),
            )
          }

          // スクレイピングが完了したらポーリングを停止
          if (data.status === "completed" || data.status === "error") {
            clearInterval(interval)
            setPollingInterval(null)
            setIsRunning(false)
            setStatus(data.status)
            setProgress(100)
            addLog(data.message || "スクレイピングが完了しました")
          }
        }
      } catch (error) {
        console.error("ポーリングエラー:", error)
      }
    }, 3000) // 3秒ごとに更新

    setPollingInterval(interval)
  }

  // handleStart関数を更新
  const handleStart = async () => {
    if (!selectedPrefecture) {
      addLog("都道府県を選択してください")
      return
    }

    setIsRunning(true)
    setStatus("running")
    setProgress(0)
    setCurrentPage(1)
    setTotalPages(3)
    setRestaurants([])
    setSortedRestaurants([])
    setSaveResult(null)
    addLog(`${selectedPrefecture}の飲食店情報の収集を開始します`)

    try {
      // ポーリングを開始
      startPolling()

      // APIエンドポイントを呼び出してスクレイピングを開始
      fetch("/api/scrape", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prefecture: selectedPrefecture, isHeadlessMode }),
      }).catch((error) => {
        console.error("スクレイピングリクエストエラー:", error)
        addLog(`エラーが発生しました: ${error instanceof Error ? error.message : "不明なエラー"}`)
        setStatus("error")
        setIsRunning(false)
        if (pollingInterval) {
          clearInterval(pollingInterval)
          setPollingInterval(null)
        }
      })
    } catch (error) {
      addLog(`エラーが発生しました: ${error instanceof Error ? error.message : "不明なエラー"}`)
      setStatus("error")
      setIsRunning(false)
      if (pollingInterval) {
        clearInterval(pollingInterval)
        setPollingInterval(null)
      }
    }
  }

  const handleStop = () => {
    setIsRunning(false)
    addLog("処理を中断しました")

    // ポーリングを停止
    if (pollingInterval) {
      clearInterval(pollingInterval)
      setPollingInterval(null)
    }
  }

  // handleSaveToSpreadsheet関数を修正
  const handleSaveToSpreadsheet = async () => {
    if (restaurants.length === 0) {
      addLog("保存するデータがありません")
      return
    }

    setIsSaving(true)
    addLog("スプレッドシートにデータを保存しています...")

    try {
      const response = await fetch("/api/spreadsheet", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prefecture: selectedPrefecture,
          restaurants: restaurants,
        }),
      })

      const result = await response.json()
      console.log("スプレッドシート保存結果:", result)

      if (result.success) {
        addLog(result.message)
        setSaveResult(result)
      } else {
        addLog(`エラーが発生しました: ${result.error || "不明なエラー"}`)
        console.error("スプレッドシート保存エラー詳細:", result)
      }
    } catch (error) {
      console.error("スプレッドシート保存例外:", error)
      addLog(`エラーが発生しました: ${error instanceof Error ? error.message : "不明なエラー"}`)
    } finally {
      setIsSaving(false)
    }
  }

  // エクセルファイル出力関数
  const handleExportToExcel = async () => {
    if (restaurants.length === 0) {
      addLog("エクスポートするデータがありません")
      return
    }

    setIsExporting(true)
    addLog("エクセルファイルを作成しています...")

    try {
      // CSVデータを作成
      const headers = [
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
      ]

      const csvRows = [
        headers.join(","),
        ...sortedRestaurants.map((r, index) =>
          [
            index + 1,
            `"${r.name.replace(/"/g, '""')}"`,
            `"${r.address?.replace(/"/g, '""') || ""}"`,
            `"${r.phone?.replace(/"/g, '""') || ""}"`,
            `"${r.businessDays?.replace(/"/g, '""') || ""}"`,
            `"${formatBusinessHours(r.businessHours)?.replace(/"/g, '""') || ""}"`,
            `"${r.parking?.replace(/"/g, '""') || ""}"`,
            `"${r.homepage || ""}"`,
            `"${r.tabelogUrl || ""}"`,
            `"${r.socialAccounts?.twitter || ""}"`,
            `"${r.socialAccounts?.instagram || ""}"`,
            `"${r.socialAccounts?.facebook || ""}"`,
          ].join(","),
        ),
      ]

      const csvContent = csvRows.join("\n")

      // BOMを追加してUTF-8でエンコード
      const bom = new Uint8Array([0xef, 0xbb, 0xbf])
      const blob = new Blob([bom, csvContent], { type: "text/csv;charset=utf-8" })

      // ダウンロードリンクを作成
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `${selectedPrefecture}_飲食店リスト_${new Date().toISOString().split("T")[0]}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      addLog(`エクセルファイルを出力しました: ${link.download}`)
    } catch (error) {
      console.error("エクセルファイル出力エラー:", error)
      addLog(`エラーが発生しました: ${error instanceof Error ? error.message : "不明なエラー"}`)
    } finally {
      setIsExporting(false)
    }
  }

  const getStatusColor = () => {
    switch (status) {
      case "running":
        return "bg-blue-500"
      case "completed":
        return "bg-green-500"
      case "error":
        return "bg-red-500"
      default:
        return "bg-slate-300"
    }
  }

  // テキストを省略表示する関数（より多くのテキストを表示）
  const truncateText = (text: string, maxLength: number) => {
    if (!text) return ""
    return text.length > maxLength ? text.substring(0, maxLength) + "..." : text
  }

  // テキストが省略されているかチェックする関数
  const isTextTruncated = (text: string, maxLength: number) => {
    return text && text.length > maxLength
  }

  // リンクをコピーする関数（テンプレート対応版）
  const handleCopyLink = async (url: string, id: string, restaurantName: string) => {
    let textToCopy = url

    // テンプレートを使用する場合
    if (useEmailTemplate && emailTemplate) {
      // 店舗名を挿入したテキストを作成
      const customizedInsert = `〇〇(${restaurantName})${templateInsert}`

      // テンプレートの前に挿入
      const customizedTemplate = `${customizedInsert}\n${emailTemplate}`
      textToCopy = customizedTemplate
    }

    const success = await copyToClipboard(textToCopy)
    if (success) {
      setCopiedLinks({ ...copiedLinks, [id]: true })
      setTimeout(() => {
        setCopiedLinks({ ...copiedLinks, [id]: false })
      }, 2000)
    }
  }

  // テキストをコピーする関数
  const handleCopyText = async (text: string, id: string) => {
    const success = await copyToClipboard(text)
    if (success) {
      setCopiedLinks({ ...copiedLinks, [id]: true })
      setTimeout(() => {
        setCopiedLinks({ ...copiedLinks, [id]: false })
      }, 2000)
    }
  }

  // SNSユーザー名を短く表示する関数
  const shortenUsername = (username: string, maxLength = 10) => {
    if (!username) return ""
    return username.length > maxLength ? username.substring(0, maxLength) + "..." : username
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>スクレイピング設定</CardTitle>
          <CardDescription>都道府県を選択して、駐車場のある飲食店情報を収集します</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* 左列：営業メールテンプレート（幅を大きく） */}
            <div className="border rounded-md p-4 bg-slate-50 md:col-span-2">
              <div className="flex items-center justify-between mb-2">
                <Label htmlFor="email-template" className="text-sm font-medium">
                  営業メールテンプレート
                </Label>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="use-template"
                    checked={useEmailTemplate}
                    onCheckedChange={(checked) => setUseEmailTemplate(checked === true)}
                  />
                  <Label htmlFor="use-template" className="text-sm cursor-pointer">
                    コピー時にテンプレートを使用する
                  </Label>
                </div>
              </div>

              {/* 挿入テキスト入力欄 */}
              <div className="mb-2">
                <Label htmlFor="template-insert" className="text-xs text-slate-500 mb-1 block">
                  0行目に挿入するテキスト（店舗名は自動的に置き換えられます）
                </Label>
                <div className="relative">
                  <input
                    id="template-insert"
                    value={templateInsert}
                    onChange={(e) => setTemplateInsert(e.target.value)}
                    className="w-full px-3 py-1 text-sm border rounded pl-[110px]"
                    placeholder="担当者様"
                  />
                  <div className="absolute left-0 top-0 h-full flex items-center px-3 text-sm text-gray-500 pointer-events-none">
                    〇〇(店舗名)
                  </div>
                </div>
              </div>

              <Textarea
                id="email-template"
                value={emailTemplate}
                onChange={(e) => setEmailTemplate(e.target.value)}
                placeholder="営業メールのテンプレートを入力してください"
                className="min-h-[200px] resize-y"
              />
              <p className="text-xs text-slate-500 mt-1">
                ※ HP, Instagram, Twitter, Facebook,
                食べログのコピーボタンを押すとその店舗用の営業メールテンプレートがコピーされます
              </p>
            </div>

            {/* 右列：都道府県選択と操作ボタン（幅を小さく） */}
            <div className="space-y-6 md:col-span-1">
              <div>
                <label className="text-sm font-medium mb-2 block">都道府県</label>
                <div className="max-w-[180px]">
                  <Select value={selectedPrefecture} onValueChange={setSelectedPrefecture} disabled={isRunning}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="都道府県を選択" />
                    </SelectTrigger>
                    <SelectContent>
                      {prefectures.map((prefecture) => (
                        <SelectItem key={prefecture.code} value={prefecture.name}>
                          {prefecture.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* ヘッドレスモード切り替えのUIをトグル形式に変更 */}
              <div className="mt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="headless-mode" className="text-sm font-medium">
                      ヘッドレスモード
                    </Label>
                    <p className="text-xs text-slate-500 mt-1">
                      オンにすると、ブラウザを立ち上げずにバックグラウンドで実行します。
                    </p>
                  </div>
                  <Switch
                    id="headless-mode"
                    checked={isHeadlessMode}
                    onCheckedChange={setIsHeadlessMode}
                    disabled={isRunning}
                    className="data-[state=checked]:bg-blue-600"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${getStatusColor()}`}></div>
                <span className="text-sm">
                  {status === "idle" && "待機中"}
                  {status === "running" && "実行中"}
                  {status === "completed" && "完了"}
                  {status === "error" && "エラー"}
                </span>
                <Badge variant="outline" className="ml-2">
                  取得店舗数: {restaurants.length}
                </Badge>
              </div>

              {isRunning && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-slate-500">
                    <span>進捗状況: {progress.toFixed(1)}%</span>
                    <span>
                      ページ: {currentPage}/{totalPages || "?"}
                    </span>
                  </div>
                  <Progress value={progress} className="h-2" />
                  <p className="text-sm text-slate-500 mt-1">現在処理中: {currentRestaurant || "準備中..."}</p>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2 mt-4">
                {!isRunning ? (
                  <Button
                    onClick={handleStart}
                    disabled={!selectedPrefecture}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <Play className="w-4 h-4 mr-2" />
                    取得開始
                  </Button>
                ) : (
                  <Button onClick={handleStop} variant="destructive" className="w-full">
                    <Pause className="w-4 h-4 mr-2" />
                    停止
                  </Button>
                )}
                <Button
                  variant="outline"
                  disabled={restaurants.length === 0 || isRunning || isSaving}
                  onClick={handleSaveToSpreadsheet}
                  className="w-full bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                >
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  {isSaving ? "保存中..." : "スプレッドシート"}
                </Button>
                <Button
                  variant="outline"
                  disabled={restaurants.length === 0 || isRunning || isExporting}
                  onClick={handleExportToExcel}
                  className="w-full bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                >
                  <FileDown className="w-4 h-4 mr-2" />
                  {isExporting ? "出力中..." : "エクセル出力"}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">{/* 内容を上のCardContentに移動したので空にします */}</CardFooter>
      </Card>

      <Tabs defaultValue="data" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4 p-1 bg-slate-100 rounded-lg">
          <TabsTrigger
            value="data"
            className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md py-2"
          >
            <Database className="w-4 h-4" />
            <span>収集データ</span>
          </TabsTrigger>
          <TabsTrigger
            value="logs"
            className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md py-2"
          >
            <FileText className="w-4 h-4" />
            <span>ログ</span>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="data">
          <Card>
            <CardContent className="p-0">
              {restaurants.length > 0 ? (
                <div className="overflow-auto">
                  <ScrollArea className="h-[1200px] rounded-md border">
                    <div className="w-max min-w-full">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[50px] max-w-[50px]">#</TableHead>
                            <TableHead className="w-[160px] max-w-[160px]">店舗名</TableHead>
                            <TableHead className="w-[120px] max-w-[120px]">電話番号</TableHead>
                            <TableHead className="w-[160px] max-w-[160px]">営業日</TableHead>
                            <TableHead className="w-[160px] max-w-[160px]">営業時間</TableHead>
                            <TableHead
                              className="w-[180px] max-w-[180px] cursor-pointer hover:bg-slate-50"
                              onClick={() => sortRestaurantsByParking(sortDirection === "asc" ? "desc" : "asc")}
                            >
                              <div className="flex items-center">
                                駐車場
                                <ArrowUpDown className="ml-2 h-4 w-4" />
                              </div>
                            </TableHead>
                            <TableHead className="w-[80px] max-w-[80px]">HP</TableHead>
                            <TableHead className="w-[100px] max-w-[100px]">Instagram</TableHead>
                            <TableHead className="w-[100px] max-w-[100px]">Twitter</TableHead>
                            <TableHead className="w-[100px] max-w-[100px]">Facebook</TableHead>
                            <TableHead className="w-[80px] max-w-[80px]">URL</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {sortedRestaurants.map((restaurant, index) => (
                            <TableRow key={index}>
                              <TableCell className="w-[50px] max-w-[50px] text-center">{index + 1}</TableCell>

                              <TableCell className="font-medium w-[160px] max-w-[160px] overflow-hidden text-ellipsis whitespace-nowrap">
                                <div className="flex items-center gap-1">
                                  <TooltipProvider delayDuration={100}>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="block overflow-hidden text-ellipsis whitespace-nowrap max-w-[130px]">
                                          {truncateText(restaurant.name, 25)}
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent side="bottom">{restaurant.name}</TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                  <button
                                    onClick={() => handleCopyText(restaurant.name, `name-${index}`)}
                                    className="text-gray-500 hover:text-gray-800 focus:outline-none flex-shrink-0"
                                  >
                                    {copiedLinks[`name-${index}`] ? (
                                      <Check className="h-3.5 w-3.5 text-green-500" />
                                    ) : (
                                      <Copy className="h-3.5 w-3.5" />
                                    )}
                                  </button>
                                </div>
                              </TableCell>

                              <TableCell className="w-[120px] max-w-[120px] overflow-hidden text-ellipsis whitespace-nowrap">
                                {isTextTruncated(restaurant.phone, 15) ? (
                                  <TooltipProvider delayDuration={100}>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="block overflow-hidden text-ellipsis whitespace-nowrap">
                                          {truncateText(restaurant.phone, 15)}
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent side="bottom">{restaurant.phone}</TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                ) : (
                                  <span className="block overflow-hidden text-ellipsis whitespace-nowrap">
                                    {restaurant.phone}
                                  </span>
                                )}
                              </TableCell>

                              <TableCell className="w-[160px] max-w-[160px] overflow-hidden text-ellipsis whitespace-nowrap">
                                {isTextTruncated(restaurant.businessDays, 30) ? (
                                  <TooltipProvider delayDuration={100}>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="block overflow-hidden text-ellipsis whitespace-nowrap">
                                          {truncateText(restaurant.businessDays, 30)}
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent side="bottom">{restaurant.businessDays}</TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                ) : (
                                  <span className="block overflow-hidden text-ellipsis whitespace-nowrap">
                                    {restaurant.businessDays}
                                  </span>
                                )}
                              </TableCell>

                              <TableCell className="w-[160px] max-w-[160px] overflow-hidden text-ellipsis whitespace-nowrap">
                                {isTextTruncated(formatBusinessHours(restaurant.businessHours), 30) ? (
                                  <TooltipProvider delayDuration={100}>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="block overflow-hidden text-ellipsis whitespace-nowrap">
                                          {truncateText(formatBusinessHours(restaurant.businessHours), 30)}
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent side="bottom">
                                        {formatBusinessHours(restaurant.businessHours)}
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                ) : (
                                  <span className="block overflow-hidden text-ellipsis whitespace-nowrap">
                                    {formatBusinessHours(restaurant.businessHours)}
                                  </span>
                                )}
                              </TableCell>

                              <TableCell className="w-[180px] max-w-[180px] overflow-hidden text-ellipsis whitespace-normal">
                                <span className="block">{restaurant.parking}</span>
                              </TableCell>

                              <TableCell className="w-[80px] max-w-[80px] text-center">
                                {restaurant.homepage ? (
                                  <div className="flex items-center justify-center gap-1">
                                    <a
                                      href={restaurant.homepage}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-blue-500 hover:underline"
                                    >
                                      HP
                                    </a>
                                    <button
                                      onClick={() =>
                                        handleCopyLink(restaurant.homepage || "", `hp-${index}`, restaurant.name)
                                      }
                                      className="text-gray-500 hover:text-gray-800 focus:outline-none"
                                      title={useEmailTemplate ? "テンプレートをコピー" : "URLをコピー"}
                                    >
                                      {copiedLinks[`hp-${index}`] ? (
                                        <Check className="h-3.5 w-3.5 text-green-500" />
                                      ) : (
                                        <Copy className="h-3.5 w-3.5" />
                                      )}
                                    </button>
                                  </div>
                                ) : (
                                  "なし"
                                )}
                              </TableCell>

                              <TableCell className="w-[100px] max-w-[100px] overflow-hidden text-ellipsis whitespace-nowrap">
                                {restaurant.socialAccounts.instagram ? (
                                  <div className="flex items-center gap-1">
                                    <a
                                      href={restaurant.socialAccounts.instagram}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-blue-500 hover:underline"
                                    >
                                      {shortenUsername(extractUsername(restaurant.socialAccounts.instagram), 8)}
                                    </a>
                                    <button
                                      onClick={() =>
                                        handleCopyLink(
                                          restaurant.socialAccounts.instagram || "",
                                          `instagram-${index}`,
                                          restaurant.name,
                                        )
                                      }
                                      className="text-gray-500 hover:text-gray-800 focus:outline-none"
                                      title={useEmailTemplate ? "テンプレートをコピー" : "URLをコピー"}
                                    >
                                      {copiedLinks[`instagram-${index}`] ? (
                                        <Check className="h-3.5 w-3.5 text-green-500" />
                                      ) : (
                                        <Copy className="h-3.5 w-3.5" />
                                      )}
                                    </button>
                                  </div>
                                ) : (
                                  "なし"
                                )}
                              </TableCell>

                              <TableCell className="w-[100px] max-w-[100px] overflow-hidden text-ellipsis whitespace-nowrap">
                                {restaurant.socialAccounts.twitter ? (
                                  <div className="flex items-center gap-1">
                                    <a
                                      href={restaurant.socialAccounts.twitter}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-blue-500 hover:underline"
                                    >
                                      {shortenUsername(extractUsername(restaurant.socialAccounts.twitter), 8)}
                                    </a>
                                    <button
                                      onClick={() =>
                                        handleCopyLink(
                                          restaurant.socialAccounts.twitter || "",
                                          `twitter-${index}`,
                                          restaurant.name,
                                        )
                                      }
                                      className="text-gray-500 hover:text-gray-800 focus:outline-none"
                                      title={useEmailTemplate ? "テンプレートをコピー" : "URLをコピー"}
                                    >
                                      {copiedLinks[`twitter-${index}`] ? (
                                        <Check className="h-3.5 w-3.5 text-green-500" />
                                      ) : (
                                        <Copy className="h-3.5 w-3.5" />
                                      )}
                                    </button>
                                  </div>
                                ) : (
                                  "なし"
                                )}
                              </TableCell>

                              <TableCell className="w-[100px] max-w-[100px] overflow-hidden text-ellipsis whitespace-nowrap">
                                {restaurant.socialAccounts.facebook ? (
                                  <div className="flex items-center gap-1">
                                    <a
                                      href={restaurant.socialAccounts.facebook}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-blue-500 hover:underline"
                                    >
                                      {shortenUsername(extractUsername(restaurant.socialAccounts.facebook), 8)}
                                    </a>
                                    <button
                                      onClick={() =>
                                        handleCopyLink(
                                          restaurant.socialAccounts.facebook || "",
                                          `facebook-${index}`,
                                          restaurant.name,
                                        )
                                      }
                                      className="text-gray-500 hover:text-gray-800 focus:outline-none"
                                      title={useEmailTemplate ? "テンプレートをコピー" : "URLをコピー"}
                                    >
                                      {copiedLinks[`facebook-${index}`] ? (
                                        <Check className="h-3.5 w-3.5 text-green-500" />
                                      ) : (
                                        <Copy className="h-3.5 w-3.5" />
                                      )}
                                    </button>
                                  </div>
                                ) : (
                                  "なし"
                                )}
                              </TableCell>

                              <TableCell className="w-[80px] max-w-[80px] text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <a
                                    href={restaurant.tabelogUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-500 hover:underline"
                                  >
                                    URL
                                  </a>
                                  <button
                                    onClick={() =>
                                      handleCopyLink(restaurant.tabelogUrl || "", `tabelog-${index}`, restaurant.name)
                                    }
                                    className="text-gray-500 hover:text-gray-800 focus:outline-none"
                                    title={useEmailTemplate ? "テンプレートをコピー" : "URLをコピー"}
                                  >
                                    {copiedLinks[`tabelog-${index}`] ? (
                                      <Check className="h-3.5 w-3.5 text-green-500" />
                                    ) : (
                                      <Copy className="h-3.5 w-3.5" />
                                    )}
                                  </button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </ScrollArea>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-[400px] text-slate-500">
                  <Database className="w-12 h-12 mb-4 text-slate-300" />
                  <p>データがありません</p>
                  <p className="text-sm">スクレイピングを開始してデータを収集してください</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="logs">
          <Card>
            <CardContent className="p-0">
              <ScrollArea className="h-[1200px] rounded-md border p-4">
                {logs.length > 0 ? (
                  logs.map((log, index) => (
                    <div key={index} className="py-1 text-sm border-b border-slate-100 last:border-0">
                      {log}
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center h-[400px] text-slate-500">
                    <FileText className="w-12 h-12 mb-4 text-slate-300" />
                    <p>ログがありません</p>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {status === "completed" && (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            スクレイピングが完了しました。 「スプレッドシートに保存」ボタンをクリックしてデータを保存できます。
          </AlertDescription>
        </Alert>
      )}

      {status === "error" && (
        <Alert className="bg-red-50 border-red-200">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            エラーが発生しました。ログを確認して、再度お試しください。
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
