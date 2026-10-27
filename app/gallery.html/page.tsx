import type { Metadata } from "next";
import { InnerPage } from "@/components/inner-page";
export const metadata: Metadata = { title: "Gallery" };
export default function Page() {
  return <InnerPage page="gallery" />;
}
