import './globals.css';

export const metadata = {
  title: 'NEXORA',
  description: 'Uma inteligência. Múltiplas possibilidades.',
  manifest: '/manifest.json',
  icons: { icon: '/icon-192.png', apple: '/icon-192.png' },
};
export const viewport = { themeColor: '#0B0B14', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
