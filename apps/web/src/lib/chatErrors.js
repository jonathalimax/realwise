/**
 * Every chat failure is shown as a friendly pt-BR message from John, never as technical text.
 * The server already sends pt-BR for the codes it knows; anything else is mapped here by status.
 */
export function friendlyChatError(error, fallback) {
  const status = error?.status;
  const code = error?.data?.code;
  if (code && error?.message) return error.message; // TRIAL_LIMIT, MONTHLY_LIMIT, SUBSCRIPTION_REQUIRED: server wording
  if (status === 402) return 'Seu teste terminou. Assine um plano para continuar conversando com o John.';
  if (status === 413) return 'Esse arquivo é grande demais. Envie arquivos de até 15 MB.';
  if (status === 429) return 'Estou recebendo muitos pedidos agora. Espere um pouquinho e tente de novo.';
  if (status === 401 || status === 403) return 'Sua sessão expirou. Entre de novo para continuarmos.';
  if (status && status >= 400 && status < 500) return fallback || 'Não consegui entender esse pedido. Pode tentar de novo?';
  if (status && status >= 500) return 'Tive um tropeço aqui e não consegui terminar. Pode tentar de novo em instantes?';
  // No status: the request never reached the server (offline, dropped connection).
  return 'Parece que a conexão falhou. Confira sua internet e tente de novo, que eu estou por aqui.';
}
