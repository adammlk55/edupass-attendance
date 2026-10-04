'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="standalone">
      <div className="panel setup">
        <h1>Connexion interrompue</h1>
        <p>
          Les données n’ont pas pu être chargées. Vérifiez la connexion et la configuration
          Supabase, puis réessayez.
        </p>
        <button className="button primary" onClick={reset}>
          Réessayer
        </button>
      </div>
    </main>
  );
}
