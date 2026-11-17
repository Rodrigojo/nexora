'use client';
import { useEffect, useRef, useState } from 'react';
import Texto from './Texto';
import Conta from './Conta';
import { supabase } from '../lib/db/supabase.js';

const KEY = 'nexora_conversa';

export default function Chat() {
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [usuario, setUsuario] = useState(null);
  const end = useRef(null);

  // Sessão de login
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setUsuario(data.session?.user || null));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setUsuario(s?.user || null));
    return () => data.subscription.unsubscribe();
  }, []);

  // Carrega histórico: da nuvem se logado, senão do aparelho
  useEffect(() => {
    if (usuario) {
      supabase.from('mensagens').select('role, texto').order('criado_em', { ascending: false }).limit(40)
        .then(({ data }) => { if (data) setMsgs(data.reverse().map((m) => ({ role: m.role, text: m.texto }))); });
    } else {
      try { setMsgs(JSON.parse(localStorage.getItem(KEY)) || []); } catch { setMsgs([]); }
    }
  }, [usuario]);

  useEffect(() => {
    if (!usuario) { try { localStorage.setItem(KEY, JSON.stringify(msgs.slice(-40))); } catch {} }
    end.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs, usuario]);

  const salvar = (linhas) => {
    if (usuario) supabase.from('mensagens').insert(linhas).then(() => {});
  };

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
      if (d.resposta) {
        setMsgs([...next, { role: 'model', text: d.resposta }]);
        salvar([{ role: 'user', texto: t }, { role: 'model', texto: d.resposta }]);
      } else {
        setMsgs([...next, { role: 'model', text: d.erro, erro: true }]);
      }
    } catch {
      setMsgs([...next, { role: 'model', text: 'Sem conexão. Tente de novo.', erro: true }]);
    } finally { setBusy(false); }
  }

  async function novaConversa() {
    if (usuario) {
      if (!confirm('Apagar a conversa salva e começar outra?')) return;
      await supabase.from('mensagens').delete().eq('user_id', usuario.id);
    }
    setMsgs([]);
  }

  return (
    <section className="chat">
      <Conta usuario={usuario} />
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
      {msgs.length > 0 && <button className="limpar" onClick={novaConversa}>Nova conversa</button>}
    </section>
  );
}
