import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Shop drawing thép dầm | GiaHuy.Net",
  description:
    "Nhập số liệu dầm BTCT và xuất shop thép + bảng thống kê cốt thép ra PDF",
  icons: {
    icon: [
      { url: "/favicon-96x96.png", sizes: "96x96", type: "image/png" },
      { url: "/favicon.ico" },
    ],
    apple: [{ url: "/favicon-96x96.png", sizes: "96x96", type: "image/png" }],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
