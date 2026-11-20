'use client';
import { useEffect, useRef, useState } from 'react';
import Texto from './Texto';
import Conta from './Conta';
import { supabase } from '../lib/db/supabase.js';
import { pedidoSalvarProduto, acharProduto } from '../lib/core/produtos.js';

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
      // Cópia pequena (até 510 px) para a IA de imagem usar a foto como base (exigência do modelo).
      const k2 = Math.min(1, 510 / Math.max(img.width, img.height));
      const cv2 = document.createElement('canvas');
      cv2.width = Math.round(img.width * k2); cv2.height = Math.round(img.height * k2);
      cv2.getContext('2d').drawImage(img, 0, 0, cv2.width, cv2.height);
      const ref = cv2.toDataURL('image/jpeg', 0.9).split(',')[1];
      ok({ mime: 'image/jpeg', data: dataUrl.split(',')[1], ref, preview: dataUrl });
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
  const [produtos, setProdutos] = useState([]); // catálogo: [{id, nome, foto}]
  const [verProdutos, setVerProdutos] = useState(false);
  const end = useRef(null);
  const arquivo = useRef(null);
  const [audio, setAudio] = useState(null); // { mime, data, segundos, url }
  const [gravando, setGravando] = useState(0); // segundos gravados (0 = parado)
  const gravador = useRef(null);

  async function gravar() {
    if (gravador.current) { gravador.current.stop(); return; }
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch (err) {
      const n = err?.name || 'erro';
      const msg = n === 'NotAllowedError' ? 'O microfone foi negado. Toque no ícone ao lado do endereço e permita o Microfone.'
        : n === 'NotReadableError' ? 'O microfone está sendo usado por outro app (ligação, gravador ou fone Bluetooth). Feche-o e tente de novo.'
        : n === 'NotFoundError' ? 'Não achei nenhum microfone no aparelho.'
        : 'Não consegui abrir o microfone.';
      alert(`${msg} (código: ${n})`); return;
    }
    const tipo = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg'].find((t) => window.MediaRecorder?.isTypeSupported?.(t)) || '';
    const rec = new MediaRecorder(stream, tipo ? { mimeType: tipo } : undefined);
    const partes = [];
    const inicio = Date.now();
    const relogio = setInterval(() => {
      const s = Math.round((Date.now() - inicio) / 1000);
      setGravando(Math.max(1, s));
      if (s >= 60) rec.stop(); // máximo 1 minuto
    }, 500);
    rec.ondataavailable = (e) => { if (e.data.size) partes.push(e.data); };
    rec.onstop = () => {
      clearInterval(relogio); stream.getTracks().forEach((t) => t.stop());
      gravador.current = null; setGravando(0);
      const blob = new Blob(partes, { type: (rec.mimeType || tipo || 'audio/webm').split(';')[0] });
      const segundos = Math.max(1, Math.round((Date.now() - inicio) / 1000));
      const leitor = new FileReader();
      leitor.onload = () => setAudio({ mime: blob.type, data: String(leitor.result).split(',')[1], segundos, url: URL.createObjectURL(blob) });
      leitor.readAsDataURL(blob);
    };
    gravador.current = rec; setGravando(1); rec.start();
  }

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
    if (usuario) {
      setConversa(novoId()); setMsgs([]);
      supabase.from('produtos').select('id, nome, foto').order('id').then(({ data }) => setProdutos(data || []));
    } else {
      setProdutos([]);
      try { setMsgs(JSON.parse(localStorage.getItem(KEY)) || []); } catch { setMsgs([]); }
    }
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
    if (!usuario) { try { localStorage.setItem(KEY, JSON.stringify(msgs.slice(-40).map(({ preview, narrar, somUrl, gerada, ...m }) => m))); } catch {} }
    end.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs, usuario]);

  const salvar = (linhas) => {
    if (usuario) supabase.from('mensagens').insert(linhas.map((l) => ({ ...l, conversa }))).then(() => {});
  };

  async function apagarProduto(p) {
    if (!confirm(`Apagar o produto "${p.nome}"?`)) return;
    await supabase.from('produtos').delete().eq('id', p.id);
    setProdutos((l) => l.filter((x) => x.id !== p.id));
  }

  async function send(e) {
    e.preventDefault();
    let img = foto;
    const som = audio;
    if (som && !busy) { enviarAudio(som); return; }
    const t = text.trim() || (img ? 'O que tem nesta foto?' : '');
    if (!t || busy) return;
    // Catálogo: "salve como Essencial" com foto guarda o produto.
    const nomeNovo = img && pedidoSalvarProduto(t);
    if (nomeNovo) {
      const eu = { role: 'user', text: `📷 [foto] ${t}`, preview: img.preview };
      if (!usuario) { setMsgs([...msgs, eu, { role: 'model', text: 'Entre na sua conta para salvar produtos.', erro: true }]); setText(''); setFoto(null); return; }
      setBusy(true); setText(''); setFoto(null);
      const velho = produtos.find((p) => p.nome.toLowerCase() === nomeNovo.toLowerCase());
      if (velho) await supabase.from('produtos').delete().eq('id', velho.id);
      const { data, error } = await supabase.from('produtos').insert({ nome: nomeNovo, foto: img.ref }).select('id, nome, foto').single();
      setBusy(false);
      if (error) { setMsgs([...msgs, eu, { role: 'model', text: `Não consegui salvar o produto. (código: ${String(error.message).slice(0, 60)})`, erro: true }]); return; }
      setProdutos((l) => [...l.filter((p) => p.id !== velho?.id), data]);
      setMsgs([...msgs, eu, { role: 'model', text: `✅ Produto **${data.nome}** salvo. Agora é só pedir, por exemplo: "crie uma imagem do ${data.nome} na praia".` }]);
      return;
    }
    // Pedido de imagem que cita um produto salvo: usa a foto dele como base.
    let produto = null;
    if (!img && produtos.length) {
      const nome = acharProduto(t, produtos.map((p) => p.nome));
      produto = nome && produtos.find((p) => p.nome === nome);
      if (produto) img = { mime: 'image/jpeg', data: produto.foto, ref: produto.foto, produto: true };
    }
    const tm = img && !produto ? `📷 [foto] ${t}` : t;
    const next = [...msgs, { role: 'user', text: tm, preview: img?.preview }];
    setMsgs(next); setText(''); setFoto(null); setBusy(true);
    try {
      const hist = next.filter((m) => !m.erro).map((m) => ({ role: m.role, text: m.text }));
      const r = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ history: hist, imagem: img ? { mime: img.mime, data: img.data, ref: img.ref } : undefined, produto: produto?.nome }),
      });
      const d = await r.json();
      if (d.resposta) {
        const gerada = d.imagemGerada ? `data:${d.imagemGerada.mime};base64,${d.imagemGerada.imagem}` : null;
        setMsgs([...next, { role: 'model', text: d.resposta, narrar: d.capacidade === 9, gerada }]);
        salvar([{ role: 'user', texto: tm }, { role: 'model', texto: gerada ? '🖼️ [imagem criada]' : d.resposta }]);
      } else {
        setMsgs([...next, { role: 'model', text: d.codigo ? `${d.erro} (código: ${String(d.codigo).slice(0, 60)})` : d.erro, erro: true }]);
      }
    } catch {
      setMsgs([...next, { role: 'model', text: 'Sem conexão. Tente de novo.', erro: true }]);
    } finally { setBusy(false); }
  }

  async function enviarAudio(som) {
    const pedido = text.trim();
    const tm = `🎤 [áudio] ${pedido || 'Traduza este áudio'}`;
    const next = [...msgs, { role: 'user', text: tm, somUrl: som.url }];
    setMsgs(next); setText(''); setAudio(null); setBusy(true);
    try {
      const r = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ history: [{ role: 'user', text: tm }], audio: { mime: som.mime, data: som.data } }),
      });
      const d = await r.json();
      if (d.resposta) {
        setMsgs([...next, { role: 'model', text: d.resposta, fala: d.fala, narrar: Boolean(d.fala) }]);
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
          <button type="button" onClick={() => setVerProdutos((v) => !v)}>📦 Produtos</button>
        </div>
      )}
      {verProdutos && (
        <div className="lista-conversas">
          {produtos.length === 0 && <p className="hint">Nenhum produto salvo. Toque em 📷, escolha a foto do produto e escreva: salve como Essencial</p>}
          {produtos.map((p) => (
            <div key={p.id} className="item-conversa">
              <div className="abrir produto"><img src={`data:image/jpeg;base64,${p.foto}`} alt="" /><span className="titulo">{p.nome}</span></div>
              <button type="button" className="apagar" onClick={() => apagarProduto(p)} aria-label="Apagar produto">🗑</button>
            </div>
          ))}
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
        {msgs.length === 0 && <p className="hint">Pergunte, peça um texto, um anúncio… peça "crie uma imagem de…" toque em 📷 para analisar uma foto, ou em 🎤 para gravar um áudio e traduzir.</p>}
        {msgs.map((m, i) => (
          <div key={i} className={`msg ${m.role}${m.erro ? ' erro' : ''}`}>
            {m.preview && <img src={m.preview} alt="Foto enviada" className="foto-msg" />}
            {m.somUrl && <audio className="audio-msg" controls src={m.somUrl} />}
            {m.role === 'model' && !m.erro ? <Texto texto={m.text} /> : m.text}
            {m.gerada && (
              <a href={m.gerada} download="nexora-imagem.jpg">
                <img src={m.gerada} alt="Imagem criada pela NEXORA" className="imagem-gerada" />
              </a>
            )}
            {m.role === 'model' && !m.erro && !m.gerada && <Ouvir texto={m.fala || m.text} auto={m.narrar} />}
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
      {(audio || gravando > 0) && (
        <div className="foto-previa">
          {gravando > 0 ? <span>🔴 Gravando… {gravando}s (máx. 60s)</span> : <audio controls src={audio.url} />}
          {audio && <button type="button" onClick={() => setAudio(null)}>Apagar</button>}
        </div>
      )}
      <form onSubmit={send}>
        <input ref={arquivo} type="file" accept="image/*" hidden onChange={escolherFoto} />
        <button type="button" className="botao-foto" onClick={() => arquivo.current?.click()} disabled={busy} aria-label="Enviar foto">📷</button>
        <button type="button" className="botao-foto" onClick={gravar} disabled={busy} aria-label="Gravar áudio">{gravando ? '⏹' : '🎤'}</button>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} maxLength={4000}
          placeholder={audio ? 'Para qual língua? (ex.: espanhol) ou só toque em Enviar' : foto ? 'Pergunte sobre a foto, ou peça: coloque numa mesa com flores' : 'Escreva sua mensagem'} aria-label="Mensagem" />
        <button disabled={busy || gravando > 0 || (!text.trim() && !foto && !audio)}>Enviar</button>
      </form>
      {!usuario && msgs.length > 0 && <button className="limpar" onClick={novaConversa}>Nova conversa</button>}
    </section>
  );
}
