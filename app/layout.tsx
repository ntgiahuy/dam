import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Shop drawing thép dầm",
  description: "Nhập số liệu dầm BTCT và xuất shop thép + bảng thống kê cốt thép ra PDF",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
