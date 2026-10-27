import type { Metadata } from "next";
import { InnerPage } from "@/components/inner-page";
export const metadata: Metadata = { title: "Contact" };
export default function Page() {
  return <InnerPage page="contact" />;
}
