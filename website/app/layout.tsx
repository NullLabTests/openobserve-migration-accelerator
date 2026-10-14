import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OpenObserve Cost Calculator | Migration Accelerator",
  description:
    "Estimate your OpenObserve cost and see your savings vs Datadog, Splunk or Elastic. Part of the OpenObserve Migration Accelerator.",
  keywords: [
    "OpenObserve",
    "observability",
    "cost calculator",
    "Datadog",
    "Splunk",
    "Elastic",
    "OpenTelemetry",
  ],
  openGraph: {
    title: "OpenObserve Cost Calculator",
    description:
      "See what you'd pay on OpenObserve and how much you'd save versus Datadog, Splunk or Elastic.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <div className="app-backdrop" />
        {children}
      </body>
    </html>
  );
}
