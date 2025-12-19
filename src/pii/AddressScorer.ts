/**
 * Address Confidence Scorer (Story 2.3)
 *
 * Assigns confidence scores to grouped addresses based on:
 * - Component completeness
 * - Pattern match
 * - Postal code validation
 * - City validation
 */

import { Entity, GroupedAddress } from '../types/detection.js';
import { AddressClassifier } from './AddressClassifier.js';

/**
 * Scoring factors with their weights
 */
export interface ScoringFactor {
  name: string;
  score: number;
  maxScore: number;
  matched: boolean;
  description: string;
}

/**
 * Scored address with detailed breakdown
 */
export interface ScoredAddress extends GroupedAddress {
  /** Final confidence score (0-1) */
  finalConfidence: number;

  /** Scoring factors breakdown */
  scoringFactors: ScoringFactor[];

  /** Whether address is flagged for user review */
  flaggedForReview: boolean;

  /** Whether address should be auto-anonymized */
  autoAnonymize: boolean;
}

/**
 * Configuration for address scoring
 */
export interface AddressScorerConfig {
  /** Threshold below which addresses are flagged for review */
  reviewThreshold: number;

  /** Threshold above which addresses are auto-anonymized */
  autoAnonymizeThreshold: number;

  /** Weight multipliers for each factor */
  weights: {
    componentCompleteness: number;
    patternMatch: number;
    postalCodeValidation: number;
    cityValidation: number;
    countryPresent: number;
  };
}

const DEFAULT_CONFIG: AddressScorerConfig = {
  reviewThreshold: 0.6,
  autoAnonymizeThreshold: 0.8,
  weights: {
    componentCompleteness: 0.2,  // Up to 0.2 per component (max 5 = 1.0)
    patternMatch: 0.3,           // 0.3 for known pattern
    postalCodeValidation: 0.2,   // 0.2 for valid postal code
    cityValidation: 0.1,         // 0.1 for known city
    countryPresent: 0.1,         // 0.1 for country included
  },
};

/**
 * Address Confidence Scorer
 *
 * Scores grouped addresses to determine confidence levels
 * for auto-anonymization vs user review.
 */
export class AddressScorer {
  private config: AddressScorerConfig;
  private classifier: AddressClassifier;

  constructor(config: Partial<AddressScorerConfig> = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      weights: { ...DEFAULT_CONFIG.weights, ...config.weights },
    };
    this.classifier = new AddressClassifier();
  }

  /**
   * Score a grouped address
   */
  scoreAddress(address: GroupedAddress): ScoredAddress {
    const factors: ScoringFactor[] = [];

    // Factor 1: Component completeness
    factors.push(this.scoreComponentCompleteness(address));

    // Factor 2: Pattern match
    factors.push(this.scorePatternMatch(address));

    // Factor 3: Postal code validation
    factors.push(this.scorePostalCode(address));

    // Factor 4: City validation
    factors.push(this.scoreCityValidation(address));

    // Factor 5: Country presence
    factors.push(this.scoreCountryPresence(address));

    // Calculate final confidence
    const totalScore = factors.reduce((sum, f) => sum + f.score, 0);
    const maxPossibleScore = factors.reduce((sum, f) => sum + f.maxScore, 0);
    const finalConfidence = Math.min(totalScore / maxPossibleScore, 1);

    // Determine review/auto-anonymize status
    const flaggedForReview = finalConfidence < this.config.reviewThreshold;
    const autoAnonymize = finalConfidence >= this.config.autoAnonymizeThreshold;

    return {
      ...address,
      finalConfidence,
      scoringFactors: factors,
      flaggedForReview,
      autoAnonymize,
    };
  }

  /**
   * Score multiple addresses
   */
  scoreAddresses(addresses: GroupedAddress[]): ScoredAddress[] {
    return addresses.map(addr => this.scoreAddress(addr));
  }

  /**
   * Score component completeness
   * +0.2 per component, max 5 components
   */
  private scoreComponentCompleteness(address: GroupedAddress): ScoringFactor {
    // Use componentEntities (array of AddressComponent) for type checking
    const componentTypes = new Set(address.componentEntities.map((c: { type: string }) => c.type));
    const uniqueCount = componentTypes.size;
    const score = Math.min(uniqueCount * this.config.weights.componentCompleteness, 1.0);

    const hasStreet = componentTypes.has('STREET_NAME');
    const hasNumber = componentTypes.has('STREET_NUMBER');
    const hasPostal = componentTypes.has('POSTAL_CODE');
    const hasCity = componentTypes.has('CITY');

    let description = `${uniqueCount} unique component types`;
    if (hasStreet && hasNumber && hasPostal && hasCity) {
      description += ' (complete address)';
    } else {
      const missing: string[] = [];
      if (!hasStreet) missing.push('street');
      if (!hasNumber) missing.push('number');
      if (!hasPostal) missing.push('postal code');
      if (!hasCity) missing.push('city');
      if (missing.length > 0) {
        description += ` (missing: ${missing.join(', ')})`;
      }
    }

    return {
      name: 'Component Completeness',
      score,
      maxScore: 1.0,
      matched: uniqueCount >= 4,
      description,
    };
  }

  /**
   * Score pattern match
   * +0.3 for known Swiss/EU pattern
   */
  private scorePatternMatch(address: GroupedAddress): ScoringFactor {
    // Use patternMatched field (new GroupedAddress type uses SWISS, EU, ALTERNATIVE, PARTIAL, NONE)
    const pattern = address.patternMatched;
    const knownPatterns = ['SWISS', 'EU', 'ALTERNATIVE'];
    const isKnown = knownPatterns.includes(pattern);

    let score = 0;
    let description = `Pattern: ${pattern}`;

    if (pattern === 'SWISS' || pattern === 'EU') {
      score = this.config.weights.patternMatch;
      description += ' (standard format)';
    } else if (pattern === 'ALTERNATIVE') {
      score = this.config.weights.patternMatch * 0.8;
      description += ' (alternative format)';
    } else if (pattern === 'PARTIAL') {
      score = this.config.weights.patternMatch * 0.5;
      description += ' (partial match)';
    } else {
      score = 0;
      description += ' (unknown format)';
    }

    return {
      name: 'Pattern Match',
      score,
      maxScore: this.config.weights.patternMatch,
      matched: isKnown,
      description,
    };
  }

  /**
   * Score postal code validation
   * +0.2 for valid Swiss/EU postal code
   */
  private scorePostalCode(address: GroupedAddress): ScoringFactor {
    // Use components field (new GroupedAddress type - breakdown object with street, number, postal, city, country)
    const postalCode = address.components.postal;

    if (!postalCode) {
      return {
        name: 'Postal Code Validation',
        score: 0,
        maxScore: this.config.weights.postalCodeValidation,
        matched: false,
        description: 'No postal code found',
      };
    }

    // Extract numeric part
    const numericCode = postalCode.replace(/[^0-9]/g, '');
    const codeNum = parseInt(numericCode, 10);

    // Check Swiss postal code
    if (numericCode.length === 4 && this.classifier.isValidSwissPostalCode(codeNum)) {
      const canton = this.classifier.getCantonForPostalCode(codeNum);
      return {
        name: 'Postal Code Validation',
        score: this.config.weights.postalCodeValidation,
        maxScore: this.config.weights.postalCodeValidation,
        matched: true,
        description: `Valid Swiss postal code (${canton})`,
      };
    }

    // Check EU postal codes (5 digits for DE, FR, IT)
    if (numericCode.length === 5) {
      return {
        name: 'Postal Code Validation',
        score: this.config.weights.postalCodeValidation * 0.8,
        maxScore: this.config.weights.postalCodeValidation,
        matched: true,
        description: 'Valid EU postal code format',
      };
    }

    // Austrian postal codes (4 digits)
    if (numericCode.length === 4 && codeNum >= 1000 && codeNum <= 9999) {
      return {
        name: 'Postal Code Validation',
        score: this.config.weights.postalCodeValidation * 0.7,
        maxScore: this.config.weights.postalCodeValidation,
        matched: true,
        description: 'Possible Austrian postal code',
      };
    }

    return {
      name: 'Postal Code Validation',
      score: this.config.weights.postalCodeValidation * 0.3,
      maxScore: this.config.weights.postalCodeValidation,
      matched: false,
      description: `Unverified postal code: ${postalCode}`,
    };
  }

  /**
   * Score city validation
   * +0.1 for known Swiss/EU city
   */
  private scoreCityValidation(address: GroupedAddress): ScoringFactor {
    // Use components field (new GroupedAddress type - breakdown object)
    const city = address.components.city;

    if (!city) {
      return {
        name: 'City Validation',
        score: 0,
        maxScore: this.config.weights.cityValidation,
        matched: false,
        description: 'No city found',
      };
    }

    if (this.classifier.isKnownSwissCity(city)) {
      return {
        name: 'City Validation',
        score: this.config.weights.cityValidation,
        maxScore: this.config.weights.cityValidation,
        matched: true,
        description: `Known Swiss city: ${city}`,
      };
    }

    // Check if city appears after a valid postal code (good indicator)
    const postalCode = address.components.postal;
    if (postalCode) {
      return {
        name: 'City Validation',
        score: this.config.weights.cityValidation * 0.5,
        maxScore: this.config.weights.cityValidation,
        matched: false,
        description: `City after postal code: ${city}`,
      };
    }

    return {
      name: 'City Validation',
      score: this.config.weights.cityValidation * 0.3,
      maxScore: this.config.weights.cityValidation,
      matched: false,
      description: `Unverified city: ${city}`,
    };
  }

  /**
   * Score country presence
   * +0.1 if country is included
   */
  private scoreCountryPresence(address: GroupedAddress): ScoringFactor {
    // Use components field (new GroupedAddress type - breakdown object)
    const country = address.components.country;

    if (country) {
      return {
        name: 'Country Presence',
        score: this.config.weights.countryPresent,
        maxScore: this.config.weights.countryPresent,
        matched: true,
        description: `Country specified: ${country}`,
      };
    }

    // Country is optional, so partial score if we have good Swiss indicators
    const postalCode = address.components.postal;
    if (postalCode && postalCode.includes('CH')) {
      return {
        name: 'Country Presence',
        score: this.config.weights.countryPresent * 0.5,
        maxScore: this.config.weights.countryPresent,
        matched: true,
        description: 'Swiss country code in postal code',
      };
    }

    return {
      name: 'Country Presence',
      score: 0,
      maxScore: this.config.weights.countryPresent,
      matched: false,
      description: 'No country specified',
    };
  }

  /**
   * Update entity with scoring results
   */
  updateEntityWithScore(entity: Entity, scoredAddress: ScoredAddress): Entity {
    return {
      ...entity,
      confidence: scoredAddress.finalConfidence,
      flaggedForReview: scoredAddress.flaggedForReview,
      metadata: {
        ...entity.metadata,
        scoringFactors: scoredAddress.scoringFactors,
        autoAnonymize: scoredAddress.autoAnonymize,
        patternMatched: scoredAddress.patternMatched,
      },
    };
  }
}

/**
 * Factory function for creating AddressScorer
 */
export function createAddressScorer(
  config?: Partial<AddressScorerConfig>,
): AddressScorer {
  return new AddressScorer(config);
}
