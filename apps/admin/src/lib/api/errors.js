/** Friendly pt-BR message for an API failure. Never exposes raw errors. */
export function friendlyError(error) {
  const status = error?.status;
  if (status === 401) return 'Sua sessão expirou. Entre novamente.';
  if (status === 403) return 'Você não tem permissão para esta ação.';
  if (status === 404) return 'Este recurso ainda não está disponível no servidor.';
  if (status === 409 || status === 400 || status === 422) {
    const msg = error?.data?.message ?? error?.message;
    const text = Array.isArray(msg) ? msg.join(' ') : msg;
    if (text && typeof text === 'string' && !text.startsWith('Request failed')) return text;
    return 'Não foi possível concluir a ação. Verifique os dados e tente novamente.';
  }
  if (status === 429) return 'Muitas requisições. Aguarde um instante e tente de novo.';
  if (status >= 500) return 'O servidor teve um problema ao processar o pedido. Tente novamente em instantes.';
  if (error instanceof TypeError) return 'Não foi possível conectar ao servidor. Verifique sua conexão.';
  return 'Algo deu errado. Tente novamente.';
}
