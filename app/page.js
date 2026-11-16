import { CAPABILITIES } from '../lib/core/capabilities.js';

/** Etapa 1: tela inicial e painel de status real das capacidades.
 *  A conversa entra na etapa 2 (login e histórico) e na etapa 3 (API). */
export default function Home() {
  return (
    <main>
      <img className="logo" src="/logo.svg" alt="NEXORA" />
      <h1>NEXORA</h1>
      <p className="slogan">Uma inteligência. Múltiplas possibilidades.</p>
      <section className="status">
        <h2>Capacidades registradas: {CAPABILITIES.length}</h2>
        <ul>
          {CAPABILITIES.map((c) => (
            <li key={c.id}>
              <span>{String(c.id).padStart(2, '0')} · {c.nome}</span>
              <span className="tag">{c.status} · v{c.versao || 'base'}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
