import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { TooltipProvider } from "@/components/ui/tooltip";
import { THEME_INIT_SCRIPT } from "@/lib/theme";

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
    default: "Neon Archive - streaming artists, by the numbers",
    template: "%s | Neon Archive",
  },
  description:
    "An archive of 500+ streaming artists: lifetime stream splits from a " +
    "Kaggle dataset, paired with each artist's top 5 tracks on YouTube " +
    "Music, genre tags and a description pulled live from Apple Music and " +
    "Wikipedia.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // Two things live on <html> rather than <body>:
    //   font vars      globals.css applies `font-sans` to the html element,
    //                  and a variable declared on <body> is invisible to its
    //                  own parent, which silently drops the page back to the
    //                  browser default serif.
    //   scroll opt-in  Next 16 stopped suppressing `scroll-behavior: smooth`
    //                  during route changes unless asked; without this every
    //                  navigation smooth-scrolls to the top instead of
    //                  landing there.
    //
    // No `dark` class: that gated shadcn's `dark:` variants back when the
    // default theme was dark synthwave. Both themes are light now, so
    // nothing here ever wants those variants.
    //
    // suppressHydrationWarning is scoped to this one element and is load
    // bearing: the init script below rewrites data-theme before React
    // hydrates, so the server and client markup legitimately disagree here
    // and nowhere else.
    <html
      lang="en"
      className={`${inter.variable} ${spaceGrotesk.variable} ${jetBrainsMono.variable}`}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <head>
        {/* Must run before first paint - see THEME_INIT_SCRIPT. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
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
