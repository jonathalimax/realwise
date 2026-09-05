# Premium Stripe Gate Design

**Contexto**

O estado atual deste repo ainda mistura a landing antiga com checkout via Mercado Pago e flags de feature que simplesmente escondem partes premium. A decisão validada para o Realwise agora e:

- entrada manual e uso basico devem continuar livres
- a conversao principal da landing deve ser "comecar a usar", nao "comprar"
- quando uma feature premium estiver bloqueada, o app deve explicar isso em pt-BR
- o upgrade deve ir para Stripe, priorizando Apple Pay / Google Pay quando disponiveis e mantendo cartao no proprio Stripe como fallback

**Abordagem recomendada**

1. Trocar os CTAs principais da landing de `/checkout` para `/login`, reforcando o modelo gratis + premium.
2. Manter `/checkout` como rota de upgrade premium, agora orientada a Stripe.
3. Introduzir um gate premium em pt-BR para features desligadas por flag, em vez de simplesmente sumir com a rota.
4. Centralizar a montagem da URL de checkout Stripe em um helper que aceite prefill de email, nome e cupom quando esses dados ja existirem.

**Escopo deste refactor**

- landing com proposta atualizada para gratis + premium
- checkout premium em pt-BR
- gate premium em pt-BR para rotas desligadas por flag
- prefill de dados conhecidos do usuario no handoff para o Stripe

**Dependencia externa**

Este repo nao contem hoje o backend responsavel por criar sessoes Stripe dinamicas. Portanto, a integracao local vai assumir uma URL de checkout/pagamento Stripe ja configurada fora do codigo, exposta por variavel de ambiente ou config publica do cliente.

**Resultado esperado**

O usuario entra pelo fluxo gratis, entende claramente o que continua livre e o que e premium, e quando tenta acessar uma funcionalidade premium bloqueada encontra um paywall em pt-BR com CTA direto para o checkout Stripe.
