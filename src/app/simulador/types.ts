/*
 * Os tipos do pedido vivem num sítio só: src/components/pedido/types.ts.
 *
 * Havia duas cópias — esta e a de plataforma/pedir — que já tinham divergido
 * em vinte linhas: a da plataforma ganhara `valorDesejadoCliente`,
 * `precisaFatura` e `precisaGuiaTransporte`, e esta não. Como a diferença era
 * só de campos OPCIONAIS a mais, juntaram-se na versão maior sem partir nada.
 *
 * Este ficheiro fica a reexportar para os quarenta e tal sítios que importam
 * "@/app/simulador/types" continuarem a funcionar.
 */
export * from "@/components/pedido/types";
