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
          colorPrimary: "#b74b28",
          colorBgLayout: "#f7f1ea",
          colorBgContainer: "#fff8f2",
          colorBgElevated: "#fff6ef",
          colorBorder: "rgba(38, 26, 22, 0.14)",
          colorBorderSecondary: "rgba(38, 26, 22, 0.14)",
          colorText: "#261a16",
          colorTextSecondary: "#6f5a50",
          colorTextTertiary: "#887267",
          colorTextPlaceholder: "#9a857a",
          colorFillSecondary: "rgba(71, 29, 19, 0.04)",
          colorLink: "#8f3a22",
          colorLinkHover: "#b74b28",
          borderRadius: 16,
          fontFamily: '"DM Sans", "Noto Sans SC", "PingFang SC", "Segoe UI", sans-serif',
        },
        components: {
          Button: {
            controlHeight: 46,
            borderRadius: 12,
            fontWeight: 600,
          },
          Card: {
            borderRadiusLG: 16,
            boxShadow: "0 10px 26px rgba(38, 26, 22, 0.1)",
          },
          Layout: {
            siderBg: "rgba(255, 250, 240, 0.92)",
            bodyBg: "transparent",
            headerBg: "#fff8f2",
          },
          Menu: {
            itemBorderRadius: 12,
            itemBg: "transparent",
            itemColor: "#6f5a50",
            itemSelectedBg: "rgba(183, 75, 40, 0.12)",
            itemSelectedColor: "#471d13",
            itemHoverColor: "#261a16",
            itemHoverBg: "rgba(71, 29, 19, 0.05)",
          },
          Input: {
            borderRadius: 12,
            activeBorderColor: "#8f3a22",
            hoverBorderColor: "#b74b28",
            activeShadow: "0 0 0 3px rgba(183, 75, 40, 0.12)",
          },
          Select: {
            borderRadius: 12,
            optionSelectedBg: "rgba(183, 75, 40, 0.12)",
            optionActiveBg: "rgba(71, 29, 19, 0.06)",
          },
          Modal: {
            borderRadiusLG: 18,
          },
          Tag: {
            borderRadiusSM: 8,
            fontSizeSM: 11,
          },
          Badge: {
            colorError: "#b74b28",
          },
          Alert: {
            borderRadiusLG: 12,
          },
          Statistic: {
            titleFontSize: 12,
          },
        },
      }}
    >
      {children}
    </ConfigProvider>
  );
}
