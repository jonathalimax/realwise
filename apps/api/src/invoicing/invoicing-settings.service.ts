import { BadRequestException, Injectable } from '@nestjs/common';
import { AppSettingsService } from '../app-settings/app-settings.service';
import { digits } from './br-documents';
import { FocusNfeProvider } from './focusnfe.provider';
import { decryptSecret, encryptSecret } from './invoicing-crypto';
import { InvoicingSettings } from './invoicing.types';
import { missingConfig, normalizeSettings } from './nfse-payload';

const KEY = 'invoicing';

/** Settings the admin edits (everything but the token, which is write-only). */
export type InvoicingSettingsInput = Partial<Omit<InvoicingSettings, 'tokenEnc'>> & { token?: string; clearToken?: boolean };

const str = (v: unknown): string => String(v ?? '').trim();

@Injectable()
export class InvoicingSettingsService {
  constructor(private readonly settings: AppSettingsService) {}

  async get(): Promise<InvoicingSettings> {
    return normalizeSettings(await this.settings.get<Partial<InvoicingSettings>>(KEY));
  }

  /** Token from the admin screen (encrypted at rest) or, as a fallback, the FOCUSNFE_TOKEN env var. */
  async token(s?: InvoicingSettings): Promise<string | null> {
    const settings = s ?? (await this.get());
    return decryptSecret(settings.tokenEnc) ?? (process.env.FOCUSNFE_TOKEN || null);
  }

  async provider(s?: InvoicingSettings): Promise<FocusNfeProvider | null> {
    const settings = s ?? (await this.get());
    const token = await this.token(settings);
    return token ? new FocusNfeProvider(token, settings.environment) : null;
  }

  /** The admin view: never contains the token, only whether one exists and what is still missing. */
  async view() {
    const s = await this.get();
    const token = await this.token(s);
    const { tokenEnc, ...rest } = s;
    void tokenEnc; // encrypted token stays server-side
    return {
      ...rest,
      tokenConfigured: Boolean(token),
      tokenSource: decryptSecret(s.tokenEnc) ? 'admin' : process.env.FOCUSNFE_TOKEN ? 'env' : null,
      missing: missingConfig(s, Boolean(token)),
    };
  }

  async save(input: InvoicingSettingsInput, updatedBy: string | null) {
    const current = await this.get();
    const next: InvoicingSettings = normalizeSettings({
      ...current,
      enabled: input.enabled ?? current.enabled,
      autoIssue: input.autoIssue ?? current.autoIssue,
      environment: input.environment ?? current.environment,
      startFrom: input.startFrom === undefined ? current.startFrom : input.startFrom || null,
      issuer: input.issuer
        ? {
            cnpj: digits(input.issuer.cnpj ?? current.issuer.cnpj),
            inscricaoMunicipal: str(input.issuer.inscricaoMunicipal ?? current.issuer.inscricaoMunicipal),
            municipioIbge: digits(input.issuer.municipioIbge ?? current.issuer.municipioIbge),
          }
        : current.issuer,
      tax: input.tax
        ? {
            optanteSimplesNacional: input.tax.optanteSimplesNacional ?? current.tax.optanteSimplesNacional,
            regimeEspecialTributacao: str(input.tax.regimeEspecialTributacao ?? current.tax.regimeEspecialTributacao),
            naturezaOperacao: str(input.tax.naturezaOperacao ?? current.tax.naturezaOperacao) || '1',
            itemListaServico: str(input.tax.itemListaServico ?? current.tax.itemListaServico),
            codigoTributarioMunicipio: str(input.tax.codigoTributarioMunicipio ?? current.tax.codigoTributarioMunicipio),
            codigoCnae: str(input.tax.codigoCnae ?? current.tax.codigoCnae),
            aliquota: input.tax.aliquota === undefined ? current.tax.aliquota : input.tax.aliquota === null || Number.isNaN(Number(input.tax.aliquota)) ? null : Number(input.tax.aliquota),
            issRetido: input.tax.issRetido ?? current.tax.issRetido,
          }
        : current.tax,
      description: input.description === undefined ? current.description : str(input.description),
      tokenEnc: input.clearToken ? null : input.token?.trim() ? encryptSecret(input.token.trim()) : current.tokenEnc,
    });
    // Nothing may start issuing real notas until the setup is complete: production + on needs every field.
    if (next.environment === 'producao' && (next.enabled || next.autoIssue)) {
      const missing = missingConfig(next, Boolean(decryptSecret(next.tokenEnc) ?? process.env.FOCUSNFE_TOKEN));
      if (missing.length > 0) throw new BadRequestException(`Para ligar a produção, falta: ${missing.join(', ')}.`);
    }
    await this.settings.set(KEY, next, updatedBy);
    return this.view();
  }
}
