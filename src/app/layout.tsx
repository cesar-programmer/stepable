import type { Metadata } from "next";

import "./styles.css";

export const metadata: Metadata = {
  title: "Stepable",
  description: "Onboarding interactivo y consultas sobre prácticas internas.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
