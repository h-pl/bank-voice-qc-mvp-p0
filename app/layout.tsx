import type { Metadata } from "next";
import "./globals.css";
import "./workspace-system.css";
export const metadata: Metadata = {
  description: "三核心角色、七个业务模块的银行呼入客服质检高保真原型",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
