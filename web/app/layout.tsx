import type { Metadata } from "next";
import { DM_Sans, Syne } from "next/font/google";
import localFont from "next/font/local";

import "./globals.css";

const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

const display = Syne({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600", "700"],
});

const body = DM_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://neurospread.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "NeuroSpread — Seizure spread from scalp EEG",
    template: "%s · NeuroSpread",
  },
  description:
    "Interactive dSPM and sLORETA seizure maps from scalp EEG. Explore CHB-MIT examples, upload your EDF, click brain regions to learn more, and export draft localization notes for epileptologists.",
  keywords: [
    "EEG",
    "epilepsy",
    "seizure",
    "source localization",
    "dSPM",
    "sLORETA",
    "CHB-MIT",
    "epileptologist",
    "brain mapping",
  ],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "NeuroSpread",
    title: "NeuroSpread — See seizure spread on the cortex",
    description:
      "Upload or explore public EEG seizures. Compare dSPM vs sLORETA, watch propagation, ask questions about any region, download draft reports.",
  },
  twitter: {
    card: "summary_large_image",
    title: "NeuroSpread — Seizure spread visualization",
    description:
      "Scalp EEG to interactive 3D maps. Built for epileptologists and epilepsy education.",
  },
  robots: { index: true, follow: true },
  alternates: { canonical: "/" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "NeuroSpread",
    applicationCategory: "HealthApplication",
    operatingSystem: "Web",
    description: metadata.description,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  };

  return (
    <html lang="en" className="dark">
      <body
        className={`${display.variable} ${body.variable} ${geistMono.variable} min-h-screen antialiased font-[family-name:var(--font-body)]`}
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {children}
      </body>
    </html>
  );
}
