import { InvoicingEnvironment, ProviderResult } from './invoicing.types';

/** Network trouble or a 5xx: safe to try again later, the nota was not created. */
export class TransientProviderError extends Error {}

const HOSTS: Record<InvoicingEnvironment, string> = {
  producao: 'https://api.focusnfe.com.br',
  homologacao: 'https://homologacao.focusnfe.com.br',
};

interface FocusError {
  codigo?: string;
  mensagem?: string;
  correcao?: string;
}

interface FocusBody extends FocusError {
  status?: string;
  numero?: string;
  codigo_verificacao?: string;
  data_emissao?: string;
  url?: string;
  url_danfse?: string;
  caminho_xml_nota_fiscal?: string;
  erros?: FocusError[];
}

const describe = (e: FocusError): string => [e.codigo, e.mensagem, e.correcao].filter(Boolean).join(' · ');

/** Adapter for the Focus NFe REST API (https://doc.focusnfe.com.br). One instance per token + environment. */
export class FocusNfeProvider {
  private readonly host: string;

  constructor(
    private readonly token: string,
    readonly environment: InvoicingEnvironment,
  ) {
    this.host = HOSTS[environment];
  }

  private async call(method: string, path: string, body?: unknown): Promise<{ status: number; json: FocusBody }> {
    let res: Response;
    try {
      res = await fetch(`${this.host}${path}`, {
        method,
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.token}:`).toString('base64')}`,
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(30_000),
      });
    } catch (e) {
      throw new TransientProviderError(`Emissor indisponível: ${(e as Error).message}`);
    }
    if (res.status >= 500) throw new TransientProviderError(`Emissor respondeu ${res.status}.`);
    const text = await res.text();
    let json: FocusBody = {};
    try {
      json = text ? (JSON.parse(text) as FocusBody) : {};
    } catch {
      json = { mensagem: text.slice(0, 300) };
    }
    return { status: res.status, json };
  }

  private fullUrl(path?: string): string | undefined {
    if (!path) return undefined;
    return /^https?:\/\//.test(path) ? path : `${this.host}${path}`;
  }

  private toResult(body: FocusBody): ProviderResult {
    switch (body.status) {
      case 'autorizado':
        return this.issued(body, 'issued');
      case 'cancelado':
        return this.issued(body, 'canceled');
      case 'erro_autorizacao':
        return { state: 'error', error: (body.erros ?? []).map(describe).join(' | ') || 'A Prefeitura recusou a nota.' };
      case 'erro_cancelamento':
        return { state: 'error', error: (body.erros ?? []).map(describe).join(' | ') || 'Cancelamento recusado.' };
      default:
        return { state: 'processing' };
    }
  }

  private issued(body: FocusBody, state: 'issued' | 'canceled'): ProviderResult {
    return {
      state,
      number: body.numero,
      verificationCode: body.codigo_verificacao,
      url: body.url,
      pdfUrl: body.url_danfse,
      xmlPath: this.fullUrl(body.caminho_xml_nota_fiscal),
      issuedAt: body.data_emissao ? new Date(body.data_emissao) : undefined,
    };
  }

  /** Queues the nota. The reference makes this idempotent: a repeated ref answers `nfe_autorizada`, not a second nota. */
  async emit(ref: string, payload: unknown): Promise<ProviderResult> {
    const { status, json } = await this.call('POST', `/v2/nfse?ref=${encodeURIComponent(ref)}`, payload);
    if (status === 201 || status === 202) return { state: 'processing' };
    if (status === 422 && json.codigo === 'nfe_autorizada') return this.consult(ref);
    if (status === 401) return { state: 'error', error: 'Token do emissor recusado (401). Confira o token e o ambiente.' };
    return { state: 'error', error: describe(json) || `Emissor recusou a nota (HTTP ${status}).` };
  }

  /** Current state of a nota. `null` when the emitter has never heard of the reference. */
  async consult(ref: string): Promise<ProviderResult | null> {
    const { status, json } = await this.call('GET', `/v2/nfse/${encodeURIComponent(ref)}`);
    if (status === 404) return null;
    if (status === 401) return { state: 'error', error: 'Token do emissor recusado (401).' };
    if (status >= 400) return { state: 'error', error: describe(json) || `HTTP ${status}` };
    return this.toResult(json);
  }

  async cancel(ref: string, reason: string): Promise<ProviderResult> {
    const { status, json } = await this.call('DELETE', `/v2/nfse/${encodeURIComponent(ref)}`, { justificativa: reason });
    if (status === 200 && json.status === 'cancelado') return { state: 'canceled' };
    if (status === 200) return this.toResult(json);
    return { state: 'error', error: describe(json) || `Emissor recusou o cancelamento (HTTP ${status}).` };
  }

  /** Cheap credential check: an unknown ref answers 404 when the token is valid and 401 when it is not. */
  async ping(): Promise<{ ok: boolean; message: string }> {
    try {
      const { status } = await this.call('GET', '/v2/nfse/rw-conexao-teste');
      if (status === 401) return { ok: false, message: 'Token recusado pelo emissor.' };
      return { ok: true, message: `Conectado ao emissor (${this.environment === 'producao' ? 'produção' : 'homologação'}).` };
    } catch (e) {
      return { ok: false, message: (e as Error).message };
    }
  }
}
