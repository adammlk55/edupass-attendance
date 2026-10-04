'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { browserClient } from '@/lib/supabase-browser';

export function LoginForm({ denied }: { denied: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(
    denied
      ? 'Votre compte n’a pas encore accès à cet établissement. Contactez l’administrateur.'
      : '',
  );

  useEffect(() => setReady(true), []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setError('');
    try {
      const { data, error: authError } = await browserClient().auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (authError) {
        setError('Connexion refusée : ' + authError.message);
        return;
      }
      if (!data.session) {
        setError('La connexion n’a pas créé de session. Veuillez réessayer.');
        return;
      }
      // @supabase/ssr persists the auth cookies before this promise resolves.
      // Credentials never enter URLs, router state, or browser storage.
      setPassword('');
      setEmail('');
      router.replace('/dashboard');
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? 'Connexion impossible : ' + cause.message
          : 'Connexion impossible. Vérifiez votre connexion et réessayez.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form method="post" action="/login" onSubmit={handleSubmit} aria-busy={busy}>
      {/* No name attributes: a native fallback cannot serialize credentials.
          Disable controls until hydration has attached handleSubmit. */}
      <fieldset disabled={!ready || busy} className="login-fields">
        <label htmlFor="login-email">Adresse e-mail</label>
        <input
          id="login-email"
          required
          autoComplete="username"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="vous@etablissement.ma"
          aria-describedby={error ? 'login-error' : undefined}
        />
        <label htmlFor="login-password">Mot de passe</label>
        <input
          id="login-password"
          required
          autoComplete="current-password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Votre mot de passe"
          aria-describedby={error ? 'login-error' : undefined}
        />
        {error && (
          <p id="login-error" role="alert" className="error-message">
            {error}
          </p>
        )}
        <button type="submit" className="button primary" disabled={!ready || busy}>
          {!ready ? 'Initialisation…' : busy ? 'Connexion…' : 'Se connecter'}
          <span aria-hidden="true">→</span>
        </button>
      </fieldset>
      <noscript>
        Activez JavaScript pour vous connecter. Aucun identifiant ne sera envoyé dans l’URL.
      </noscript>
    </form>
  );
}
