import Link from 'next/link';
export default function NotFound() {
  return (
    <main className="standalone">
      <div className="panel setup">
        <h1>Page introuvable</h1>
        <p>Cette page n’existe pas ou n’est plus disponible.</p>
        <Link className="button primary" href="/">
          Retour au tableau de bord
        </Link>
      </div>
    </main>
  );
}
