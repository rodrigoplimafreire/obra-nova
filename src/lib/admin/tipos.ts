/**
 * O retorno de toda Server Action do painel.
 *
 * Vive num módulo sem `"use server"` de propósito: um arquivo de ações só pode
 * exportar funções assíncronas, então o tipo não cabe lá dentro.
 */
export type Resultado = { ok: boolean; erro?: string; link?: string };
