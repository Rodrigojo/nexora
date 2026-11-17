'use client';
import { useEffect, useRef, useState } from 'react';
import Texto from './Texto';

const KEY = 'nexora_conversa';

export default function Chat() {
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const end = useRef(null);

  useEffect(() => {
    try { setMsgs(JSON.parse(localStorage.getItem(KEY)) || []); } catch {}
  }, []);
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(msgs.slice(-40))); } catch {}
    end.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs]);

  async function send(e) {
    e.preventDefault();
    const t = text.trim();
    if (!t || busy) return;
    const next = [...msgs, { role: 'user', text: t }];
    setMsgs(next); setText(''); setBusy(true);
    try {
      const r = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ history: next.filter((m) => !m.erro) }),
      });
      const d = await r.json();
      setMsgs([...next, d.resposta ? { role: 'model', text: d.resposta } : { role: 'model', text: d.erro, erro: true }]);
    } catch {
      setMsgs([...next, { role: 'model', text: 'Sem conexão. Tente de novo.', erro: true }]);
    } finally { setBusy(false); }
  }

  return (
    <section className="chat">
      <div className="msgs">
        {msgs.length === 0 && <p className="hint">Pergunte, peça um texto, um plano de estudos, um anúncio…</p>}
        {msgs.map((m, i) => (
          <div key={i} className={`msg ${m.role}${m.erro ? ' erro' : ''}`}>{m.role === 'model' && !m.erro ? <Texto texto={m.text} /> : m.text}</div>
        ))}
        {busy && <div className="msg model pensando">NEXORA está pensando…</div>}
        <div ref={end} />
      </div>
      <form onSubmit={send}>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} maxLength={4000}
          placeholder="Escreva sua mensagem" aria-label="Mensagem" />
        <button disabled={busy || !text.trim()}>Enviar</button>
      </form>
      {msgs.length > 0 && <button className="limpar" onClick={() => setMsgs([])}>Nova conversa</button>}
    </section>
  );
}
