import type { Metadata } from "next";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";
import { PortalProvider } from "@/components/portal/portal-provider";
import { PortalShell } from "@/components/portal/portal-shell";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { describeDataSource } from "@/lib/env";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "CML Client Licensing",
    template: "%s · CML Licensing",
  },
  description:
    "CML's portal for pharmacy license operations: the client book, renewals, and roster import.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const source = describeDataSource();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <TooltipProvider>
          <PortalProvider>
            <PortalShell source={source}>{children}</PortalShell>
          </PortalProvider>
          <Toaster />
        </TooltipProvider>
      </body>
    </html>
  );
}
