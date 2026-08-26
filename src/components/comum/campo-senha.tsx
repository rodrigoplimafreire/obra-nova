"use client";

import { useState } from "react";

/**
 * O campo de senha com olho, num lugar só.
 *
 * Existia triplicado em potencial — login, cadastro, redefinição — e cada
 * cópia é uma chance de uma delas ficar sem o olho. Ele existe porque senha
 * digitada às cegas no teclado do celular é a primeira causa de "senha
 * incorreta" que não era senha errada.
 */
export function CampoDeSenha({
  nome,
  valor,
  aoMudar,
  autoComplete,
  placeholder,
  minimo,
}: {
  nome: string;
  valor: string;
  aoMudar: (v: string) => void;
  autoComplete: "current-password" | "new-password";
  placeholder?: string;
  /** Comprimento mínimo do lado do navegador — o Supabase já valida no servidor. */
  minimo?: number;
}) {
  const [mostrar, setMostrar] = useState(false);

  return (
    <div className="relative flex items-center">
      <input
        name={nome}
        type={mostrar ? "text" : "password"}
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        autoComplete={autoComplete}
        placeholder={placeholder}
        minLength={minimo}
        required
        className="campo campo-escuro pr-12"
      />
      <button
        type="button"
        onClick={() => setMostrar((v) => !v)}
        aria-label={mostrar ? "Esconder a senha" : "Mostrar a senha"}
        aria-pressed={mostrar}
        className="absolute right-1.5 flex h-10 w-10 items-center justify-center rounded-sm text-cinza-400 transition hover:bg-white/8 hover:text-papel"
      >
        {mostrar ? <OlhoFechado /> : <Olho />}
      </button>
    </div>
  );
}

function Olho() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="h-5 w-5 fill-none stroke-current"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function OlhoFechado() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="h-5 w-5 fill-none stroke-current"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 3l18 18M10.6 10.6a3 3 0 0 0 4.2 4.2M9.4 5.2A9.7 9.7 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.5 6.6C3.8 8.3 2 12 2 12s3.5 7 10 7a9.9 9.9 0 0 0 3.4-.6" />
    </svg>
  );
}
