import type { Metadata } from "next";
import { HelpGuide } from "./guide";

export const metadata: Metadata = {
  title: "Help · Live MD",
  description: "Guides for playing a show in the Live MD app.",
};

export default function HelpPage() {
  return <HelpGuide />;
}
