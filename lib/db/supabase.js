// Cliente Supabase do navegador. A chave publicável é pública por design;
// a segurança vem das regras RLS (cada usuário só vê as próprias mensagens).
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = url && key ? createClient(url, key) : null;
