import { digits, validDoc } from './br-documents';
import { DEFAULT_INVOICING_SETTINGS, EmitRequest, InvoicingEnvironment, InvoicingSettings } from './invoicing.types';

const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/** "outubro de 2026" in Brasília time. */
export function competenciaLabel(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', month: 'numeric', year: 'numeric' }).formatToParts(date);
  const month = Number(parts.find((p) => p.type === 'month')?.value ?? 1);
  const year = parts.find((p) => p.type === 'year')?.value ?? '';
  return `${MONTHS[month - 1]} de ${year}`;
}

export function renderDescription(template: string, vars: { plano: string; competencia: string; fatura: string }): string {
  return template
    .replace(/\{plano\}/g, vars.plano)
    .replace(/\{competencia\}/g, vars.competencia)
    .replace(/\{fatura\}/g, vars.fatura)
    .replace(/\s+/g, ' ')
    .trim();
}

/** Everything that must be filled in before a nota can be sent. Empty array = ready. */
export function missingConfig(s: InvoicingSettings, hasToken: boolean): string[] {
  const missing: string[] = [];
  if (!hasToken) missing.push('Token do emissor');
  if (digits(s.issuer.cnpj).length !== 14) missing.push('CNPJ do prestador');
  if (!s.issuer.inscricaoMunicipal.trim()) missing.push('Inscrição municipal (CCM)');
  if (digits(s.issuer.municipioIbge).length !== 7) missing.push('Código IBGE do município');
  if (!s.tax.itemListaServico.trim()) missing.push('Item da lista de serviços');
  if (!s.tax.codigoTributarioMunicipio.trim()) missing.push('Código de serviço da Prefeitura');
  if (!s.description.trim()) missing.push('Descrição do serviço');
  return missing;
}

/** Merges stored settings over the defaults, field by field, so older stored shapes keep working. */
export function normalizeSettings(raw: Partial<InvoicingSettings> | undefined): InvoicingSettings {
  const d = DEFAULT_INVOICING_SETTINGS;
  const r = raw ?? {};
  return {
    enabled: r.enabled ?? d.enabled,
    autoIssue: r.autoIssue ?? d.autoIssue,
    environment: r.environment === 'producao' ? 'producao' : 'homologacao',
    startFrom: r.startFrom ?? d.startFrom,
    issuer: { ...d.issuer, ...(r.issuer ?? {}) },
    tax: { ...d.tax, ...(r.tax ?? {}) },
    description: r.description ?? d.description,
    tokenEnc: r.tokenEnc ?? d.tokenEnc,
  };
}

/**
 * Body for POST /v2/nfse. In homologação the customer e-mail is left out so test notas are never mailed to real people.
 * The customer is only identified with a valid CPF/CNPJ; without one the nota goes out with just the name.
 */
export function buildNfsePayload(req: EmitRequest, s: InvoicingSettings, environment: InvoicingEnvironment) {
  const doc = validDoc(req.customer.doc);
  const addr = req.customer.address;
  const endereco = addr && (addr.street || addr.cep)
    ? {
        logradouro: addr.street?.slice(0, 125),
        numero: addr.number?.slice(0, 10) || 'S/N',
        complemento: addr.complement?.slice(0, 60) || undefined,
        bairro: addr.neighborhood?.slice(0, 60),
        codigo_municipio: addr.cityIbge ? digits(addr.cityIbge) : undefined,
        uf: addr.uf?.toUpperCase().slice(0, 2),
        cep: addr.cep ? digits(addr.cep) : undefined,
      }
    : undefined;

  const tomador: Record<string, unknown> = {
    ...(doc ? (doc.length === 11 ? { cpf: doc } : { cnpj: doc }) : {}),
    razao_social: (req.customer.name ?? '').slice(0, 115) || undefined,
    email: environment === 'producao' ? req.customer.email?.slice(0, 80) || undefined : undefined,
    endereco,
  };

  return {
    data_emissao: req.issuedAt.toISOString(),
    natureza_operacao: s.tax.naturezaOperacao || '1',
    optante_simples_nacional: s.tax.optanteSimplesNacional,
    ...(s.tax.regimeEspecialTributacao ? { regime_especial_tributacao: s.tax.regimeEspecialTributacao } : {}),
    prestador: {
      cnpj: digits(s.issuer.cnpj),
      inscricao_municipal: digits(s.issuer.inscricaoMunicipal) || s.issuer.inscricaoMunicipal.trim(),
      codigo_municipio: digits(s.issuer.municipioIbge),
    },
    tomador,
    servico: {
      valor_servicos: Number((req.amountCents / 100).toFixed(2)),
      iss_retido: s.tax.issRetido,
      item_lista_servico: s.tax.itemListaServico.trim(),
      codigo_tributario_municipio: s.tax.codigoTributarioMunicipio.trim(),
      ...(s.tax.codigoCnae ? { codigo_cnae: digits(s.tax.codigoCnae) } : {}),
      ...(s.tax.aliquota != null ? { aliquota: s.tax.aliquota } : {}),
      discriminacao: req.description,
      codigo_municipio: digits(s.issuer.municipioIbge),
    },
  };
}
