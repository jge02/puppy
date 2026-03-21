import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import "antd/dist/reset.css";
import { I18nProvider } from "../lib/i18n/I18nProvider";
import { AntdAppProvider } from "../components/AntdAppProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Puppy MVP",
  description: "Next.js frontend for the Puppy MVP backend",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="zh-CN" style={{ colorScheme: "light" }}>
      <head>
        <meta name="description" content="A smooth and cute UI experience" />
        <meta name="theme-color" content="#471d13" />
      </head>
      <body className="app-root-body">
        <I18nProvider>
          <AntdAppProvider>{children}</AntdAppProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
