'use client';
import { useEffect, useRef, useState } from 'react';
import Texto from './Texto';
import Conta from './Conta';
import { supabase } from '../lib/db/supabase.js';

const KEY = 'nexora_conversa';
const novoId = () => (globalThis.crypto?.randomUUID?.() || `c${Date.now()}${Math.random().toString(36).slice(2)}`);

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

/** Botão 🔊 Ouvir: pede o áudio à NEXORA VOICE e toca no celular. */
function Ouvir({ texto, auto }) {
  const [estado, setEstado] = useState('');
  const [src, setSrc] = useState(null);
  const pedido = useRef(false);
  async function gerar() {
    if (pedido.current) return;
    pedido.current = true; setEstado('gerando');
    try {
      const r = await fetch('/api/voz', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ texto }) });
      const d = await r.json();
      if (d.audio) { setSrc(`data:${d.mime};base64,${d.audio}`); setEstado(''); }
      else { setEstado(d.codigo ? `${d.erro} (código: ${String(d.codigo).slice(0, 60)})` : d.erro); pedido.current = false; }
    } catch { setEstado('Sem conexão. Tente de novo.'); pedido.current = false; }
  }
  useEffect(() => { if (auto) gerar(); }, [auto]); // eslint-disable-line react-hooks/exhaustive-deps
  if (src) return <audio className="audio-msg" controls autoPlay src={src} />;
  return (
    <div className="ouvir">
      <button type="button" onClick={gerar} disabled={estado === 'gerando'}>{estado === 'gerando' ? 'Gerando áudio… (até 30 s)' : '🔊 Ouvir'}</button>
      {estado && estado !== 'gerando' && <span className="ouvir-erro">{estado}</span>}
    </div>
  );
}

export default function Chat() {
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [usuario, setUsuario] = useState(null);
  const [foto, setFoto] = useState(null);
  const [conversa, setConversa] = useState(() => novoId());
  const [lista, setLista] = useState(null); // conversas salvas (null = lista fechada)
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

  // Logado: cada visita começa uma conversa nova; as antigas ficam na lista "Conversas".
  // Sem login: uma conversa guardada só neste aparelho.
  useEffect(() => {
    setLista(null);
    if (usuario) { setConversa(novoId()); setMsgs([]); }
    else { try { setMsgs(JSON.parse(localStorage.getItem(KEY)) || []); } catch { setMsgs([]); } }
  }, [usuario]);

  async function abrirLista() {
    if (lista) { setLista(null); return; }
    setLista('carregando');
    const { data, error } = await supabase.from('mensagens').select('id, conversa, role, texto, criado_em')
      .order('id', { ascending: false }).limit(1000);
    if (error) { setLista([]); return; }
    const grupos = new Map();
    for (const m of data) {
      const g = grupos.get(m.conversa) || { conversa: m.conversa, quando: m.criado_em, titulo: '', n: 0 };
      g.n++;
      if (m.role === 'user') g.titulo = m.texto; // fica a 1ª pergunta (lista vem do fim para o começo)
      grupos.set(m.conversa, g);
    }
    setLista([...grupos.values()]);
  }

  async function abrirConversa(id) {
    const { data } = await supabase.from('mensagens').select('role, texto').eq('conversa', id)
      .order('id', { ascending: false }).limit(60);
    setConversa(id); setLista(null);
    setMsgs((data || []).reverse().map((m) => ({ role: m.role, text: m.texto })));
  }

  async function apagarConversa(id) {
    if (!confirm('Apagar esta conversa para sempre?')) return;
    await supabase.from('mensagens').delete().eq('conversa', id).eq('user_id', usuario.id);
    if (id === conversa) { setMsgs([]); setConversa(novoId()); }
    setLista((l) => (Array.isArray(l) ? l.filter((g) => g.conversa !== id) : l));
  }

  useEffect(() => {
    if (!usuario) { try { localStorage.setItem(KEY, JSON.stringify(msgs.slice(-40).map(({ preview, narrar, ...m }) => m))); } catch {} }
    end.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs, usuario]);

  const salvar = (linhas) => {
    if (usuario) supabase.from('mensagens').insert(linhas.map((l) => ({ ...l, conversa }))).then(() => {});
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
        setMsgs([...next, { role: 'model', text: d.resposta, narrar: d.capacidade === 9 }]);
        salvar([{ role: 'user', texto: tm }, { role: 'model', texto: d.resposta }]);
      } else {
        setMsgs([...next, { role: 'model', text: d.codigo ? `${d.erro} (código: ${String(d.codigo).slice(0, 60)})` : d.erro, erro: true }]);
      }
    } catch {
      setMsgs([...next, { role: 'model', text: 'Sem conexão. Tente de novo.', erro: true }]);
    } finally { setBusy(false); }
  }

  function novaConversa() {
    // Logado: a conversa atual continua salva na lista; só abre uma nova.
    if (!usuario && msgs.length && !confirm('Apagar esta conversa e começar outra?')) return;
    setMsgs([]); setConversa(novoId()); setLista(null);
  }

  return (
    <section className="chat">
      <Conta usuario={usuario} />
      {usuario && (
        <div className="barra-conversas">
          <button type="button" onClick={abrirLista}>{lista ? 'Fechar lista' : '📂 Conversas'}</button>
          <button type="button" onClick={novaConversa}>＋ Nova conversa</button>
        </div>
      )}
      {lista && (
        <div className="lista-conversas">
          {lista === 'carregando' && <p className="hint">Carregando…</p>}
          {Array.isArray(lista) && lista.length === 0 && <p className="hint">Nenhuma conversa salva ainda.</p>}
          {Array.isArray(lista) && lista.map((g) => (
            <div key={g.conversa} className={`item-conversa${g.conversa === conversa ? ' atual' : ''}`}>
              <button type="button" className="abrir" onClick={() => abrirConversa(g.conversa)}>
                <span className="titulo">{(g.titulo || 'Conversa').replace('📷 [foto] ', '📷 ').slice(0, 70)}</span>
                <span className="quando">{new Date(g.quando).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
              </button>
              <button type="button" className="apagar" onClick={() => apagarConversa(g.conversa)} aria-label="Apagar conversa">🗑</button>
            </div>
          ))}
        </div>
      )}
      <div className="msgs">
        {msgs.length === 0 && <p className="hint">Pergunte, peça um texto, um anúncio… ou toque em 📷 para analisar uma foto.</p>}
        {msgs.map((m, i) => (
          <div key={i} className={`msg ${m.role}${m.erro ? ' erro' : ''}`}>
            {m.preview && <img src={m.preview} alt="Foto enviada" className="foto-msg" />}
            {m.role === 'model' && !m.erro ? <Texto texto={m.text} /> : m.text}
            {m.role === 'model' && !m.erro && <Ouvir texto={m.text} auto={m.narrar} />}
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
      {!usuario && msgs.length > 0 && <button className="limpar" onClick={novaConversa}>Nova conversa</button>}
    </section>
  );
}
