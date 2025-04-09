import { ScraperApp } from "@/components/scraper-app"

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 p-2 md:p-4">
      <div className="max-w-[98%] mx-auto">
        <h1 className="text-3xl font-bold text-slate-800 mb-2">食べログ営業リスト作成ツール</h1>
        <p className="text-slate-600 mb-6">駐車場のある飲食店を自動でリスト化します</p>
        <ScraperApp />
      </div>
    </main>
  )
}
