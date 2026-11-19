'use client';
import { useEffect, useRef, useState } from 'react';
import Texto from './Texto';
import Conta from './Conta';
import { supabase } from '../lib/db/supabase.js';

const KEY = 'nexora_conversa';

/** Reduz a foto no aparelho (máx. 1024 px, JPEG) para enviar rápido e caber no limite. */
function reduzirFoto(file) {
  return new Promise((ok, falha) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, 1024 / Math.max(img.width, img.height));
      const cv = document.createElement('canvas');
      cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(url);
      const dataUrl = cv.toDataURL('image/jpeg', 0.85);
      ok({ mime: 'image/jpeg', data: dataUrl.split(',')[1], preview: dataUrl });
    };
    img.onerror = () => { URL.revokeObjectURL(url); falha(new Error('foto')); };
    img.src = url;
  });
}

export default function Chat() {
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [usuario, setUsuario] = useState(null);
  const [foto, setFoto] = useState(null);
  const end = useRef(null);
  const arquivo = useRef(null);

  async function escolherFoto(e) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try { setFoto(await reduzirFoto(f)); } catch { alert('Não consegui abrir essa foto. Tente outra.'); }
  }

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
    if (!usuario) { try { localStorage.setItem(KEY, JSON.stringify(msgs.slice(-40).map(({ preview, ...m }) => m))); } catch {} }
    end.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs, usuario]);

  const salvar = (linhas) => {
    if (usuario) supabase.from('mensagens').insert(linhas).then(() => {});
  };

  async function send(e) {
    e.preventDefault();
    const img = foto;
    const t = text.trim() || (img ? 'O que tem nesta foto?' : '');
    if (!t || busy) return;
    const tm = img ? `📷 [foto] ${t}` : t;
    const next = [...msgs, { role: 'user', text: tm, preview: img?.preview }];
    setMsgs(next); setText(''); setFoto(null); setBusy(true);
    try {
      const hist = next.filter((m) => !m.erro).map((m) => ({ role: m.role, text: m.text }));
      const r = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ history: hist, imagem: img ? { mime: img.mime, data: img.data } : undefined }),
      });
      const d = await r.json();
      if (d.resposta) {
        setMsgs([...next, { role: 'model', text: d.resposta }]);
        salvar([{ role: 'user', texto: tm }, { role: 'model', texto: d.resposta }]);
      } else {
        setMsgs([...next, { role: 'model', text: d.codigo ? `${d.erro} (código: ${String(d.codigo).slice(0, 60)})` : d.erro, erro: true }]);
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
        {msgs.length === 0 && <p className="hint">Pergunte, peça um texto, um anúncio… ou toque em 📷 para analisar uma foto.</p>}
        {msgs.map((m, i) => (
          <div key={i} className={`msg ${m.role}${m.erro ? ' erro' : ''}`}>
            {m.preview && <img src={m.preview} alt="Foto enviada" className="foto-msg" />}
            {m.role === 'model' && !m.erro ? <Texto texto={m.text} /> : m.text}
          </div>
        ))}
        {busy && <div className="msg model pensando">NEXORA está pensando…</div>}
        <div ref={end} />
      </div>
      {foto && (
        <div className="foto-previa">
          <img src={foto.preview} alt="Foto escolhida" />
          <button type="button" onClick={() => setFoto(null)}>Remover foto</button>
        </div>
      )}
      <form onSubmit={send}>
        <input ref={arquivo} type="file" accept="image/*" hidden onChange={escolherFoto} />
        <button type="button" className="botao-foto" onClick={() => arquivo.current?.click()} disabled={busy} aria-label="Enviar foto">📷</button>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} maxLength={4000}
          placeholder={foto ? "Pergunte sobre a foto (opcional)" : "Escreva sua mensagem"} aria-label="Mensagem" />
        <button disabled={busy || (!text.trim() && !foto)}>Enviar</button>
      </form>
      {msgs.length > 0 && <button className="limpar" onClick={novaConversa}>Nova conversa</button>}
    </section>
  );
}
