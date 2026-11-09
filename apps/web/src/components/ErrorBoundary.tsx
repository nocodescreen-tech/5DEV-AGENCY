import { Component, type ErrorInfo, type ReactNode } from 'react';

/**
 * Filet de sécurité : une erreur d'exécution ne doit jamais laisser un écran vide.
 * On affiche un message lisible, la cause technique repliée, et deux issues :
 * recharger, ou réinitialiser les préférences locales (thème corrompu = écran noir).
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  override state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    // trace conservée pour le diagnostic, sans exposer de données utilisateur
    console.error('5DEV — erreur de rendu :', error.message, info.componentStack?.slice(0, 400));
  }

  private reinitialiser = () => {
    try {
      localStorage.removeItem('five.theme');
    } catch {
      /* stockage indisponible */
    }
    window.location.reload();
  };

  override render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-4 px-6 py-16">
        <p className="eyebrow text-brand">Affichage interrompu</p>
        <h1 className="text-2xl font-black">La page n’a pas pu s’afficher.</h1>
        <p className="text-sm text-muted">
          Une erreur est survenue dans le navigateur. Vos données ne sont pas concernées : rechargez la
          page. Si l’écran reste vide, réinitialisez les préférences d’affichage.
        </p>
        <div className="flex flex-wrap gap-3">
          <button type="button" className="btn-primary" onClick={() => window.location.reload()}>
            Recharger la page
          </button>
          <button type="button" className="btn-ghost" onClick={this.reinitialiser}>
            Réinitialiser l’affichage
          </button>
        </div>
        <details className="text-xs text-muted">
          <summary className="cursor-pointer">Détail technique</summary>
          <pre className="mt-2 overflow-auto rounded-lg bg-wash p-3 text-[11px]">{error.message}</pre>
        </details>
      </div>
    );
  }
}
