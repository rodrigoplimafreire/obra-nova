"use client";

import { useState } from "react";
import { CampoDeSenha } from "@/components/comum/campo-senha";
import { Girando } from "@/components/comum/esqueleto";
import { sessaoVisivelNoServidor } from "@/lib/admin/acoes-sessao";
import { supabaseNavegador } from "@/lib/supabase/navegador";

export function FormularioDeLogin({
  aoPedirCadastro,
  aoPedirRecuperacao,
}: {
  aoPedirCadastro: () => void;
  aoPedirRecuperacao: () => void;
}) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [entrando, setEntrando] = useState(false);

  async function entrar(evento: React.FormEvent) {
    evento.preventDefault();
    setEntrando(true);
    setErro(null);

    // Erro de credencial é o único que vira mensagem genérica: dizer "este
    // e-mail não existe" entregaria a lista de contas de quem tenta adivinhar.
    //
    // Qualquer OUTRA falha é mostrada como veio. Mascarar tudo como senha
    // errada foi o que fez a gente perder horas procurando no lugar errado:
    // problema de rede, de chave e de configuração ficavam indistinguíveis de
    // um dedo trocado no teclado.
    try {
      const { error } = await supabaseNavegador().auth.signInWithPassword({
        email: email.trim(),
        password: senha,
      });

      if (error) {
        const credencial =
          error.code === "invalid_credentials" || error.status === 400;
        setErro(
          credencial
            ? "E-mail ou senha incorretos."
            : `Não consegui entrar: ${error.message}${error.code ? ` (${error.code})` : ""}`,
        );
        setEntrando(false);
        return;
      }
    } catch (e) {
      // `signInWithPassword` só rejeita quando nem chegou a falar com o
      // servidor — chave malformada, DNS, CORS, offline.
      setErro(
        `A conexão com o servidor falhou: ${e instanceof Error ? e.message : String(e)}`,
      );
      setEntrando(false);
      return;
    }

    // O cookie foi gravado no navegador; a pergunta agora é se o servidor o
    // recebe. Sem esta checagem, uma sessão invisível do outro lado devolveria
    // a pessoa para cá em silêncio, sem nada na tela para explicar.
    const sessao = await sessaoVisivelNoServidor();

    if (!sessao.visivel) {
      setErro(
        "Entrei no Supabase, mas o servidor não recebeu a sessão. Se o navegador estiver bloqueando cookies deste site, libere e tente de novo.",
      );
      setEntrando(false);
      return;
    }

    if (!sessao.naAllowlist) {
      setErro(
        `A conta ${sessao.email} não está na lista de acesso do painel deste ambiente.`,
      );
      setEntrando(false);
      return;
    }

    // Navegação dura, não `router.push`.
    //
    // O roteador do Next guarda em cache a resposta RSC de cada rota. `/admin`
    // já tinha sido visitada nesta aba — deslogada, respondendo com o desvio
    // para o login. Entrar e navegar por dentro do roteador servia justamente
    // essa cópia velha, e a pessoa voltava para a tela de login como se nada
    // tivesse acontecido. Daí o "sair e entrar de novo para avançar": a
    // segunda tentativa vinha depois de um recarregamento que limpava o cache.
    //
    // Um carregamento completo custa alguns décimos e acontece uma vez por
    // sessão. Vale a troca por não depender de corrida entre cache e cookie.
    window.location.assign("/admin");
  }

  return (
    <form onSubmit={entrar} className="mt-8 flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="rotulo">E-mail</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
          required
          className="campo campo-escuro"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="rotulo">Senha</span>
        <CampoDeSenha
          nome="senha"
          valor={senha}
          aoMudar={setSenha}
          autoComplete="current-password"
        />
      </label>

      <button
        type="button"
        onClick={aoPedirRecuperacao}
        className="acao-texto self-start text-concreto"
      >
        Esqueci minha senha
      </button>

      {erro && <p className="aviso aviso-erro text-sm">{erro}</p>}

      {/* Primário no tamanho campo, o mesmo do canteiro. Antes daqui saía uma
          variante própria: fundo de papel, pílula e o amarelo reduzido a um
          disco — nada disso está no sistema. */}
      <button
        type="submit"
        disabled={entrando}
        className={`btn btn-campo mt-2 w-full ${entrando ? "btn-carregando" : "btn-primario"}`}
      >
        {entrando && <Girando />}
        {entrando ? "Entrando…" : "Entrar"}
      </button>

      <p className="mt-2 text-center text-sm text-concreto">
        Não tem conta?{" "}
        <button
          type="button"
          onClick={aoPedirCadastro}
          className="font-semibold text-papel underline underline-offset-2"
        >
          Criar uma
        </button>
      </p>
    </form>
  );
}
