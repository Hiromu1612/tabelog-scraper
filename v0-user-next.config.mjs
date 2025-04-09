/** @type {import('next').NextConfig} */
const nextConfig = {
  // サーバーコンポーネントでfsモジュールを使用できるようにする
  experimental: {
    serverComponentsExternalPackages: ["fs", "path"],
  },
};

export default nextConfig;
