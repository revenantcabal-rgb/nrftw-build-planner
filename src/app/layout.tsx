import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/ui/Header";
import Sidebar from "@/components/ui/Sidebar";

export const metadata: Metadata = {
  title: "NRFTW Build Planner",
  description:
    "Character build planner for No Rest for the Wicked. Plan your weapons, armor, enchantments, and gems.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full flex flex-col bg-bg-primary text-text-primary">
        <Header />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
        <footer className="bg-bg-secondary border-t border-border-subtle px-4 py-3 text-center text-xs text-text-secondary">
          Built by <span className="text-text-gold">rmbrt</span> | Data from{" "}
          <a
            href="https://www.norestforthewicked.gg/db"
            target="_blank"
            rel="noopener noreferrer"
            className="text-text-gold/80 hover:text-text-gold"
          >
            norestforthewicked.gg
          </a>{" "}
          | Not affiliated with Moon Studios
        </footer>
      </body>
    </html>
  );
}
