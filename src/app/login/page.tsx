import { configured, demoEnabled } from '@/lib/supabase';
import { LoginForm } from '@/components/login-form';
import Link from 'next/link';
import { GraduationCap, ShieldCheck, WifiOff, ScanLine } from 'lucide-react';
export const dynamic = 'force-dynamic';
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ access?: string }>;
}) {
  return (
    <main className="login-page">
      <section className="login-story">
        <div className="brand">
          <span className="brand-mark">
            <GraduationCap />
          </span>
          EduPass<span className="brand-dot">.</span>
        </div>
        <div>
          <span className="eyebrow">L’ÉCOLE, MIEUX CONNECTÉE</span>
          <h1>
            Chaque présence
            <br />
            compte.
          </h1>
          <p>
            Une vision claire de votre établissement.
            <br />
            Une expérience simple, du badge à la classe.
          </p>
          <div className="login-features">
            <span>
              <ScanLine /> Pointage NFC instantané
            </span>
            <span>
              <WifiOff /> Conçu pour fonctionner hors ligne
            </span>
            <span>
              <ShieldCheck /> Un espace de gestion sécurisé
            </span>
          </div>
        </div>
        <small>EduPass · Gestion intelligente des présences</small>
      </section>
      <section className="login-form">
        <div>
          <span className="eyebrow">ESPACE ADMINISTRATION</span>
          <h2>Bienvenue sur EduPass</h2>
          <p className="muted">Connectez-vous pour retrouver votre établissement.</p>
          {configured() ? (
            <LoginForm denied={(await searchParams).access === 'denied'} />
          ) : (
            <div className="setup-note">
              <h3>Connecter votre établissement</h3>
              <p>
                Renseignez les clés de votre nouveau projet Supabase dans <code>.env.local</code>,
                puis appliquez la migration et créez votre compte administrateur en suivant le
                README.
              </p>
              {demoEnabled() && (
                <Link href="/" className="button primary">
                  Explorer la démonstration
                </Link>
              )}
            </div>
          )}
          <p className="login-footer">Accès réservé aux membres autorisés de l’établissement.</p>
        </div>
      </section>
    </main>
  );
}
