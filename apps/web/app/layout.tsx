import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "GeM Intelligence | Procurement demand, understood",
  description:
    "Source-backed government procurement intelligence across India. Products, regions, buyers and historical demand.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
