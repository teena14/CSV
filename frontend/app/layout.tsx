import type { Metadata } from 'next';
import '../styles/globals.css';
import { ThemeProvider } from './providers/ThemeProvider';

export const metadata: Metadata = {
  title: 'GrowEasy — CSV Importer',
  description:
    'AI-powered CSV importer for GrowEasy CRM. Upload any CSV format and let AI map your fields.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
