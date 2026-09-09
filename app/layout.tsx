import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://portfolio-compass-jp.fx98jcsfnp.chatgpt.site'),
  title: 'Portfolio Compass | 持仓配置仪表盘',
  description: '将日文券商持仓文本转换为清晰的权重与调仓计划。',
  openGraph: {
    title: 'Portfolio Compass | 持仓配置仪表盘',
    description: '粘贴日文券商文本，自动计算权重、集中度与调仓缺口。',
    images: [{ url: '/og.png', width: 1735, height: 907 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Portfolio Compass | 持仓配置仪表盘',
    description: '粘贴日文券商文本，自动计算权重、集中度与调仓缺口。',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
