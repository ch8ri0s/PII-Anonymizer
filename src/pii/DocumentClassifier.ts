/**
 * Document Type Classifier (Story 3.1)
 *
 * Classifies document types based on structure and content to apply
 * type-specific detection rules and reduce false positives.
 */

// Entity type imported for future use in document type-specific processing

/**
 * Document types supported by the classifier
 */
export type DocumentType =
  | 'INVOICE'    // Contains amount patterns, invoice keywords
  | 'LETTER'     // Contains salutation, formal structure, signature block
  | 'FORM'       // Contains labeled fields, checkboxes, structured layout
  | 'CONTRACT'   // Contains parties, clauses, signatures, dates
  | 'REPORT'     // Contains sections, headings, narrative text
  | 'UNKNOWN';   // Default fallback

/**
 * Classification result with confidence
 */
export interface DocumentClassification {
  /** Primary document type */
  type: DocumentType;

  /** Classification confidence (0-1) */
  confidence: number;

  /** Secondary type if applicable */
  secondaryType?: DocumentType;

  /** Features that contributed to classification */
  features: ClassificationFeature[];

  /** Detected language */
  language?: 'en' | 'fr' | 'de' | 'it';
}

/**
 * Feature that contributed to classification
 */
export interface ClassificationFeature {
  /** Feature name */
  name: string;

  /** Feature weight in classification */
  weight: number;

  /** Matched text or pattern */
  match?: string;

  /** Position in document (0-1 normalized) */
  position?: number;
}

/**
 * Configuration for Document Classifier
 */
export interface DocumentClassifierConfig {
  /** Minimum confidence for primary classification */
  minConfidence: number;

  /** Enable language detection */
  detectLanguage: boolean;

  /** Consider document structure (headers, sections) */
  analyzeStructure: boolean;
}

const DEFAULT_CONFIG: DocumentClassifierConfig = {
  minConfidence: 0.25, // Lower threshold to capture more documents
  detectLanguage: true,
  analyzeStructure: true,
};

/**
 * Keyword patterns for document type detection
 */
const DOCUMENT_KEYWORDS: Record<DocumentType, Record<string, string[]>> = {
  INVOICE: {
    en: ['invoice', 'bill', 'payment due', 'amount due', 'subtotal', 'total', 'tax', 'vat', 'qty', 'quantity', 'unit price', 'invoice number', 'invoice date', 'due date', 'payment terms', 'remittance'],
    fr: ['facture', 'montant', 'total', 'tva', 'quantité', 'prix unitaire', 'numéro de facture', 'date de facture', 'échéance', 'règlement', 'net à payer', 'ht', 'ttc'],
    de: ['rechnung', 'rechnungsnummer', 'betrag', 'mwst', 'mehrwertsteuer', 'gesamtbetrag', 'menge', 'einzelpreis', 'rechnungsdatum', 'zahlbar', 'fällig', 'netto', 'brutto'],
    it: ['fattura', 'importo', 'totale', 'iva', 'quantità', 'prezzo unitario', 'numero fattura', 'data fattura', 'scadenza'],
  },
  LETTER: {
    en: ['dear', 'sincerely', 'regards', 'yours truly', 'yours faithfully', 'best regards', 'kind regards', 'to whom it may concern', 'enclosed', 'please find', 'i am writing', 'we are writing', 'thank you for', 're:', 'subject:'],
    fr: ['cher', 'chère', 'madame', 'monsieur', 'cordialement', 'salutations', 'veuillez agréer', 'je vous prie', 'meilleures salutations', 'bien à vous', 'ci-joint', 'je vous écris', 'nous vous écrivons', 'objet:', 'concerne:'],
    de: ['sehr geehrte', 'sehr geehrter', 'liebe', 'lieber', 'mit freundlichen grüßen', 'mit freundlichen grüssen', 'hochachtungsvoll', 'beste grüße', 'beste grüsse', 'anbei', 'ich schreibe ihnen', 'wir schreiben ihnen', 'betreff:', 'betrifft:'],
    it: ['gentile', 'egregio', 'caro', 'cara', 'cordiali saluti', 'distinti saluti', 'cordialmente', 'in allegato', 'le scrivo', 'oggetto:'],
  },
  FORM: {
    en: ['please fill', 'please complete', 'check box', 'checkbox', 'select one', 'tick', 'circle', 'enter your', 'your name', 'your address', 'date of birth', 'signature', 'sign here', 'required field', 'mandatory', 'optional', 'n/a', 'not applicable', 'yes/no', 'yes / no'],
    fr: ['veuillez remplir', 'cochez', 'case à cocher', 'sélectionnez', 'entrez', 'votre nom', 'votre adresse', 'date de naissance', 'signature', 'champ obligatoire', 'facultatif', 'oui/non', 'non applicable'],
    de: ['bitte ausfüllen', 'ankreuzen', 'kontrollkästchen', 'wählen sie', 'ihr name', 'ihre adresse', 'geburtsdatum', 'unterschrift', 'pflichtfeld', 'optional', 'ja/nein', 'nicht zutreffend', 'n.z.'],
    it: ['compilare', 'casella', 'selezionare', 'inserire', 'nome', 'indirizzo', 'data di nascita', 'firma', 'obbligatorio', 'facoltativo', 'sì/no'],
  },
  CONTRACT: {
    en: ['agreement', 'contract', 'parties', 'whereas', 'hereby', 'herein', 'hereto', 'thereto', 'clause', 'article', 'section', 'terms and conditions', 'effective date', 'termination', 'obligations', 'warranties', 'indemnification', 'governing law', 'jurisdiction', 'witness', 'executed', 'binding'],
    fr: ['contrat', 'accord', 'parties', 'attendu que', 'par les présentes', 'ci-après', 'clause', 'article', 'conditions générales', 'date d\'entrée en vigueur', 'résiliation', 'obligations', 'garanties', 'loi applicable', 'juridiction', 'témoin', 'signé'],
    de: ['vertrag', 'vereinbarung', 'parteien', 'hiermit', 'klausel', 'artikel', 'paragraph', 'allgemeine geschäftsbedingungen', 'agb', 'inkrafttreten', 'kündigung', 'pflichten', 'gewährleistung', 'anwendbares recht', 'gerichtsstand', 'zeuge', 'unterzeichnet'],
    it: ['contratto', 'accordo', 'parti', 'premesso', 'con la presente', 'clausola', 'articolo', 'condizioni generali', 'decorrenza', 'risoluzione', 'obblighi', 'garanzie', 'legge applicabile', 'foro competente', 'testimone', 'sottoscritto'],
  },
  REPORT: {
    en: ['executive summary', 'introduction', 'conclusion', 'findings', 'recommendations', 'analysis', 'methodology', 'results', 'discussion', 'appendix', 'table of contents', 'abstract', 'overview', 'summary', 'background', 'objectives', 'scope', 'key findings'],
    fr: ['résumé exécutif', 'introduction', 'conclusion', 'résultats', 'recommandations', 'analyse', 'méthodologie', 'discussion', 'annexe', 'table des matières', 'sommaire', 'contexte', 'objectifs', 'périmètre', 'principales conclusions'],
    de: ['zusammenfassung', 'einleitung', 'fazit', 'ergebnisse', 'empfehlungen', 'analyse', 'methodik', 'diskussion', 'anhang', 'inhaltsverzeichnis', 'überblick', 'hintergrund', 'ziele', 'umfang', 'kernaussagen'],
    it: ['sommario', 'introduzione', 'conclusione', 'risultati', 'raccomandazioni', 'analisi', 'metodologia', 'discussione', 'allegato', 'indice', 'panoramica', 'contesto', 'obiettivi', 'ambito'],
  },
  UNKNOWN: {
    en: [],
    fr: [],
    de: [],
    it: [],
  },
};

/**
 * Structural patterns for document type detection
 */
const STRUCTURAL_PATTERNS: Record<DocumentType, RegExp[]> = {
  INVOICE: [
    /(?:invoice|rechnung|facture)\s*(?:no\.?|nr\.?|#|:)\s*[\w-]+/i,
    /(?:total|montant|betrag)\s*[:=]?\s*(?:chf|eur|usd|€|£|\$)?\s*[\d',.\s]+/i,
    /(?:qty|menge|quantité)\s+(?:unit|preis|prix)/i,
    /(?:chf|eur|usd)\s*[\d',.\s]+/i,
    /\d+[.,]\d{2}\s*(?:chf|eur|usd|€)/i,
  ],
  LETTER: [
    /^(?:dear|sehr geehrte[r]?|cher|chère|madame|monsieur)/im,
    /(?:sincerely|regards|cordialement|grüße|grüssen|salutations)\s*,?\s*$/im,
    /^(?:re:|betreff:|objet:|subject:)/im,
    /(?:enclosed|anbei|ci-joint|in allegato)/i,
  ],
  FORM: [
    /\[\s*\]|\(\s*\)|□|☐|☑|☒/,
    /(?:name|nom|name):\s*_{2,}|_{5,}/i,
    /(?:yes|no|oui|non|ja|nein)\s*(?:\[\s*\]|\(\s*\))/i,
    /please\s+(?:check|tick|fill|complete)/i,
    /\*\s*(?:required|obligatoire|pflichtfeld)/i,
  ],
  CONTRACT: [
    /(?:between|entre|zwischen)\s+(?:the\s+)?(?:parties|parteien|les parties)/i,
    /(?:article|clause|section)\s+\d+/i,
    /(?:whereas|attendu que|in anbetracht)/i,
    /(?:hereby|par les présentes|hiermit)\s+(?:agree|conviennent|vereinbaren)/i,
    /(?:witness|témoin|zeuge)\s+(?:whereof|de quoi)/i,
  ],
  REPORT: [
    /(?:table\s+of\s+contents|inhaltsverzeichnis|table\s+des\s+matières)/i,
    /(?:executive\s+summary|zusammenfassung|résumé)/i,
    /^(?:\d+\.|\d+\))\s+(?:introduction|methodology|results|conclusion)/im,
    /(?:appendix|anhang|annexe)\s+[a-z\d]/i,
    /(?:figure|table|abbildung|tabelle)\s+\d+/i,
  ],
  UNKNOWN: [],
};

/**
 * Document Type Classifier
 *
 * Analyzes document content and structure to determine type.
 */
export class DocumentClassifier {
  private config: DocumentClassifierConfig;

  constructor(config: Partial<DocumentClassifierConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Classify a document based on its content
   */
  classify(text: string): DocumentClassification {
    const normalizedText = text.toLowerCase();
    const features: ClassificationFeature[] = [];

    // Detect language first
    const language = this.config.detectLanguage
      ? this.detectLanguage(normalizedText)
      : 'en';

    // Score each document type
    const scores: Record<DocumentType, number> = {
      INVOICE: 0,
      LETTER: 0,
      FORM: 0,
      CONTRACT: 0,
      REPORT: 0,
      UNKNOWN: 0,
    };

    // Keyword-based scoring
    for (const [docType, keywords] of Object.entries(DOCUMENT_KEYWORDS)) {
      const typeKeywords = keywords as Record<string, string[]>;
      const langKeywords = typeKeywords[language] || typeKeywords['en'] || [];

      for (const keyword of langKeywords) {
        const regex = new RegExp(`\\b${this.escapeRegex(keyword)}\\b`, 'gi');
        const matches = normalizedText.match(regex);

        if (matches) {
          const weight = this.calculateKeywordWeight(keyword, matches.length);
          scores[docType as DocumentType] += weight;

          features.push({
            name: `keyword:${keyword}`,
            weight,
            match: matches[0],
          });
        }
      }
    }

    // Structural pattern scoring
    if (this.config.analyzeStructure) {
      for (const [docType, patterns] of Object.entries(STRUCTURAL_PATTERNS)) {
        for (const pattern of patterns) {
          const match = text.match(pattern);
          if (match) {
            const weight = 0.15;
            scores[docType as DocumentType] += weight;

            // Calculate position (0-1)
            const position = match.index !== undefined
              ? match.index / text.length
              : undefined;

            features.push({
              name: `pattern:${docType.toLowerCase()}`,
              weight,
              match: match[0].substring(0, 50),
              position,
            });
          }
        }
      }
    }

    // Position-based adjustments
    this.applyPositionBoosts(text, scores, features);

    // Determine primary and secondary types
    const sortedTypes = Object.entries(scores)
      .filter(([type]) => type !== 'UNKNOWN')
      .sort((a, b) => b[1] - a[1]);

    const primaryScore = sortedTypes[0]?.[1] || 0;
    const primaryType = (sortedTypes[0]?.[0] as DocumentType) || 'UNKNOWN';
    const secondaryScore = sortedTypes[1]?.[1] || 0;
    const secondaryType = sortedTypes[1]?.[0] as DocumentType | undefined;

    // Calculate confidence (normalize to 0-1)
    const maxPossibleScore = 3.0; // Approximate max from keywords + patterns
    const confidence = Math.min(primaryScore / maxPossibleScore, 1.0);

    // Determine final type
    const finalType = confidence >= this.config.minConfidence
      ? primaryType
      : 'UNKNOWN';

    return {
      type: finalType,
      confidence,
      secondaryType: secondaryScore > 0.2 ? secondaryType : undefined,
      features: features.sort((a, b) => b.weight - a.weight).slice(0, 10),
      language,
    };
  }

  /**
   * Detect document language based on keyword matches
   */
  private detectLanguage(text: string): 'en' | 'fr' | 'de' | 'it' {
    const languageScores = { en: 0, fr: 0, de: 0, it: 0 };

    // Language-specific indicators
    const indicators: Record<string, string[]> = {
      en: ['the', 'and', 'is', 'are', 'was', 'were', 'have', 'has', 'this', 'that', 'with', 'for', 'your', 'please'],
      fr: ['le', 'la', 'les', 'de', 'du', 'des', 'et', 'est', 'sont', 'vous', 'nous', 'dans', 'pour', 'avec', 'cette', 'votre'],
      de: ['der', 'die', 'das', 'und', 'ist', 'sind', 'ihr', 'ihre', 'wir', 'mit', 'für', 'von', 'bei', 'nach', 'bitte'],
      it: ['il', 'la', 'le', 'di', 'del', 'della', 'e', 'è', 'sono', 'con', 'per', 'nella', 'questo', 'questa'],
    };

    for (const [lang, words] of Object.entries(indicators)) {
      for (const word of words) {
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        const matches = text.match(regex);
        if (matches) {
          languageScores[lang as keyof typeof languageScores] += matches.length;
        }
      }
    }

    // Return language with highest score
    const sorted = Object.entries(languageScores)
      .sort((a, b) => b[1] - a[1]);

    return (sorted[0]?.[0] as 'en' | 'fr' | 'de' | 'it') || 'en';
  }

  /**
   * Calculate weight for a keyword match
   */
  private calculateKeywordWeight(keyword: string, matchCount: number): number {
    // Longer keywords are more specific
    const lengthFactor = Math.min(keyword.length / 8, 1.5);

    // Multiple matches increase confidence (diminishing returns)
    const countFactor = 1 + Math.log2(matchCount + 1) * 0.5;

    // Increased base weight for better detection
    return 0.08 * lengthFactor * countFactor;
  }

  /**
   * Apply position-based boosts for document elements
   */
  private applyPositionBoosts(
    text: string,
    scores: Record<DocumentType, number>,
    features: ClassificationFeature[],
  ): void {
    const lines = text.split('\n');
    const firstLines = lines.slice(0, 5).join('\n').toLowerCase();
    const lastLines = lines.slice(-5).join('\n').toLowerCase();

    // Invoice: Check for invoice header in first lines
    if (/invoice|rechnung|facture/i.test(firstLines)) {
      scores.INVOICE += 0.2;
      features.push({
        name: 'position:invoice_header',
        weight: 0.2,
        position: 0,
      });
    }

    // Letter: Check for salutation at start
    if (/dear|sehr geehrte|cher|madame|monsieur/i.test(firstLines)) {
      scores.LETTER += 0.2;
      features.push({
        name: 'position:salutation_start',
        weight: 0.2,
        position: 0,
      });
    }

    // Letter: Check for signature at end
    if (/sincerely|regards|grüß|cordialement|salutations/i.test(lastLines)) {
      scores.LETTER += 0.15;
      features.push({
        name: 'position:signature_end',
        weight: 0.15,
        position: 1,
      });
    }

    // Contract: Check for parties clause at start
    if (/between|entre|zwischen.*parties|parteien/i.test(firstLines)) {
      scores.CONTRACT += 0.2;
      features.push({
        name: 'position:parties_clause',
        weight: 0.2,
        position: 0,
      });
    }

    // Report: Check for table of contents
    if (/table of contents|inhaltsverzeichnis|table des matières/i.test(firstLines)) {
      scores.REPORT += 0.25;
      features.push({
        name: 'position:toc_header',
        weight: 0.25,
        position: 0,
      });
    }
  }

  /**
   * Escape regex special characters
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Check if document is of a specific type with minimum confidence
   */
  isType(text: string, type: DocumentType, minConfidence = 0.5): boolean {
    const classification = this.classify(text);
    return classification.type === type && classification.confidence >= minConfidence;
  }

  /**
   * Get applicable rule sets for a document type
   */
  getApplicableRules(type: DocumentType): string[] {
    const ruleMap: Record<DocumentType, string[]> = {
      INVOICE: ['vendor', 'amount', 'vatNumber', 'paymentRef', 'invoiceNumber'],
      LETTER: ['sender', 'recipient', 'signature', 'salutation'],
      FORM: ['formField', 'checkbox', 'signature'],
      CONTRACT: ['parties', 'clauses', 'signature', 'date'],
      REPORT: ['author', 'sections', 'references'],
      UNKNOWN: [], // Use default rules
    };

    return ruleMap[type] || [];
  }
}

/**
 * Factory function for creating DocumentClassifier
 */
export function createDocumentClassifier(
  config?: Partial<DocumentClassifierConfig>,
): DocumentClassifier {
  return new DocumentClassifier(config);
}
