import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'Moss Quality · 质检 MVP-P0',description:'三核心角色、四个页面的银行呼入客服质检高保真原型'};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="zh-CN"><body>{children}</body></html>;}
