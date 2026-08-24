import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';

export const metadata: Metadata = {
  title: 'SkillSwap Campus — Students exchange skills instead of money',
  description: 'A decentralized, ML-ranked, peer-to-peer campus learning economy with verifiable credentials, escrow settlement, and zero-fee Skill Credits.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-dark-bg text-slate-100 min-h-screen flex flex-col antialiased selection:bg-brand-500 selection:text-dark-bg">
        <AuthProvider>
          <Navbar />
          <main className="flex-1">
            {children}
          </main>
          <Footer />
        </AuthProvider>
      </body>
    </html>
  );
}
