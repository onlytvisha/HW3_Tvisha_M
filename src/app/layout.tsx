import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { TooltipProvider } from "@/components/ui/tooltip";

import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  display: "swap",
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Neon Archive - 500 artists, by the numbers",
    template: "%s | Neon Archive",
  },
  description:
    "A synthwave archive of 500 streaming artists: lifetime stream splits " +
    "from a Kaggle dataset, paired with each artist's current #1 track, " +
    "genre tags and description pulled live from Deezer, Apple Music and " +
    "Wikipedia.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // Three things live on <html> rather than <body>:
    //   `dark`         fixed on, not toggled - the synthwave palette is the
    //                  only theme, and the class is what makes shadcn's
    //                  `dark:` variants resolve.
    //   font vars      globals.css applies `font-sans` to the html element,
    //                  and a variable declared on <body> is invisible to its
    //                  own parent, which silently drops the page back to the
    //                  browser default serif.
    //   scroll opt-in  Next 16 stopped suppressing `scroll-behavior: smooth`
    //                  during route changes unless asked; without this every
    //                  navigation smooth-scrolls to the top instead of
    //                  landing there.
    <html
      lang="en"
      className={`dark ${inter.variable} ${spaceGrotesk.variable} ${jetBrainsMono.variable}`}
      data-scroll-behavior="smooth"
    >
      <body className="min-h-dvh">
        <TooltipProvider delayDuration={200}>
          <div className="relative flex min-h-dvh flex-col">
            <SiteHeader />
            <main className="flex-1">{children}</main>
            <SiteFooter />
          </div>
        </TooltipProvider>
      </body>
    </html>
  );
}
