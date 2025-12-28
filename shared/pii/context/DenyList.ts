/**
 * DenyList - False Positive Filtering System
 *
 * Filters out common false positives from PII detection, such as table headers,
 * acronyms, and common non-PII words that are incorrectly flagged as entities.
 *
 * Implements Presidio-inspired deny-list patterns for improved detection precision.
 *
 * @module shared/pii/context/DenyList
 */

/**
 * Pattern definition for JSON config file
 * Supports both simple strings and regex patterns
 */
export interface PatternEntry {
  pattern: string;
  type: 'string' | 'regex';
  flags?: string;
}

/**
 * JSON configuration file structure for deny-list patterns
 */
export interface DenyListConfigFile {
  version: string;
  global: (string | PatternEntry)[];
  byEntityType: Record<string, (string | PatternEntry)[]>;
  byLanguage: Record<string, (string | PatternEntry)[]>;
}

/**
 * Internal runtime configuration with compiled patterns
 */
export interface DenyListConfig {
  global: (string | RegExp)[];
  byEntityType: Record<string, (string | RegExp)[]>;
  byLanguage: Record<string, (string | RegExp)[]>;
}

/**
 * Default deny-list configuration with common false positives
 * These are multilingual table headers and common non-PII words
 */
const DEFAULT_CONFIG: DenyListConfig = {
  global: [
    // French table headers / invoice terms
    'Montant',
    'Libellé',
    'Description',
    'Quantité',
    'Prix',
    'Total',
    'Sous-total',
    'TVA',
    'Rabais',
    'Réduction',
    'Référence',
    'Numéro',
    'Facture',
    'Client',
    'Fournisseur',
    'Désignation',
    'Unité',
    'Remise',
    'HT',
    'TTC',
    // German table headers / invoice terms
    'Beschreibung',
    'Betrag',
    'Menge',
    'Preis',
    'Summe',
    'MwSt',
    'Zwischensumme',
    'Rabatt',
    'Referenz',
    'Nummer',
    'Rechnung',
    'Kunde',
    'Lieferant',
    'Bezeichnung',
    'Einheit',
    'Netto',
    'Brutto',
    // English table headers / invoice terms
    'Amount',
    'Quantity',
    'Price',
    'Subtotal',
    'Tax',
    'Discount',
    'Reference',
    'Number',
    'Invoice',
    'Customer',
    'Supplier',
    'Unit',
    'Net',
    'Gross',
    // Common date-related words
    'Date',
    'Datum',
  ],
  byEntityType: {
    PERSON_NAME: [
      // 2-4 letter uppercase acronyms (likely abbreviations, not names)
      /^[A-Z]{2,4}$/,
      // Pure numbers (not names)
      /^\d+$/,
      // Month abbreviations (English)
      /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)$/i,
      // Day abbreviations (English)
      /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)$/i,
      // Month abbreviations (French)
      /^(Janv|Févr|Mars|Avr|Mai|Juin|Juil|Août|Sept|Oct|Nov|Déc)$/i,
      // Month abbreviations (German)
      /^(Jan|Feb|Mär|Apr|Mai|Jun|Jul|Aug|Sep|Okt|Nov|Dez)$/i,
      // Story 8.20: Company name patterns (ending with legal suffixes)
      /\b(Ltd|AG|SA|GmbH|Inc|Corp|LLC|Sàrl|SARL|Cie|KG|OHG|SE|NV|BV|Plc)\.?$/i,
      // Story 8.20: Street type patterns (Italian/French/German street prefixes)
      /^(Via|Viale|Piazza|Corso|Vicolo|Largo|Rue|Avenue|Boulevard|Chemin|Route|Place|Allée|Strasse|Straße|Gasse|Weg|Platz|Allee)\b/i,
      // Story 8.20: Company/service name patterns
      /\b(Holding|Group|Technologies|Services|Solutions|Systems|Consulting|Partners|Associates|Foundation|Institute|Bank)\s*$/i,
      // Story 8.20: Generic product/service words that appear as capitalized pairs
      /^(Case|Notre|Votre|Services|Gestion|Module|Données|Coordonnées)\s/i,
    ],
    ORGANIZATION: [],
    NUMBER: [],
  },
  byLanguage: {
    fr: [],
    de: [],
    en: [],
  },
};

/**
 * Converts a PatternEntry from JSON config to a string or RegExp
 */
function parsePatternEntry(entry: string | PatternEntry): string | RegExp {
  if (typeof entry === 'string') {
    return entry;
  }

  if (entry.type === 'regex') {
    return new RegExp(entry.pattern, entry.flags || '');
  }

  return entry.pattern;
}

/**
 * Parses a JSON config file structure into runtime DenyListConfig
 */
export function parseDenyListConfigFile(
  configFile: DenyListConfigFile,
): DenyListConfig {
  return {
    global: configFile.global.map(parsePatternEntry),
    byEntityType: Object.fromEntries(
      Object.entries(configFile.byEntityType).map(([key, patterns]) => [
        key,
        patterns.map(parsePatternEntry),
      ]),
    ),
    byLanguage: Object.fromEntries(
      Object.entries(configFile.byLanguage).map(([key, patterns]) => [
        key,
        patterns.map(parsePatternEntry),
      ]),
    ),
  };
}

/**
 * DenyList class for filtering false positives in PII detection
 *
 * Uses static methods for easy integration without instantiation.
 * Supports global, entity-type specific, and language-specific patterns.
 * Pattern matching is case-insensitive for string patterns.
 */
export class DenyList {
  private static config: DenyListConfig = { ...DEFAULT_CONFIG };

  // Use Set for O(1) string lookups (normalized to lowercase)
  private static globalSet: Set<string> = new Set();
  private static entityTypeSets: Map<string, Set<string>> = new Map();
  private static languageSets: Map<string, Set<string>> = new Map();

  // Store regex patterns separately
  private static globalRegexes: RegExp[] = [];
  private static entityTypeRegexes: Map<string, RegExp[]> = new Map();
  private static languageRegexes: Map<string, RegExp[]> = new Map();

  // Flag to track initialization
  private static initialized = false;

  /**
   * Initialize the DenyList with default or provided configuration
   */
  static initialize(config?: DenyListConfig): void {
    DenyList.config = config ?? { ...DEFAULT_CONFIG };
    DenyList.rebuildLookups();
    DenyList.initialized = true;
  }

  /**
   * Load configuration from a parsed JSON config file
   */
  static loadFromConfig(configFile: DenyListConfigFile): void {
    const parsedConfig = parseDenyListConfigFile(configFile);
    DenyList.initialize(parsedConfig);
  }

  /**
   * Rebuild internal lookup structures for fast matching
   */
  private static rebuildLookups(): void {
    // Clear existing lookups
    DenyList.globalSet.clear();
    DenyList.globalRegexes = [];
    DenyList.entityTypeSets.clear();
    DenyList.entityTypeRegexes.clear();
    DenyList.languageSets.clear();
    DenyList.languageRegexes.clear();

    // Build global lookups
    for (const pattern of DenyList.config.global) {
      if (typeof pattern === 'string') {
        DenyList.globalSet.add(pattern.toLowerCase());
      } else {
        DenyList.globalRegexes.push(pattern);
      }
    }

    // Build entity-type lookups
    for (const [entityType, patterns] of Object.entries(
      DenyList.config.byEntityType,
    )) {
      const stringSet = new Set<string>();
      const regexList: RegExp[] = [];

      for (const pattern of patterns) {
        if (typeof pattern === 'string') {
          stringSet.add(pattern.toLowerCase());
        } else {
          regexList.push(pattern);
        }
      }

      if (stringSet.size > 0) {
        DenyList.entityTypeSets.set(entityType, stringSet);
      }
      if (regexList.length > 0) {
        DenyList.entityTypeRegexes.set(entityType, regexList);
      }
    }

    // Build language lookups
    for (const [language, patterns] of Object.entries(
      DenyList.config.byLanguage,
    )) {
      const stringSet = new Set<string>();
      const regexList: RegExp[] = [];

      for (const pattern of patterns) {
        if (typeof pattern === 'string') {
          stringSet.add(pattern.toLowerCase());
        } else {
          regexList.push(pattern);
        }
      }

      if (stringSet.size > 0) {
        DenyList.languageSets.set(language, stringSet);
      }
      if (regexList.length > 0) {
        DenyList.languageRegexes.set(language, regexList);
      }
    }
  }

  /**
   * Ensure DenyList is initialized before use
   */
  private static ensureInitialized(): void {
    if (!DenyList.initialized) {
      DenyList.initialize();
    }
  }

  /**
   * Check if text should be denied (filtered out) for given entity type
   *
   * @param text - The detected entity text
   * @param entityType - The entity type (PERSON_NAME, ORGANIZATION, etc.)
   * @param language - Optional language code (en, fr, de)
   * @returns true if text should be filtered out (is a false positive)
   */
  static isDenied(text: string, entityType: string, language?: string): boolean {
    DenyList.ensureInitialized();

    const normalizedText = text.trim();
    const lowerText = normalizedText.toLowerCase();

    // 1. Check global string patterns (O(1) lookup)
    if (DenyList.globalSet.has(lowerText)) {
      return true;
    }

    // 2. Check global regex patterns
    for (const regex of DenyList.globalRegexes) {
      if (regex.test(normalizedText)) {
        return true;
      }
    }

    // 3. Check entity-type specific string patterns
    const entityTypeSet = DenyList.entityTypeSets.get(entityType);
    if (entityTypeSet && entityTypeSet.has(lowerText)) {
      return true;
    }

    // 4. Check entity-type specific regex patterns
    const entityTypeRegexes = DenyList.entityTypeRegexes.get(entityType);
    if (entityTypeRegexes) {
      for (const regex of entityTypeRegexes) {
        if (regex.test(normalizedText)) {
          return true;
        }
      }
    }

    // 5. Check language-specific string patterns (if language provided)
    if (language) {
      const languageSet = DenyList.languageSets.get(language);
      if (languageSet && languageSet.has(lowerText)) {
        return true;
      }

      // 6. Check language-specific regex patterns
      const languageRegexes = DenyList.languageRegexes.get(language);
      if (languageRegexes) {
        for (const regex of languageRegexes) {
          if (regex.test(normalizedText)) {
            return true;
          }
        }
      }
    }

    return false;
  }

  /**
   * Add a pattern to the deny list dynamically
   *
   * @param pattern - String or RegExp pattern to add
   * @param scope - 'global' or an entity type (e.g., 'PERSON_NAME')
   */
  static addPattern(pattern: string | RegExp, scope: 'global' | string): void {
    DenyList.ensureInitialized();

    if (scope === 'global') {
      DenyList.config.global.push(pattern);
      if (typeof pattern === 'string') {
        DenyList.globalSet.add(pattern.toLowerCase());
      } else {
        DenyList.globalRegexes.push(pattern);
      }
    } else {
      // Treat as entity type
      if (!DenyList.config.byEntityType[scope]) {
        DenyList.config.byEntityType[scope] = [];
      }
      DenyList.config.byEntityType[scope].push(pattern);

      if (typeof pattern === 'string') {
        let entitySet = DenyList.entityTypeSets.get(scope);
        if (!entitySet) {
          entitySet = new Set();
          DenyList.entityTypeSets.set(scope, entitySet);
        }
        entitySet.add(pattern.toLowerCase());
      } else {
        let entityRegexes = DenyList.entityTypeRegexes.get(scope);
        if (!entityRegexes) {
          entityRegexes = [];
          DenyList.entityTypeRegexes.set(scope, entityRegexes);
        }
        entityRegexes.push(pattern);
      }
    }
  }

  /**
   * Add a language-specific pattern
   *
   * @param pattern - String or RegExp pattern to add
   * @param language - Language code (en, fr, de)
   */
  static addLanguagePattern(pattern: string | RegExp, language: string): void {
    DenyList.ensureInitialized();

    if (!DenyList.config.byLanguage[language]) {
      DenyList.config.byLanguage[language] = [];
    }
    DenyList.config.byLanguage[language].push(pattern);

    if (typeof pattern === 'string') {
      let langSet = DenyList.languageSets.get(language);
      if (!langSet) {
        langSet = new Set();
        DenyList.languageSets.set(language, langSet);
      }
      langSet.add(pattern.toLowerCase());
    } else {
      let langRegexes = DenyList.languageRegexes.get(language);
      if (!langRegexes) {
        langRegexes = [];
        DenyList.languageRegexes.set(language, langRegexes);
      }
      langRegexes.push(pattern);
    }
  }

  /**
   * Get all patterns for a given entity type and/or language
   * Returns combined patterns from global, entity-type, and language scopes
   *
   * @param entityType - Optional entity type to include patterns for
   * @param language - Optional language to include patterns for
   * @returns Array of string and RegExp patterns
   */
  static getPatterns(
    entityType?: string,
    language?: string,
  ): (string | RegExp)[] {
    DenyList.ensureInitialized();

    const patterns: (string | RegExp)[] = [...DenyList.config.global];

    if (entityType && DenyList.config.byEntityType[entityType]) {
      patterns.push(...DenyList.config.byEntityType[entityType]);
    }

    if (language && DenyList.config.byLanguage[language]) {
      patterns.push(...DenyList.config.byLanguage[language]);
    }

    return patterns;
  }

  /**
   * Get only global patterns
   */
  static getGlobalPatterns(): (string | RegExp)[] {
    DenyList.ensureInitialized();
    return [...DenyList.config.global];
  }

  /**
   * Get patterns for a specific entity type only
   */
  static getEntityTypePatterns(entityType: string): (string | RegExp)[] {
    DenyList.ensureInitialized();
    return DenyList.config.byEntityType[entityType]
      ? [...DenyList.config.byEntityType[entityType]]
      : [];
  }

  /**
   * Get patterns for a specific language only
   */
  static getLanguagePatterns(language: string): (string | RegExp)[] {
    DenyList.ensureInitialized();
    return DenyList.config.byLanguage[language]
      ? [...DenyList.config.byLanguage[language]]
      : [];
  }

  /**
   * Reset to default configuration
   * Useful for testing
   */
  static reset(): void {
    DenyList.config = {
      global: [...DEFAULT_CONFIG.global],
      byEntityType: Object.fromEntries(
        Object.entries(DEFAULT_CONFIG.byEntityType).map(([key, patterns]) => [
          key,
          [...patterns],
        ]),
      ),
      byLanguage: Object.fromEntries(
        Object.entries(DEFAULT_CONFIG.byLanguage).map(([key, patterns]) => [
          key,
          [...patterns],
        ]),
      ),
    };
    DenyList.rebuildLookups();
    DenyList.initialized = true;
  }

  /**
   * Clear all patterns (start fresh)
   * Useful for testing
   */
  static clear(): void {
    DenyList.config = {
      global: [],
      byEntityType: {},
      byLanguage: {},
    };
    DenyList.rebuildLookups();
    DenyList.initialized = true;
  }
}
