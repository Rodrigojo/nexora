'use client';
import { useState } from 'react';
import { supabase } from '../lib/db/supabase.js';

const traduz = (m = '') => {
  if (/invalid login/i.test(m)) return 'E-mail ou senha incorretos.';
  if (/not confirmed/i.test(m)) return 'Confirme seu e-mail pelo link que enviamos antes de entrar.';
  if (/already registered/i.test(m)) return 'Esse e-mail já tem conta. Toque em Entrar.';
  if (/at least 6/i.test(m)) return 'A senha precisa ter pelo menos 6 caracteres.';
  if (/rate limit/i.test(m)) return 'Muitas tentativas. Espere um pouco e tente de novo.';
  return 'Não deu certo agora. Tente de novo.';
};

export default function Conta({ usuario }) {
  const [aberto, setAberto] = useState(false);
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [aviso, setAviso] = useState('');
  const [busy, setBusy] = useState(false);

  if (!supabase) return null;
  if (usuario) {
    return (
      <div className="conta">
        <span>Conectado: {usuario.email} · conversas salvas</span>
        <button onClick={() => supabase.auth.signOut()}>Sair</button>
      </div>
    );
  }
  if (!aberto) {
    return (
      <div className="conta">
        <span>Entre para salvar suas conversas.</span>
        <button onClick={() => setAberto(true)}>Entrar</button>
      </div>
    );
  }

  async function agir(tipo) {
    setBusy(true); setAviso('');
    const dados = { email: email.trim(), password: senha };
    const r = tipo === 'entrar'
      ? await supabase.auth.signInWithPassword(dados)
      : await supabase.auth.signUp({ ...dados, options: { emailRedirectTo: window.location.origin } });
    setBusy(false);
    if (r.error) return setAviso(traduz(r.error.message));
    if (tipo === 'criar' && !r.data.session) setAviso('Conta criada! Abra seu e-mail e toque no link de confirmação.');
  }

  return (
    <form className="conta form" onSubmit={(e) => { e.preventDefault(); agir('entrar'); }}>
      <input type="email" placeholder="Seu e-mail" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
      <input type="password" placeholder="Senha (mínimo 6)" value={senha} onChange={(e) => setSenha(e.target.value)} required minLength={6} autoComplete="current-password" />
      <div className="botoes">
        <button disabled={busy}>Entrar</button>
        <button type="button" disabled={busy} onClick={() => agir('criar')}>Criar conta</button>
        <button type="button" className="limpar" onClick={() => setAberto(false)}>Cancelar</button>
      </div>
      {aviso && <p className="aviso">{aviso}</p>}
    </form>
  );
}
