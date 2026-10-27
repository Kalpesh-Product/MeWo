import type { Metadata } from "next";
import "./globals.css";
import { Header, Footer } from "@/components/site-shell";
import { PageLoader } from "@/components/page-loader";

export const metadata: Metadata = {
  title: { default: "MeWo - Co-Work Nest", template: "%s | MeWo" },
  description:
    "MeWo - Meetings & Co-Working. A fully serviced premier work nest in Patto, Panjim, Goa. Private offices, desks, meeting rooms and virtual offices.",
  icons: {
    icon: [
      { url: "/favicon.ico?v=mewo", type: "image/x-icon" },
      { url: "/icon.png?v=mewo", type: "image/png" },
    ],
    shortcut: "/favicon.ico?v=mewo",
  },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:bg-white focus:p-3"
        >
          Skip to content
        </a>
        <PageLoader />
        <Header />
        {children}
        <Footer />
      </body>
    </html>
  );
}
