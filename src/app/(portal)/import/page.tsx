import type { Metadata } from "next";
import { ImportView } from "@/components/views/import-view";

export const metadata: Metadata = {
  title: "Import roster",
};

export default function ImportPage() {
  return <ImportView />;
}
