"use client";

import "@ant-design/v5-patch-for-react-19";
import { ConfigProvider, theme } from "antd";
import enUS from "antd/locale/en_US";
import frFR from "antd/locale/fr_FR";
import zhCN from "antd/locale/zh_CN";
import zhTW from "antd/locale/zh_TW";
import type { ReactNode } from "react";

import type { Locale } from "../lib/i18n/config";
import { useI18n } from "../lib/i18n/useI18n";

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
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: "#ff4e8c",
          colorBgLayout: "#0d0814",
          colorBgContainer: "#130d24",
          colorBgElevated: "#1a0d2e",
          colorBorder: "rgba(255, 255, 255, 0.10)",
          colorBorderSecondary: "rgba(255, 255, 255, 0.06)",
          colorText: "#ffffff",
          colorTextSecondary: "rgba(255, 255, 255, 0.58)",
          colorTextTertiary: "rgba(255, 255, 255, 0.35)",
          colorTextPlaceholder: "rgba(255, 255, 255, 0.32)",
          colorFillSecondary: "rgba(255, 255, 255, 0.06)",
          colorLink: "#ff4e8c",
          colorLinkHover: "#ff7aad",
          borderRadius: 16,
          fontFamily: '"DM Sans", "Noto Sans SC", "PingFang SC", "Segoe UI", sans-serif',
        },
        components: {
          Button: {
            controlHeight: 46,
            borderRadius: 999,
            fontWeight: 600,
          },
          Card: {
            borderRadiusLG: 22,
            boxShadow: "0 8px 28px rgba(0, 0, 0, 0.40)",
            colorBgContainer: "rgba(255, 255, 255, 0.07)",
          },
          Layout: {
            siderBg: "transparent",
            bodyBg: "transparent",
            headerBg: "rgba(13, 8, 20, 0.82)",
          },
          Menu: {
            itemBorderRadius: 12,
            itemBg: "transparent",
            itemColor: "rgba(255, 255, 255, 0.58)",
            itemSelectedBg: "rgba(255, 78, 140, 0.12)",
            itemSelectedColor: "#ff4e8c",
            itemHoverColor: "#ffffff",
            itemHoverBg: "rgba(255, 255, 255, 0.07)",
          },
          Input: {
            borderRadius: 12,
            activeBorderColor: "#ff4e8c",
            hoverBorderColor: "#ff7aad",
            activeShadow: "0 0 0 3px rgba(255, 78, 140, 0.15)",
            colorBgContainer: "rgba(255, 255, 255, 0.07)",
          },
          Select: {
            borderRadius: 12,
            optionSelectedBg: "rgba(255, 78, 140, 0.12)",
            optionActiveBg: "rgba(255, 255, 255, 0.06)",
            colorBgContainer: "rgba(255, 255, 255, 0.07)",
            colorBgElevated: "#1a0d2e",
          },
          Modal: {
            borderRadiusLG: 22,
            contentBg: "#130d24",
            headerBg: "#130d24",
          },
          Tag: {
            borderRadiusSM: 8,
            fontSizeSM: 11,
          },
          Badge: {
            colorError: "#ff4e8c",
          },
          Alert: {
            borderRadiusLG: 12,
          },
          Statistic: {
            titleFontSize: 12,
          },
          List: {
            colorSplit: "rgba(255, 255, 255, 0.08)",
          },
          Calendar: {
            colorBgContainer: "rgba(255, 255, 255, 0.07)",
          },
        },
      }}
    >
      {children}
    </ConfigProvider>
  );
}
