export function ClientConfigError({ error, onRetry, onGoToLogin }) {
  const isNotFound = error?.code === 'NOT_FOUND';
  const isBadPayloadOrUnknown = error?.code === 'BAD_PAYLOAD' || error?.code === 'UNKNOWN';

  let heading;
  let subtext;

  if (isNotFound) {
    heading = 'Cliente não encontrado';
    subtext = 'Verifique o endereço e tente novamente.';
  } else if (error?.code === 'TIMEOUT' || error?.code === 'HTTP_ERROR') {
    heading = 'Conexão lenta';
    subtext = 'Não foi possível carregar a configuração.';
  } else {
    heading = 'Erro ao carregar';
    subtext = 'Não foi possível carregar a configuração.';
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--rw-bg)]">
      <div className="p-8 rounded-2xl bg-[var(--rw-surface)] shadow-lg max-w-sm w-full mx-4">
        <h1 className="text-lg font-semibold text-[var(--rw-ink)] mb-2">
          {heading}
        </h1>
        <p className="text-sm text-[var(--rw-muted)] mb-6">
          {subtext}
        </p>
        <div className="flex flex-col gap-3">
          {isNotFound ? (
            <button
              onClick={onGoToLogin}
              className="bg-[var(--rw-brand)] hover:opacity-90 text-white rounded-xl px-5 py-2.5 text-sm font-medium"
            >
              Ir para o login
            </button>
          ) : isBadPayloadOrUnknown ? (
            <>
              <button
                onClick={onRetry}
                className="bg-[var(--rw-brand)] hover:opacity-90 text-white rounded-xl px-5 py-2.5 text-sm font-medium"
              >
                Tentar novamente
              </button>
              <button
                onClick={onGoToLogin}
                className="bg-[var(--rw-raised)] text-[var(--rw-ink)] rounded-xl px-5 py-2.5 text-sm font-medium"
              >
                Ir para o login
              </button>
            </>
          ) : (
            <button
              onClick={onRetry}
              className="bg-[var(--rw-brand)] hover:opacity-90 text-white rounded-xl px-5 py-2.5 text-sm font-medium"
            >
              Tentar novamente
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
