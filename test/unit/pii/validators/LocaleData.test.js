/**
 * Unit tests for Locale Data Module
 *
 * Tests for the shared locale data used across validators.
 * Verifies month names for EN, DE, FR, IT with accent variations.
 *
 * @module test/unit/pii/validators/LocaleData.test
 */

import { expect } from 'chai';
import {
  MONTH_NAME_TO_NUMBER,
  MONTH_NAMES,
  isMonthName,
  getMonthNumber,
  SUPPORTED_LANGUAGES,
} from '../../../../shared/dist/pii/validators/locale-data.js';

describe('Locale Data', function () {
  describe('MONTH_NAME_TO_NUMBER', function () {
    describe('English months', function () {
      it('should have all 12 English months', function () {
        expect(MONTH_NAME_TO_NUMBER.january).to.equal(1);
        expect(MONTH_NAME_TO_NUMBER.february).to.equal(2);
        expect(MONTH_NAME_TO_NUMBER.march).to.equal(3);
        expect(MONTH_NAME_TO_NUMBER.april).to.equal(4);
        expect(MONTH_NAME_TO_NUMBER.may).to.equal(5);
        expect(MONTH_NAME_TO_NUMBER.june).to.equal(6);
        expect(MONTH_NAME_TO_NUMBER.july).to.equal(7);
        expect(MONTH_NAME_TO_NUMBER.august).to.equal(8);
        expect(MONTH_NAME_TO_NUMBER.september).to.equal(9);
        expect(MONTH_NAME_TO_NUMBER.october).to.equal(10);
        expect(MONTH_NAME_TO_NUMBER.november).to.equal(11);
        expect(MONTH_NAME_TO_NUMBER.december).to.equal(12);
      });
    });

    describe('German months', function () {
      it('should have German month names', function () {
        expect(MONTH_NAME_TO_NUMBER.januar).to.equal(1);
        expect(MONTH_NAME_TO_NUMBER.februar).to.equal(2);
        expect(MONTH_NAME_TO_NUMBER.märz).to.equal(3);
        expect(MONTH_NAME_TO_NUMBER.mai).to.equal(5);
        expect(MONTH_NAME_TO_NUMBER.juni).to.equal(6);
        expect(MONTH_NAME_TO_NUMBER.juli).to.equal(7);
        expect(MONTH_NAME_TO_NUMBER.oktober).to.equal(10);
        expect(MONTH_NAME_TO_NUMBER.dezember).to.equal(12);
      });

      it('should have ASCII alternative for März (maerz)', function () {
        expect(MONTH_NAME_TO_NUMBER.maerz).to.equal(3);
        expect(MONTH_NAME_TO_NUMBER.maerz).to.equal(MONTH_NAME_TO_NUMBER.märz);
      });
    });

    describe('French months', function () {
      it('should have French month names', function () {
        expect(MONTH_NAME_TO_NUMBER.janvier).to.equal(1);
        expect(MONTH_NAME_TO_NUMBER.février).to.equal(2);
        expect(MONTH_NAME_TO_NUMBER.mars).to.equal(3);
        expect(MONTH_NAME_TO_NUMBER.avril).to.equal(4);
        expect(MONTH_NAME_TO_NUMBER.juin).to.equal(6);
        expect(MONTH_NAME_TO_NUMBER.juillet).to.equal(7);
        expect(MONTH_NAME_TO_NUMBER.août).to.equal(8);
        expect(MONTH_NAME_TO_NUMBER.septembre).to.equal(9);
        expect(MONTH_NAME_TO_NUMBER.octobre).to.equal(10);
        expect(MONTH_NAME_TO_NUMBER.novembre).to.equal(11);
        expect(MONTH_NAME_TO_NUMBER.décembre).to.equal(12);
      });

      it('should have ASCII alternatives for accented French months', function () {
        // février/fevrier
        expect(MONTH_NAME_TO_NUMBER.fevrier).to.equal(2);
        expect(MONTH_NAME_TO_NUMBER.fevrier).to.equal(MONTH_NAME_TO_NUMBER.février);

        // août/aout
        expect(MONTH_NAME_TO_NUMBER.aout).to.equal(8);
        expect(MONTH_NAME_TO_NUMBER.aout).to.equal(MONTH_NAME_TO_NUMBER.août);

        // décembre/decembre
        expect(MONTH_NAME_TO_NUMBER.decembre).to.equal(12);
        expect(MONTH_NAME_TO_NUMBER.decembre).to.equal(MONTH_NAME_TO_NUMBER.décembre);
      });
    });

    describe('Italian months', function () {
      it('should have Italian month names', function () {
        expect(MONTH_NAME_TO_NUMBER.gennaio).to.equal(1);
        expect(MONTH_NAME_TO_NUMBER.febbraio).to.equal(2);
        expect(MONTH_NAME_TO_NUMBER.marzo).to.equal(3);
        expect(MONTH_NAME_TO_NUMBER.aprile).to.equal(4);
        expect(MONTH_NAME_TO_NUMBER.maggio).to.equal(5);
        expect(MONTH_NAME_TO_NUMBER.giugno).to.equal(6);
        expect(MONTH_NAME_TO_NUMBER.luglio).to.equal(7);
        expect(MONTH_NAME_TO_NUMBER.agosto).to.equal(8);
        expect(MONTH_NAME_TO_NUMBER.settembre).to.equal(9);
        expect(MONTH_NAME_TO_NUMBER.ottobre).to.equal(10);
        expect(MONTH_NAME_TO_NUMBER.dicembre).to.equal(12);
      });

      it('should not have duplicate for novembre (same as French)', function () {
        // Italian novembre is the same as French novembre
        expect(MONTH_NAME_TO_NUMBER.novembre).to.equal(11);
      });
    });

    describe('Immutability', function () {
      it('should be frozen', function () {
        expect(Object.isFrozen(MONTH_NAME_TO_NUMBER)).to.be.true;
      });

      it('should not allow modifications', function () {
        // Attempting to modify should either throw or be silently ignored
        const originalValue = MONTH_NAME_TO_NUMBER.january;
        try {
          // @ts-expect-error - intentionally testing mutation
          MONTH_NAME_TO_NUMBER.january = 99;
        } catch {
          // Expected in strict mode
        }
        expect(MONTH_NAME_TO_NUMBER.january).to.equal(originalValue);
      });
    });
  });

  describe('MONTH_NAMES', function () {
    it('should be a Set', function () {
      expect(MONTH_NAMES).to.be.instanceOf(Set);
    });

    it('should contain all keys from MONTH_NAME_TO_NUMBER', function () {
      const recordKeys = Object.keys(MONTH_NAME_TO_NUMBER);
      expect(MONTH_NAMES.size).to.equal(recordKeys.length);

      for (const key of recordKeys) {
        expect(MONTH_NAMES.has(key)).to.be.true;
      }
    });

    it('should contain English months', function () {
      expect(MONTH_NAMES.has('january')).to.be.true;
      expect(MONTH_NAMES.has('december')).to.be.true;
    });

    it('should contain German months', function () {
      expect(MONTH_NAMES.has('januar')).to.be.true;
      expect(MONTH_NAMES.has('dezember')).to.be.true;
    });

    it('should contain French months', function () {
      expect(MONTH_NAMES.has('janvier')).to.be.true;
      expect(MONTH_NAMES.has('décembre')).to.be.true;
    });

    it('should contain Italian months', function () {
      expect(MONTH_NAMES.has('gennaio')).to.be.true;
      expect(MONTH_NAMES.has('dicembre')).to.be.true;
    });

    it('should contain accent variations', function () {
      expect(MONTH_NAMES.has('février')).to.be.true;
      expect(MONTH_NAMES.has('fevrier')).to.be.true;
      expect(MONTH_NAMES.has('août')).to.be.true;
      expect(MONTH_NAMES.has('aout')).to.be.true;
      expect(MONTH_NAMES.has('märz')).to.be.true;
      expect(MONTH_NAMES.has('maerz')).to.be.true;
    });
  });

  describe('isMonthName()', function () {
    it('should return true for valid month names', function () {
      expect(isMonthName('january')).to.be.true;
      expect(isMonthName('januar')).to.be.true;
      expect(isMonthName('janvier')).to.be.true;
      expect(isMonthName('gennaio')).to.be.true;
    });

    it('should be case-insensitive', function () {
      expect(isMonthName('JANUARY')).to.be.true;
      expect(isMonthName('January')).to.be.true;
      expect(isMonthName('JaNuArY')).to.be.true;
    });

    it('should return false for non-month names', function () {
      expect(isMonthName('monday')).to.be.false;
      expect(isMonthName('random')).to.be.false;
      expect(isMonthName('notamonth')).to.be.false;
      expect(isMonthName('')).to.be.false;
    });

    it('should handle accent variations case-insensitively', function () {
      expect(isMonthName('FÉVRIER')).to.be.true;
      expect(isMonthName('Février')).to.be.true;
      expect(isMonthName('MARS')).to.be.true;
    });
  });

  describe('getMonthNumber()', function () {
    it('should return correct month number for valid months', function () {
      expect(getMonthNumber('january')).to.equal(1);
      expect(getMonthNumber('march')).to.equal(3);
      expect(getMonthNumber('december')).to.equal(12);
    });

    it('should be case-insensitive', function () {
      expect(getMonthNumber('MARCH')).to.equal(3);
      expect(getMonthNumber('March')).to.equal(3);
      expect(getMonthNumber('mArCh')).to.equal(3);
    });

    it('should return undefined for non-month names', function () {
      expect(getMonthNumber('monday')).to.be.undefined;
      expect(getMonthNumber('notamonth')).to.be.undefined;
      expect(getMonthNumber('')).to.be.undefined;
    });

    it('should return correct number for German months', function () {
      expect(getMonthNumber('januar')).to.equal(1);
      expect(getMonthNumber('märz')).to.equal(3);
      expect(getMonthNumber('maerz')).to.equal(3);
    });

    it('should return correct number for French months', function () {
      expect(getMonthNumber('janvier')).to.equal(1);
      expect(getMonthNumber('février')).to.equal(2);
      expect(getMonthNumber('fevrier')).to.equal(2);
      expect(getMonthNumber('août')).to.equal(8);
      expect(getMonthNumber('aout')).to.equal(8);
    });

    it('should return correct number for Italian months', function () {
      expect(getMonthNumber('gennaio')).to.equal(1);
      expect(getMonthNumber('marzo')).to.equal(3);
      expect(getMonthNumber('dicembre')).to.equal(12);
    });
  });

  describe('SUPPORTED_LANGUAGES', function () {
    it('should include all 4 languages', function () {
      expect(SUPPORTED_LANGUAGES).to.include('en');
      expect(SUPPORTED_LANGUAGES).to.include('de');
      expect(SUPPORTED_LANGUAGES).to.include('fr');
      expect(SUPPORTED_LANGUAGES).to.include('it');
    });

    it('should have exactly 4 languages', function () {
      expect(SUPPORTED_LANGUAGES).to.have.lengthOf(4);
    });
  });

  describe('Data consistency', function () {
    it('should have correct month numbers (1-12 range)', function () {
      for (const [name, number] of Object.entries(MONTH_NAME_TO_NUMBER)) {
        expect(number).to.be.at.least(1, `${name} has month < 1`);
        expect(number).to.be.at.most(12, `${name} has month > 12`);
      }
    });

    it('should have at least 12 unique month numbers covered', function () {
      const monthNumbers = new Set(Object.values(MONTH_NAME_TO_NUMBER));
      expect(monthNumbers.size).to.equal(12);
    });

    it('should have all 12 month numbers represented', function () {
      const monthNumbers = new Set(Object.values(MONTH_NAME_TO_NUMBER));
      for (let i = 1; i <= 12; i++) {
        expect(monthNumbers.has(i)).to.be.true;
      }
    });

    it('should have consistent accent variations mapping to same month', function () {
      // French accent pairs
      expect(MONTH_NAME_TO_NUMBER.février).to.equal(MONTH_NAME_TO_NUMBER.fevrier);
      expect(MONTH_NAME_TO_NUMBER.août).to.equal(MONTH_NAME_TO_NUMBER.aout);
      expect(MONTH_NAME_TO_NUMBER.décembre).to.equal(MONTH_NAME_TO_NUMBER.decembre);

      // German accent pairs
      expect(MONTH_NAME_TO_NUMBER.märz).to.equal(MONTH_NAME_TO_NUMBER.maerz);
    });
  });
});
