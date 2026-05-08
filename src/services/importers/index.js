import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { parseNubankStatement, detectNubank } from './bankParsers/nubank';
import { parseItauStatement, detectItau } from './bankParsers/itau';
import { parseBradescoStatement, detectBradesco } from './bankParsers/bradesco';
import { parseMercadopagoStatement, detectMercadopago } from './bankParsers/mercadopago';
import { parseGenericStatement } from './bankParsers/generic';
import { categorizeTransaction } from '../../constants/defaultCategorizationRules';
import { loadUserCategorizationRules } from '../categorizationService';
import { batchCategorizeWithAI } from '../aiCategorizationService';
import {
  detectInstallment,
  generateInstallmentTransactions,
  generateTransactionHash,
  generateInstallmentGroupId
} from '../installments';
import { parseMercadoPagoPdf, detectMercadoPagoPdf } from './bankParsers/mercadopagoPdf';
import { parseInterPdf, detectInterPdf } from './bankParsers/interPdf';
import { parseInterFaturaPdf, detectInterFaturaPdf } from './bankParsers/interFaturaPdf';
import { parseInterStatement, detectInter } from './bankParsers/inter';
import { parseOfx } from './bankParsers/ofx';
import { parseItauPdf, detectItauPdf } from './bankParsers/itauPdf';
import { parseBradescoPdf, detectBradescoPdf } from './bankParsers/bradescoPdf';
import { extractPdfText } from './pdfLoader';

/**
 * Parse a bank statement file and categorize transactions
 * @param {File} file - The file to parse
 * @param {string} bankType - Bank type ('auto', 'nubank', 'itau', 'bradesco', 'generic')
 * @param {string} userId - User ID for loading categorization rules
 * @param {Object} options - Additional options
 * @param {string} options.apiKey - Gemini API key for AI categorization
 * @param {Object} options.categories - Available categories by type { expense: [], income: [] }
 */
export async function parseFile(file, bankType = 'auto', userId = null, options = {}) {
  const fileExtension = file.name.split('.').pop().toLowerCase();

  let data = [];

  if (fileExtension === 'csv') {
    data = await parseCSV(file);
  } else if (['xlsx', 'xls'].includes(fileExtension)) {
    data = await parseExcel(file);
  } else if (fileExtension === 'ofx') {
    const text = await file.text();
    const transactions = parseOfx(text);
    return await categorizeParsedTransactions(transactions, userId, options);
  } else if (fileExtension === 'pdf') {
    const { text, requiresPassword } = await extractPdfText(file, options.pdfPassword);
    if (requiresPassword) {
      const err = new Error('PDF_PASSWORD_REQUIRED');
      err.code = 'PDF_PASSWORD_REQUIRED';
      throw err;
    }
    let transactions = [];
    if (bankType === 'itauPdf' || (bankType === 'auto' && detectItauPdf(text))) {
      transactions = parseItauPdf(text);
    } else if (bankType === 'bradescoPdf' || (bankType === 'auto' && detectBradescoPdf(text))) {
      transactions = parseBradescoPdf(text);
    } else if (bankType === 'interFaturaPdf' || (bankType === 'auto' && detectInterFaturaPdf(text))) {
      transactions = parseInterFaturaPdf(text);
    } else if (bankType === 'interPdf' || (bankType === 'auto' && detectInterPdf(text))) {
      transactions = parseInterPdf(text);
    } else if (bankType === 'mercadopagoPdf' || (bankType === 'auto' && detectMercadoPagoPdf(text))) {
      transactions = parseMercadoPagoPdf(text);
    }
    // else: no parser matched, transactions stays [] so failed-import UI can kick in
    return await categorizeParsedTransactions(transactions, userId, options);
  } else {
    throw new Error('Unsupported file format. Please use CSV, Excel, or PDF files.');
  }

  if (data.length === 0) {
    throw new Error('No data found in the file.');
  }

  // Parse based on bank type
  let transactions = [];

  if (bankType === 'auto') {
    const headers = Object.keys(data[0]);
    if (detectNubank(headers)) {
      transactions = parseNubankStatement(data);
    } else if (detectInter(headers)) {
      transactions = parseInterStatement(data);
    } else if (detectItau(headers)) {
      transactions = parseItauStatement(data);
    } else if (detectBradesco(headers)) {
      transactions = parseBradescoStatement(data);
    } else if (detectMercadopago(headers)) {
      transactions = parseMercadopagoStatement(data);
    } else {
      transactions = parseGenericStatement(data);
    }
  } else {
    switch (bankType) {
      case 'nubank':
        transactions = parseNubankStatement(data);
        break;
      case 'inter':
        transactions = parseInterStatement(data);
        break;
      case 'itau':
        transactions = parseItauStatement(data);
        break;
      case 'bradesco':
        transactions = parseBradescoStatement(data);
        break;
      case 'mercadopago':
        transactions = parseMercadopagoStatement(data);
        break;
      default:
        // Unsupported / manual bank — leave empty so failed-import flow triggers.
        transactions = [];
    }
  }

  return await categorizeParsedTransactions(transactions, userId, options);
}

function parseCSV(file) {
  return new Promise((resolve, reject) => {
    // First, read file content to detect delimiter
    const reader = new FileReader();
    reader.onload = (e) => {
      let content = e.target.result;

      // Mercado Pago files have a summary section before the transaction rows.
      // Find the real transaction header and discard everything before it.
      const mpTransactionHeader = 'RELEASE_DATE';
      const mpHeaderIndex = content.indexOf(mpTransactionHeader);
      if (mpHeaderIndex > 0) {
        content = content.substring(mpHeaderIndex);
      }

      const interHeaderIndex = content.indexOf('Data Lançamento');
      if (interHeaderIndex > 0) content = content.substring(interHeaderIndex);

      const bradescoHeaderIndex = content.indexOf('Data;Histórico');
      if (bradescoHeaderIndex > 0) content = content.substring(bradescoHeaderIndex);

      // Detect delimiter: Brazilian CSVs often use semicolon
      const firstLine = content.split('\n')[0];
      const semicolonCount = (firstLine.match(/;/g) || []).length;
      const commaCount = (firstLine.match(/,/g) || []).length;

      // Use semicolon if it appears more often than comma in header
      const delimiter = semicolonCount > commaCount ? ';' : ',';

      Papa.parse(content, {
        header: true,
        skipEmptyLines: true,
        delimiter: delimiter,
        complete: (results) => {
          resolve(results.data);
        },
        error: (error) => {
          reject(error);
        }
      });
    };
    reader.onerror = reject;
    reader.readAsText(file, 'UTF-8');
  });
}

async function parseExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });

        // Get the first sheet
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        // Convert to JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
        resolve(jsonData);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

async function categorizeParsedTransactions(transactions, userId, options) {
  const { apiKey, categories: availableCategories } = options;

  let userRules = [];
  if (userId) {
    try {
      userRules = await loadUserCategorizationRules(userId);
    } catch (err) {
      console.error('Error loading user categorization rules:', err);
    }
  }

  const processedTransactions = [];
  const uncategorizedTransactions = [];
  const processedInstallmentGroups = new Set();

  for (const t of transactions) {
    const categorization = categorizeTransaction(t.description, userRules);
    const installmentInfo = detectInstallment(t.description);

    const isUncategorized =
      !categorization ||
      categorization.category === 'Diversos' ||
      categorization.category === 'Other' ||
      categorization.category === 'Outros' ||
      categorization.category === 'Sem categoria';

    const baseTransaction = {
      ...t,
      category: isUncategorized ? 'Sem categoria' : categorization.category,
      type: t.type || categorization?.type,
      autoCategory: !!categorization && !isUncategorized,
      isUserRule: categorization?.isUserRule || false,
      needsAI: isUncategorized,
      hash: generateTransactionHash(t),
    };

    if (installmentInfo) {
      const groupId = generateInstallmentGroupId(baseTransaction);
      if (processedInstallmentGroups.has(groupId)) continue;
      processedInstallmentGroups.add(groupId);
      baseTransaction.installmentGroupId = groupId;
      const installmentTransactions = generateInstallmentTransactions(
        baseTransaction,
        installmentInfo.current,
        installmentInfo.total
      );
      installmentTransactions.forEach((installment, index) => {
        installment.hash = generateTransactionHash(installment);
        installment.autoGenerated = index > 0;
        if (index === 0 && isUncategorized) uncategorizedTransactions.push(installment);
        processedTransactions.push(installment);
      });
    } else {
      if (isUncategorized) uncategorizedTransactions.push(baseTransaction);
      processedTransactions.push(baseTransaction);
    }
  }

  if (apiKey && uncategorizedTransactions.length > 0 && availableCategories) {
    try {
      const aiResults = await batchCategorizeWithAI(uncategorizedTransactions, {
        categories: availableCategories,
        userId,
        apiKey,
        fallbackFn: null,
      });
      processedTransactions.forEach((t) => {
        if (t.needsAI && aiResults.has(t.description)) {
          const r = aiResults.get(t.description);
          t.category = r.category;
          t.autoCategory = true;
          t.aiCategorized = r.source === 'ai' || r.source === 'cache';
          t.categoryConfidence = r.confidence;
        }
        delete t.needsAI;
      });
      const installmentGroups = {};
      processedTransactions.forEach((t) => {
        if (t.installmentGroupId && t.aiCategorized)
          installmentGroups[t.installmentGroupId] = t.category;
      });
      processedTransactions.forEach((t) => {
        if (t.installmentGroupId && installmentGroups[t.installmentGroupId] && !t.aiCategorized) {
          t.category = installmentGroups[t.installmentGroupId];
          t.autoCategory = true;
        }
      });
    } catch (err) {
      console.error('AI categorization failed:', err);
    }
  }

  processedTransactions.forEach((t) => {
    delete t.needsAI;
    let catSource;
    if (t.aiCategorized) catSource = 'ai';
    else if (t.isUserRule) catSource = 'user_rule';
    else if (t.autoCategory) catSource = 'default_rule';
    else catSource = null;
    t.metadata = {
      catSource,
      catConfidence: catSource === 'ai' ? (t.categoryConfidence ?? null) : null,
      isCorrected: false,
      originalCategory: t.category ?? null,
    };
  });

  return processedTransactions;
}

// Each option includes a `status` indicating whether we have a built-in parser.
// 'auto'   — built-in parser exists
// 'manual' — bank is recognized but no parser yet; selecting it triggers the
//            failed-import reporting flow so the user can send us their file
export const BANK_OPTIONS = [
  { value: 'auto',          label: 'Detectar automaticamente', status: 'auto' },
  { value: 'nubank',        label: 'Nubank',                   status: 'auto' },
  { value: 'itau',          label: 'Itaú',                     status: 'auto' },
  { value: 'bradesco',      label: 'Bradesco',                 status: 'auto' },
  { value: 'inter',         label: 'Banco Inter',              status: 'auto' },
  { value: 'interFaturaPdf', label: 'Banco Inter — Fatura',   status: 'auto' },
  { value: 'mercadopago',   label: 'Mercado Pago',             status: 'auto' },
  { value: 'bancodobrasil', label: 'Banco do Brasil',          status: 'manual' },
  { value: 'caixa',         label: 'Caixa Econômica Federal',  status: 'manual' },
  { value: 'santander',     label: 'Santander',                status: 'manual' },
  { value: 'ofx',           label: 'OFX (qualquer banco)',     status: 'auto' },
  { value: 'custom',        label: 'Outro banco',              status: 'manual' },
];
