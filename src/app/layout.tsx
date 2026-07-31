import type { Metadata, Viewport } from "next";
import { Archivo, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

/* Manual, seção 05: grotesca neutra para tudo que fala, monoespaçada para
   tudo que mede. Duas famílias e ponto. */

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  weight: ["400", "500"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Obra Nova",
  description: "O acompanhamento semanal da sua obra, com foto e relato.",
  // O link circula por WhatsApp e carrega token. Nada disso vai para índice.
  robots: { index: false, follow: false, nocache: true },
  // Sem ícone e sem imagem de preview até a identidade do Obra Nova existir.
  // Os arquivos que estavam aqui eram de outro produto, e o cliente final abre
  // este link no WhatsApp — preview com a marca errada é pior que sem preview.
  // Ao ter os assets: `icons` volta aqui e `images` volta no openGraph.
  openGraph: {
    title: "Obra Nova",
    description: "O acompanhamento semanal da sua obra, com foto e relato.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#f5f2ec",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${archivo.variable} ${plexMono.variable} h-full`}
    >
      <body className="altura-tela flex flex-col">{children}</body>
    </html>
  );
}
