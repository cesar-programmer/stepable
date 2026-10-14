import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";

import { MotionProvider } from "./components/motion";
import { themeCookie } from "./theme";
import "./styles.css";

export const metadata: Metadata = {
  title: "Stepable",
  description: "Onboarding interactivo y consultas sobre prácticas internas.",
};

// The on-screen keyboard resizes the layout, so sheets stay above it.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  interactiveWidget: "resizes-content",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Without a choice the CSS follows the system (prefers-color-scheme).
  const theme = (await cookies()).get(themeCookie)?.value;
  const dataTheme =
    theme === "oscuro" ? "dark" : theme === "claro" ? "light" : undefined;

  return (
    <html data-theme={dataTheme} lang="es">
      <body>
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  );
}
