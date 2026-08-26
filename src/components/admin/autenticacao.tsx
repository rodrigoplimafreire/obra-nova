"use client";

import { useState } from "react";
import { FormularioDeCadastro } from "./formulario-cadastro";
import { FormularioDeLogin } from "./formulario-login";
import { FormularioDeRecuperacao } from "./formulario-recuperar";

type Modo = "entrar" | "cadastrar" | "recuperar";

const TITULO: Record<Modo, string> = {
  entrar: "Entrar",
  cadastrar: "Criar conta",
  recuperar: "Recuperar senha",
};

/**
 * Os três modos da porta de entrada, num componente só.
 *
 * Um switch de estado local, não três rotas: trocar de "entrar" para
 * "esqueci a senha" não deveria custar uma navegação — é a mesma pessoa, no
 * mesmo lugar, mudando de ideia sobre qual formulário preencher.
 */
export function Autenticacao() {
  const [modo, setModo] = useState<Modo>("entrar");

  return (
    <>
      <h1 className="mt-3 font-sans text-4xl leading-[0.95] font-extrabold -tracking-[0.03em] text-papel">
        {TITULO[modo]}
      </h1>

      {modo === "entrar" && (
        <FormularioDeLogin
          aoPedirCadastro={() => setModo("cadastrar")}
          aoPedirRecuperacao={() => setModo("recuperar")}
        />
      )}
      {modo === "cadastrar" && (
        <FormularioDeCadastro aoVoltar={() => setModo("entrar")} />
      )}
      {modo === "recuperar" && (
        <FormularioDeRecuperacao aoVoltar={() => setModo("entrar")} />
      )}
    </>
  );
}
