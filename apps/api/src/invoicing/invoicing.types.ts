export const INVOICE_STATUSES = ['review', 'queued', 'processing', 'issued', 'error', 'canceled', 'skipped'] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export type InvoicingEnvironment = 'homologacao' | 'producao';

/** Stored under app_settings key `invoicing`. The provider token is only ever stored encrypted (`tokenEnc`). */
export interface InvoicingSettings {
  enabled: boolean;
  /** Issue the nota as soon as the payment arrives. Only honoured in `producao`. */
  autoIssue: boolean;
  environment: InvoicingEnvironment;
  /** ISO date (YYYY-MM-DD). Payments before it are never invoiced (skipped as "before start"). */
  startFrom: string | null;
  issuer: {
    cnpj: string;
    inscricaoMunicipal: string;
    /** IBGE code of the city where the service is provided. São Paulo = 3550308. */
    municipioIbge: string;
  };
  tax: {
    optanteSimplesNacional: boolean;
    /** '' or 1..6, see the provider docs (5/6 = Simples Nacional MEI/ME-EPP). */
    regimeEspecialTributacao: string;
    /** 1 = tributação no município. */
    naturezaOperacao: string;
    /** Item da lista de serviços (LC 116), e.g. "0107" form. */
    itemListaServico: string;
    /** Código de serviço da Prefeitura. */
    codigoTributarioMunicipio: string;
    codigoCnae: string;
    /** ISS rate as typed (e.g. 2.9 = 2,9%). Empty = not sent; confirm the unit in homologação first. */
    aliquota: number | null;
    issRetido: boolean;
  };
  /** Placeholders: {plano} {competencia} {fatura} */
  description: string;
  tokenEnc: string | null;
}

export const DEFAULT_INVOICING_SETTINGS: InvoicingSettings = {
  enabled: false,
  autoIssue: false,
  environment: 'homologacao',
  startFrom: null,
  issuer: { cnpj: '49725579000149', inscricaoMunicipal: '76133621', municipioIbge: '3550308' },
  tax: {
    optanteSimplesNacional: true,
    regimeEspecialTributacao: '6',
    naturezaOperacao: '1',
    itemListaServico: '0103',
    codigoTributarioMunicipio: '02684',
    codigoCnae: '',
    aliquota: null,
    issRetido: false,
  },
  description: 'Assinatura Realwise {plano}, referente a {competencia}. Fatura {fatura}.',
  tokenEnc: null,
};

export interface CustomerAddress {
  cep?: string;
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  cityIbge?: string;
  uf?: string;
}

/** What the provider adapter needs to emit one nota. Built from a fiscal_invoices row + settings. */
export interface EmitRequest {
  ref: string;
  amountCents: number;
  issuedAt: Date;
  description: string;
  customer: {
    name: string | null;
    email: string | null;
    doc: string | null;
    address: CustomerAddress | null;
  };
}

export type ProviderState = 'processing' | 'issued' | 'error' | 'canceled';

export interface ProviderResult {
  state: ProviderState;
  number?: string;
  verificationCode?: string;
  url?: string;
  pdfUrl?: string;
  xmlPath?: string;
  issuedAt?: Date;
  error?: string;
}
