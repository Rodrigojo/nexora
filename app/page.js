import { CAPABILITIES } from '../lib/core/capabilities.js';
import Chat from './Chat.js';

export default function Home() {
  const ativas = CAPABILITIES.filter((c) => c.status === 'ativa').length;
  return (
    <main>
      <img className="logo" src="/logo.svg" alt="NEXORA" />
      <h1>NEXORA</h1>
      <p className="slogan">Uma inteligência. Múltiplas possibilidades.</p>
      <Chat />
      <details className="status">
        <summary>Capacidades: {ativas} ativas de {CAPABILITIES.length}</summary>
        <ul>
          {CAPABILITIES.map((c) => (
            <li key={c.id}>
              <span>{String(c.id).padStart(2, '0')} · {c.nome}</span>
              <span className="tag">{c.status} · v{c.versao || 'base'}</span>
            </li>
          ))}
        </ul>
      </details>
    </main>
  );
}
