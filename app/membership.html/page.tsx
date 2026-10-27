import type { Metadata } from "next";
import { InnerPage } from "@/components/inner-page";
export const metadata: Metadata = { title: "Membership" };
export default function Page() {
  return <InnerPage page="membership" />;
}
