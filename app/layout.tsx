import type { Metadata } from "next";
import { withBasePath } from "@/lib/base-path";
import "./globals.css";

export const metadata: Metadata = {
  title: "Shop drawing thép dầm | GiaHuy.Net",
  description:
    "Nhập số liệu dầm BTCT và xuất shop thép + bảng thống kê cốt thép ra PDF hoặc CAD (DWG/DXF)",
  icons: {
    icon: [
      { url: withBasePath("/favicon-96x96.png"), sizes: "96x96", type: "image/png" },
      { url: withBasePath("/favicon.ico") },
    ],
    apple: [{ url: withBasePath("/favicon-96x96.png"), sizes: "96x96", type: "image/png" }],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
