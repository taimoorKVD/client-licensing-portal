import type { Metadata } from "next";
import { MarketingHome } from "@/components/marketing/home";

export const metadata: Metadata = {
  title: {
    absolute: "Client License Portal · CML Licensing",
  },
  description:
    "An operations desk for staff who keep pharmacy licenses for the clients they already serve, plus a read-only view where each pharmacy sees only its own licenses and notes.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Client License Portal · CML Licensing",
    description:
      "An operations desk for staff who keep pharmacy licenses for the clients they already serve, plus a read-only view where each pharmacy sees only its own licenses and notes.",
    url: "/",
    siteName: "Client License Portal",
    type: "website",
  },
};

export default function MarketingPage() {
  return <MarketingHome />;
}
