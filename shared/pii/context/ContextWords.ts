/**
 * Context Words Database for PII Detection
 *
 * Provides context words for each entity type and language to boost detection
 * confidence when relevant context is found nearby. Based on Microsoft Presidio
 * patterns with Swiss/EU-specific additions.
 *
 * @module shared/pii/context/ContextWords
 */

/**
 * Context word definition with weight and polarity
 */
export interface ContextWord {
  /** The context word or phrase */
  word: string;
  /** Weight factor 0.0-1.0, default 1.0 (higher = stronger signal) */
  weight: number;
  /** 'positive' boosts confidence, 'negative' reduces confidence */
  polarity: 'positive' | 'negative';
}

/**
 * Metadata for context words database
 */
export interface ContextWordsMetadata {
  /** Database version */
  version: string;
  /** Source of patterns (e.g., "Presidio v2.2.33", "Human curated") */
  source: string;
  /** Last updated timestamp (ISO8601) */
  lastUpdated: string;
}

/**
 * Context words organized by entity type and language
 */
export type ContextWordsConfig = Record<string, Record<string, ContextWord[]>>;

/**
 * Database metadata
 */
export const CONTEXT_WORDS_METADATA: ContextWordsMetadata = {
  version: '1.0.0',
  source: 'Presidio v2.2.33 + Swiss/EU curated',
  lastUpdated: '2025-12-25T00:00:00Z',
};

/**
 * Helper to create positive context word with default weight
 */
function pos(word: string, weight: number = 1.0): ContextWord {
  return { word, weight, polarity: 'positive' };
}

/**
 * Helper to create negative context word (reduces confidence)
 */
function neg(word: string, weight: number = 0.8): ContextWord {
  return { word, weight, polarity: 'negative' };
}

/**
 * Context words database organized by entity type and language
 */
export const CONTEXT_WORDS: ContextWordsConfig = {
  PERSON_NAME: {
    en: [
      // Salutations (high weight)
      pos('mr', 1.0),
      pos('mrs', 1.0),
      pos('ms', 1.0),
      pos('miss', 1.0),
      pos('dr', 1.0),
      pos('prof', 1.0),
      pos('sir', 0.9),
      pos('madam', 0.9),
      // Field labels (medium-high weight)
      pos('name', 0.9),
      pos('full name', 1.0),
      pos('first name', 0.9),
      pos('last name', 0.9),
      pos('surname', 0.9),
      pos('given name', 0.9),
      pos('contact', 0.8),
      pos('attention', 0.8),
      pos('attn', 0.8),
      pos('dear', 0.7),
      pos('recipient', 0.8),
      // Identifiers (medium weight)
      pos('by', 0.6),
      pos('from', 0.6),
      pos('to', 0.6),
      pos('author', 0.7),
      pos('owner', 0.7),
      pos('manager', 0.7),
      pos('director', 0.7),
      pos('signed', 0.6),
      pos('approved', 0.6),
      pos('employee', 0.7),
      pos('customer', 0.7),
      pos('client', 0.7),
      // Negative context (reduces confidence - common false positives)
      neg('example.com', 0.9),
      neg('test@', 0.8),
      neg('lorem', 0.7),
      neg('ipsum', 0.7),
      neg('placeholder', 0.8),
      // Story 8.20: Company suffixes (high negative weight - likely organization not person)
      neg('ltd', 1.0),
      neg('inc', 1.0),
      neg('corp', 1.0),
      neg('llc', 1.0),
      neg('plc', 1.0),
      neg('group', 0.9),
      neg('holding', 0.9),
      neg('technologies', 0.9),
      neg('services', 0.8),
      neg('solutions', 0.8),
      // Story 8.20: Street types (likely address not person)
      neg('street', 0.9),
      neg('road', 0.9),
      neg('avenue', 0.9),
      neg('lane', 0.9),
    ],
    fr: [
      // Salutations
      pos('m.', 1.0),
      pos('mme', 1.0),
      pos('mlle', 1.0),
      pos('dr', 1.0),
      pos('prof', 1.0),
      pos('monsieur', 1.0),
      pos('madame', 1.0),
      pos('mademoiselle', 0.9),
      // Field labels
      pos('nom', 0.9),
      pos('prénom', 0.9),
      pos('nom complet', 1.0),
      pos('nom de famille', 0.9),
      pos('contact', 0.8),
      pos('attention', 0.8),
      pos('cher', 0.7),
      pos('chère', 0.7),
      pos('destinataire', 0.8),
      // Identifiers
      pos('par', 0.6),
      pos('de', 0.5),
      pos('à', 0.5),
      pos('auteur', 0.7),
      pos('propriétaire', 0.7),
      pos('responsable', 0.7),
      pos('directeur', 0.7),
      pos('signé', 0.6),
      pos('approuvé', 0.6),
      pos('employé', 0.7),
      pos('client', 0.7),
      // Negative context
      neg('exemple.com', 0.9),
      neg('test@', 0.8),
      // Story 8.20: Company suffixes (French)
      neg('sa', 1.0),
      neg('sàrl', 1.0),
      neg('sarl', 1.0),
      neg('cie', 0.9),
      neg('groupe', 0.9),
      neg('holding', 0.9),
      neg('technologies', 0.9),
      neg('services', 0.8),
      // Story 8.20: Street types (French)
      neg('rue', 0.9),
      neg('avenue', 0.9),
      neg('boulevard', 0.9),
      neg('chemin', 0.9),
      neg('route', 0.9),
      neg('place', 0.9),
      // Story 8.20: Italian street types (common in Swiss French docs)
      neg('via', 0.9),
      neg('viale', 0.9),
      neg('piazza', 0.9),
    ],
    de: [
      // Salutations
      pos('herr', 1.0),
      pos('frau', 1.0),
      pos('dr', 1.0),
      pos('dr.', 1.0),
      pos('prof', 1.0),
      pos('prof.', 1.0),
      pos('sehr geehrter', 1.0),
      pos('sehr geehrte', 1.0),
      pos('lieber', 0.8),
      pos('liebe', 0.8),
      // Field labels
      pos('name', 0.9),
      pos('vorname', 0.9),
      pos('nachname', 0.9),
      pos('vollständiger name', 1.0),
      pos('familienname', 0.9),
      pos('kontakt', 0.8),
      pos('achtung', 0.8),
      pos('empfänger', 0.8),
      // Identifiers
      pos('von', 0.6),
      pos('an', 0.6),
      pos('autor', 0.7),
      pos('eigentümer', 0.7),
      pos('verantwortlich', 0.7),
      pos('direktor', 0.7),
      pos('unterschrieben', 0.6),
      pos('genehmigt', 0.6),
      pos('mitarbeiter', 0.7),
      pos('kunde', 0.7),
      // Negative context
      neg('beispiel.com', 0.9),
      neg('test@', 0.8),
      // Story 8.20: Company suffixes (German)
      neg('ag', 1.0),
      neg('gmbh', 1.0),
      neg('kg', 0.9),
      neg('ohg', 0.9),
      neg('se', 0.9),
      neg('gruppe', 0.9),
      neg('holding', 0.9),
      neg('technologien', 0.9),
      neg('dienstleistungen', 0.8),
      // Story 8.20: Street types (German)
      neg('strasse', 0.9),
      neg('straße', 0.9),
      neg('gasse', 0.9),
      neg('weg', 0.9),
      neg('platz', 0.9),
      neg('allee', 0.9),
    ],
  },

  PHONE_NUMBER: {
    en: [
      pos('phone', 1.0),
      pos('tel', 1.0),
      pos('telephone', 1.0),
      pos('mobile', 0.9),
      pos('cell', 0.9),
      pos('cellphone', 0.9),
      pos('fax', 0.8),
      pos('call', 0.7),
      pos('contact', 0.7),
      pos('number', 0.6),
      pos('direct', 0.7),
      pos('office', 0.7),
      pos('home', 0.6),
      pos('work', 0.6),
      neg('order', 0.6),
      neg('invoice', 0.6),
      neg('reference', 0.6),
    ],
    fr: [
      pos('téléphone', 1.0),
      pos('tél', 1.0),
      pos('tél.', 1.0),
      pos('mobile', 0.9),
      pos('portable', 0.9),
      pos('natel', 0.9),
      pos('fax', 0.8),
      pos('appeler', 0.7),
      pos('contact', 0.7),
      pos('numéro', 0.6),
      pos('direct', 0.7),
      pos('bureau', 0.7),
      pos('domicile', 0.6),
      pos('travail', 0.6),
      neg('commande', 0.6),
      neg('facture', 0.6),
      neg('référence', 0.6),
    ],
    de: [
      pos('telefon', 1.0),
      pos('tel', 1.0),
      pos('tel.', 1.0),
      pos('mobil', 0.9),
      pos('handy', 0.9),
      pos('natel', 0.9),
      pos('fax', 0.8),
      pos('anrufen', 0.7),
      pos('kontakt', 0.7),
      pos('nummer', 0.6),
      pos('direkt', 0.7),
      pos('büro', 0.7),
      pos('privat', 0.6),
      pos('geschäftlich', 0.6),
      neg('bestellung', 0.6),
      neg('rechnung', 0.6),
      neg('referenz', 0.6),
    ],
  },

  EMAIL: {
    en: [
      pos('email', 1.0),
      pos('e-mail', 1.0),
      pos('mail', 0.8),
      pos('contact', 0.7),
      pos('address', 0.6),
      pos('send', 0.6),
      pos('write', 0.6),
      pos('message', 0.6),
      pos('reply', 0.6),
      neg('example.com', 0.9),
      neg('test.com', 0.9),
      neg('domain.com', 0.8),
      neg('placeholder', 0.8),
    ],
    fr: [
      pos('courriel', 1.0),
      pos('e-mail', 1.0),
      pos('email', 1.0),
      pos('mail', 0.8),
      pos('contact', 0.7),
      pos('adresse', 0.6),
      pos('envoyer', 0.6),
      pos('écrire', 0.6),
      pos('message', 0.6),
      pos('répondre', 0.6),
      neg('exemple.com', 0.9),
      neg('test.com', 0.9),
    ],
    de: [
      pos('email', 1.0),
      pos('e-mail', 1.0),
      pos('mail', 0.8),
      pos('kontakt', 0.7),
      pos('adresse', 0.6),
      pos('senden', 0.6),
      pos('schreiben', 0.6),
      pos('nachricht', 0.6),
      pos('antworten', 0.6),
      neg('beispiel.com', 0.9),
      neg('test.com', 0.9),
    ],
  },

  ADDRESS: {
    en: [
      pos('address', 1.0),
      pos('street', 0.9),
      pos('road', 0.8),
      pos('avenue', 0.8),
      pos('boulevard', 0.8),
      pos('lane', 0.7),
      pos('postal', 0.8),
      pos('zip', 0.8),
      pos('city', 0.7),
      pos('town', 0.7),
      pos('location', 0.6),
      pos('deliver', 0.7),
      pos('ship', 0.7),
      pos('mail to', 0.8),
      pos('residence', 0.8),
      pos('domicile', 0.8),
    ],
    fr: [
      pos('adresse', 1.0),
      pos('rue', 0.9),
      pos('avenue', 0.8),
      pos('chemin', 0.8),
      pos('boulevard', 0.8),
      pos('route', 0.7),
      pos('postal', 0.8),
      pos('code', 0.6),
      pos('npa', 0.9),
      pos('ville', 0.7),
      pos('localité', 0.7),
      pos('livrer', 0.7),
      pos('livraison', 0.7),
      pos('domicile', 0.8),
      pos('résidence', 0.8),
    ],
    de: [
      pos('adresse', 1.0),
      pos('strasse', 0.9),
      pos('straße', 0.9),
      pos('weg', 0.8),
      pos('platz', 0.8),
      pos('allee', 0.8),
      pos('postleitzahl', 0.9),
      pos('plz', 0.9),
      pos('stadt', 0.7),
      pos('ort', 0.7),
      pos('ortschaft', 0.7),
      pos('liefern', 0.7),
      pos('lieferung', 0.7),
      pos('wohnort', 0.8),
      pos('anschrift', 0.9),
    ],
  },

  IBAN: {
    en: [
      pos('iban', 1.0),
      pos('account', 0.8),
      pos('bank', 0.8),
      pos('bank account', 1.0),
      pos('transfer', 0.7),
      pos('payment', 0.7),
      pos('swift', 0.8),
      pos('bic', 0.8),
      pos('wire', 0.7),
      pos('deposit', 0.7),
    ],
    fr: [
      pos('iban', 1.0),
      pos('compte', 0.8),
      pos('compte bancaire', 1.0),
      pos('banque', 0.8),
      pos('virement', 0.7),
      pos('paiement', 0.7),
      pos('swift', 0.8),
      pos('bic', 0.8),
      pos('versement', 0.7),
    ],
    de: [
      pos('iban', 1.0),
      pos('konto', 0.8),
      pos('bankkonto', 1.0),
      pos('bank', 0.8),
      pos('überweisung', 0.7),
      pos('zahlung', 0.7),
      pos('swift', 0.8),
      pos('bic', 0.8),
      pos('einzahlung', 0.7),
    ],
  },

  SWISS_AVS: {
    en: [
      pos('avs', 1.0),
      pos('ahv', 1.0),
      pos('social security', 0.9),
      pos('social insurance', 0.9),
      pos('insurance number', 0.8),
      pos('ssn', 0.7),
    ],
    fr: [
      pos('avs', 1.0),
      pos('numéro avs', 1.0),
      pos('n° avs', 1.0),
      pos('sécurité sociale', 0.9),
      pos('assurance sociale', 0.9),
      pos('numéro d\'assurance', 0.8),
    ],
    de: [
      pos('ahv', 1.0),
      pos('ahv-nummer', 1.0),
      pos('ahv-nr', 1.0),
      pos('sozialversicherung', 0.9),
      pos('versicherungsnummer', 0.8),
      pos('svn', 0.7),
    ],
  },

  SWISS_POSTAL_CODE: {
    en: [
      pos('postal', 0.9),
      pos('postal code', 1.0),
      pos('zip', 0.8),
      pos('zip code', 1.0),
      pos('npa', 0.9),
      pos('postcode', 0.9),
    ],
    fr: [
      pos('postal', 0.9),
      pos('code postal', 1.0),
      pos('npa', 1.0),
      pos('localité', 0.7),
    ],
    de: [
      pos('postleitzahl', 1.0),
      pos('plz', 1.0),
      pos('ort', 0.7),
      pos('ortschaft', 0.7),
    ],
  },

  DATE: {
    en: [
      pos('date', 0.8),
      pos('born', 0.9),
      pos('birth', 0.9),
      pos('birthday', 0.9),
      pos('dob', 1.0),
      pos('date of birth', 1.0),
      pos('issued', 0.7),
      pos('expires', 0.7),
      pos('expiry', 0.7),
      pos('valid', 0.6),
      pos('effective', 0.6),
      neg('invoice date', 0.4),
      neg('order date', 0.4),
      neg('due date', 0.4),
    ],
    fr: [
      pos('date', 0.8),
      pos('né', 0.9),
      pos('née', 0.9),
      pos('naissance', 1.0),
      pos('date de naissance', 1.0),
      pos('émis', 0.7),
      pos('expire', 0.7),
      pos('expiration', 0.7),
      pos('valide', 0.6),
      neg('date de facture', 0.4),
      neg('date de commande', 0.4),
      neg('échéance', 0.4),
    ],
    de: [
      pos('datum', 0.8),
      pos('geboren', 0.9),
      pos('geburt', 0.9),
      pos('geburtsdatum', 1.0),
      pos('ausgestellt', 0.7),
      pos('gültig', 0.6),
      pos('ablauf', 0.7),
      neg('rechnungsdatum', 0.4),
      neg('bestelldatum', 0.4),
      neg('fälligkeitsdatum', 0.4),
    ],
  },

  ORGANIZATION: {
    en: [
      pos('company', 0.9),
      pos('corporation', 0.9),
      pos('organization', 0.9),
      pos('organisation', 0.9),
      pos('firm', 0.8),
      pos('enterprise', 0.8),
      pos('business', 0.7),
      pos('ltd', 0.9),
      pos('inc', 0.9),
      pos('corp', 0.9),
      pos('llc', 0.9),
      pos('plc', 0.9),
    ],
    fr: [
      pos('société', 0.9),
      pos('entreprise', 0.9),
      pos('organisation', 0.9),
      pos('firme', 0.8),
      pos('sa', 0.9),
      pos('sàrl', 0.9),
      pos('sarl', 0.9),
      pos('cie', 0.8),
    ],
    de: [
      pos('firma', 0.9),
      pos('unternehmen', 0.9),
      pos('gesellschaft', 0.9),
      pos('organisation', 0.9),
      pos('gmbh', 1.0),
      pos('ag', 1.0),
      pos('kg', 0.9),
      pos('ohg', 0.9),
    ],
  },
};

/**
 * Get context words for a specific entity type and language
 *
 * @param entityType - The PII entity type (e.g., 'PERSON_NAME', 'PHONE_NUMBER')
 * @param language - The language code ('en', 'fr', 'de')
 * @returns Array of ContextWord objects with weights and polarity
 */
export function getContextWords(
  entityType: string,
  language: string,
): ContextWord[] {
  const typeWords = CONTEXT_WORDS[entityType];
  if (!typeWords) return [];

  const langWords = typeWords[language.toLowerCase()];
  return langWords ? [...langWords] : [];
}

/**
 * Get context words as simple strings (backward compatibility)
 *
 * @param entityType - The PII entity type
 * @param language - The language code
 * @returns Array of word strings (empty if not found)
 */
export function getContextWordStrings(
  entityType: string,
  language: string,
): string[] {
  return getContextWords(entityType, language).map((cw) => cw.word);
}

/**
 * Get all context words for an entity type across all languages
 *
 * @param entityType - The PII entity type
 * @returns Array of unique ContextWord objects (deduplicated by word)
 */
export function getAllContextWords(entityType: string): ContextWord[] {
  const typeWords = CONTEXT_WORDS[entityType];
  if (!typeWords) return [];

  const allWords: ContextWord[] = [];
  const seen = new Set<string>();

  for (const langWords of Object.values(typeWords)) {
    for (const cw of langWords) {
      const key = cw.word.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        allWords.push(cw);
      }
    }
  }

  return allWords;
}

/**
 * Get all positive context words for an entity type (filtering out negative ones)
 *
 * @param entityType - The PII entity type
 * @param language - The language code
 * @returns Array of positive ContextWord objects only
 */
export function getPositiveContextWords(
  entityType: string,
  language: string,
): ContextWord[] {
  return getContextWords(entityType, language).filter(
    (cw) => cw.polarity === 'positive',
  );
}

/**
 * Get all negative context words for an entity type (false positive indicators)
 *
 * @param entityType - The PII entity type
 * @param language - The language code
 * @returns Array of negative ContextWord objects only
 */
export function getNegativeContextWords(
  entityType: string,
  language: string,
): ContextWord[] {
  return getContextWords(entityType, language).filter(
    (cw) => cw.polarity === 'negative',
  );
}

/**
 * Get metadata about the context words database
 *
 * @returns ContextWordsMetadata object with version, source, and lastUpdated
 */
export function getMetadata(): ContextWordsMetadata {
  return { ...CONTEXT_WORDS_METADATA };
}

/**
 * Get list of all supported entity types
 *
 * @returns Array of entity type strings
 */
export function getSupportedEntityTypes(): string[] {
  return Object.keys(CONTEXT_WORDS);
}

/**
 * Get list of all supported languages for a given entity type
 *
 * @param entityType - The PII entity type
 * @returns Array of language codes (e.g., ['en', 'fr', 'de'])
 */
export function getSupportedLanguages(entityType: string): string[] {
  const typeWords = CONTEXT_WORDS[entityType];
  return typeWords ? Object.keys(typeWords) : [];
}
