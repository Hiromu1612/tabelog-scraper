// ブラウザを起動する部分を変更
const browser = await puppeteer.launch({
    headless: isHeadlessMode ? "new" : false,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--disable-software-rasterizer"
    ],
    defaultViewport: null,
    executablePath: process.env.NETLIFY ? '/usr/bin/chromium-browser' : undefined,
  });