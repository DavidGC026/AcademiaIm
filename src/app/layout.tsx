import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Diplomado IMCYC - LMS Diplomados del Cemento y Concreto',
  description: 'Plataforma educativa para profesionales de la construcción e industria del concreto en México.',
};

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <head>
        {basePath ? (
          <script
            dangerouslySetInnerHTML={{
              __html: `
                (function() {
                  const basePath = ${JSON.stringify(basePath)};
                  const originalFetch = window.fetch;
                  window.fetch = function(input, init) {
                    if (typeof input === 'string') {
                      if (input.startsWith('/api/') || input.startsWith('/uploads/')) {
                        input = basePath + input;
                      }
                    }
                    return originalFetch(input, init);
                  };
                })();
              `,
            }}
          />
        ) : null}
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
