"use client";

import { useEffect, useState } from "react";
import { CampoDeSenha } from "@/components/comum/campo-senha";
import { Girando } from "@/components/comum/esqueleto";
import { supabaseNavegador } from "@/lib/supabase/navegador";

type Estado = "verificando" | "pronto" | "sem-sessao" | "trocada";

/**
 * A segunda metade da recuperação de senha.
 *
 * Quem chega aqui veio de um link de e-mail. O `@supabase/ssr` lê o token que
 * o link carrega na própria URL e monta uma sessão temporária — é essa
 * sessão, e não uma senha, que autoriza a troca. Por isso a tela começa
 * "verificando": não dá para saber de cara se o link ainda vale.
 *
 * Ouvir `onAuthStateChange` em vez de checar a sessão uma vez só existe porque
 * o processamento do token na URL é assíncrono; checar a sessão no primeiro
 * render quase sempre pegaria o estado de antes dela existir.
 */
export function FormularioDeRedefinicao() {
  const [estado, setEstado] = useState<Estado>("verificando");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    const supabase = supabaseNavegador();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((evento, sessao) => {
      if (evento === "PASSWORD_RECOVERY") {
        setEstado("pronto");
      } else if (evento === "INITIAL_SESSION") {
        // O evento inicial já dispara com a sessão de recuperação pronta,
        // quando o link acabou de ser processado — não dá para esperar só o
        // PASSWORD_RECOVERY, que às vezes já passou antes deste componente
        // montar.
        setEstado(sessao ? "pronto" : "sem-sessao");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function trocar(evento: React.FormEvent) {
    evento.preventDefault();
    setSalvando(true);
    setErro(null);

    try {
      const { error } = await supabaseNavegador().auth.updateUser({
        password: senha,
      });

      if (error) {
        setErro(`Não consegui trocar a senha: ${error.message}`);
        setSalvando(false);
        return;
      }
    } catch (e) {
      setErro(
        `A conexão com o servidor falhou: ${e instanceof Error ? e.message : String(e)}`,
      );
      setSalvando(false);
      return;
    }

    setEstado("trocada");
    setSalvando(false);
  }

  if (estado === "verificando") {
    return (
      <div className="mt-8 flex items-center gap-3 text-sm text-concreto">
        <Girando />
        Conferindo o link…
      </div>
    );
  }

  if (estado === "sem-sessao") {
    return (
      <div className="mt-8 flex flex-col gap-4">
        <p className="aviso aviso-erro text-sm">
          Este link não vale mais, ou já foi usado. Peça um novo na tela de
          entrada.
        </p>
        <a href="/admin/login" className="btn btn-campo btn-primario w-full">
          Voltar para entrar
        </a>
      </div>
    );
  }

  if (estado === "trocada") {
    return (
      <div className="mt-8 flex flex-col gap-4">
        <p className="aviso aviso-ok text-sm text-tinta">
          Senha trocada. Já pode entrar com ela.
        </p>
        <a href="/admin" className="btn btn-campo btn-primario w-full">
          Ir para o painel
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={trocar} className="mt-8 flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="rotulo">Nova senha</span>
        <CampoDeSenha
          nome="senha"
          valor={senha}
          aoMudar={setSenha}
          autoComplete="new-password"
          minimo={6}
        />
        <span className="text-xs text-concreto">Pelo menos 6 caracteres.</span>
      </label>

      {erro && <p className="aviso aviso-erro text-sm">{erro}</p>}

      <button
        type="submit"
        disabled={salvando}
        className={`btn btn-campo mt-2 w-full ${salvando ? "btn-carregando" : "btn-primario"}`}
      >
        {salvando && <Girando />}
        {salvando ? "Salvando…" : "Trocar senha"}
      </button>
    </form>
  );
}
