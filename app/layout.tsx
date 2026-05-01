import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LMS Turnéplanner",
  description: "Ruteplanlægning for musikgruppers skolekoncertturnéer",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="da">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
