"use client";

import { ConfigProvider } from "antd";
import enUS from "antd/locale/en_US";
import frFR from "antd/locale/fr_FR";
import zhCN from "antd/locale/zh_CN";
import zhTW from "antd/locale/zh_TW";
import type { ReactNode } from "react";

import type { Locale } from "../../lib/i18n/config";
import { useI18n } from "../../lib/i18n/useI18n";

const antdLocales: Record<Locale, typeof zhCN> = {
  "zh-CN": zhCN,
  en: enUS,
  "zh-TW": zhTW,
  fr: frFR,
};

type AntdAppProviderProps = {
  children: ReactNode;
};

export function AntdAppProvider({ children }: AntdAppProviderProps) {
  const { locale } = useI18n();

  return (
    <ConfigProvider
      locale={antdLocales[locale]}
      theme={{
        token: {
          colorPrimary: "#c96031",
          colorBgLayout: "#f2ede2",
          colorBgContainer: "#fffaf0",
          colorBorderSecondary: "rgba(30, 35, 31, 0.12)",
          colorText: "#1e231f",
          colorTextSecondary: "#607164",
          borderRadius: 16,
          fontFamily: '"Segoe UI", "PingFang SC", "Noto Sans SC", sans-serif',
        },
        components: {
          Button: {
            controlHeight: 44,
            borderRadius: 12,
          },
          Card: {
            borderRadiusLG: 16,
          },
          Layout: {
            siderBg: "rgba(255, 250, 240, 0.92)",
            bodyBg: "transparent",
            headerBg: "#fffaf0",
          },
          Menu: {
            itemBorderRadius: 12,
            itemBg: "transparent",
            itemColor: "#607164",
            itemSelectedBg: "rgba(201, 96, 49, 0.12)",
            itemSelectedColor: "#8e3a18",
            itemHoverColor: "#1e231f",
          },
        },
      }}
    >
      {children}
    </ConfigProvider>
  );
}
