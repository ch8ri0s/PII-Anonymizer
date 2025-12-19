/**
 * Swiss Postal Database Tests (Story 2.1, Task 2)
 *
 * Tests for AC-2.1.7: Swiss postal codes (1000-9999) are validated against known ranges
 */

import { expect } from 'chai';
import { describe, it, before } from 'mocha';

describe('SwissPostalDatabase', function () {
  this.timeout(10000);

  let getSwissPostalDatabase;
  let database;

  before(async function () {
    const module = await import('../../../../dist/pii/SwissPostalDatabase.js');
    getSwissPostalDatabase = module.getSwissPostalDatabase;
    database = getSwissPostalDatabase();
  });

  describe('validate()', function () {
    describe('valid Swiss postal codes', function () {
      it('should return true for 1000 (Lausanne)', function () {
        expect(database.validate('1000')).to.be.true;
      });

      it('should return true for 8001 (Zürich)', function () {
        expect(database.validate('8001')).to.be.true;
      });

      it('should return true for 9999 (upper bound)', function () {
        expect(database.validate('9999')).to.be.true;
      });

      it('should return true for CH-1000 format', function () {
        expect(database.validate('CH-1000')).to.be.true;
      });

      it('should return true for CH 1000 format (space)', function () {
        expect(database.validate('CH 1000')).to.be.true;
      });

      it('should return true for 3000 (Bern)', function () {
        expect(database.validate('3000')).to.be.true;
      });

      it('should return true for 1200 (Geneva)', function () {
        expect(database.validate('1200')).to.be.true;
      });

      it('should return true for 4000 (Basel)', function () {
        expect(database.validate('4000')).to.be.true;
      });
    });

    describe('invalid postal codes', function () {
      it('should return false for 12345 (5 digits)', function () {
        expect(database.validate('12345')).to.be.false;
      });

      it('should return false for 999 (3 digits)', function () {
        expect(database.validate('999')).to.be.false;
      });

      it('should return false for "abc" (non-numeric)', function () {
        expect(database.validate('abc')).to.be.false;
      });

      it('should return false for empty string', function () {
        expect(database.validate('')).to.be.false;
      });

      it('should return false for 0999 (below 1000)', function () {
        expect(database.validate('0999')).to.be.false;
      });
    });
  });

  describe('lookup()', function () {
    describe('known postal codes', function () {
      it('should return city data for 1000 (Lausanne)', function () {
        const result = database.lookup('1000');
        expect(result).to.not.be.null;
        expect(result.city).to.equal('Lausanne');
        expect(result.canton).to.equal('VD');
      });

      it('should return city data for 8000 (Zürich)', function () {
        const result = database.lookup('8000');
        expect(result).to.not.be.null;
        expect(result.city).to.equal('Zürich');
        expect(result.canton).to.equal('ZH');
      });

      it('should return city data for 1200 (Genève)', function () {
        const result = database.lookup('1200');
        expect(result).to.not.be.null;
        expect(result.city).to.equal('Genève');
        expect(result.canton).to.equal('GE');
      });

      it('should return city data for 3000 (Bern)', function () {
        const result = database.lookup('3000');
        expect(result).to.not.be.null;
        expect(result.city).to.equal('Bern');
        expect(result.canton).to.equal('BE');
      });

      it('should return city data for 4000 (Basel)', function () {
        const result = database.lookup('4000');
        expect(result).to.not.be.null;
        expect(result.city).to.equal('Basel');
        expect(result.canton).to.equal('BS');
      });

      it('should return city data for 6000 (Luzern)', function () {
        const result = database.lookup('6000');
        expect(result).to.not.be.null;
        expect(result.city).to.equal('Luzern');
        expect(result.canton).to.equal('LU');
      });

      it('should include canton name in result', function () {
        const result = database.lookup('1000');
        expect(result).to.not.be.null;
        expect(result.cantonName).to.equal('Vaud');
      });

      it('should handle CH- prefix', function () {
        const result = database.lookup('CH-1000');
        expect(result).to.not.be.null;
        expect(result.city).to.equal('Lausanne');
      });
    });

    describe('unknown postal codes', function () {
      it('should return null for non-existent code', function () {
        const result = database.lookup('0001');
        expect(result).to.be.null;
      });

      it('should return null for invalid format', function () {
        const result = database.lookup('abc');
        expect(result).to.be.null;
      });
    });
  });

  describe('findByCity()', function () {
    it('should find postal codes for Lausanne', function () {
      const codes = database.findByCity('Lausanne');
      expect(codes).to.be.an('array');
      expect(codes).to.include('1000');
    });

    it('should find postal codes for Zürich (with umlaut)', function () {
      const codes = database.findByCity('Zürich');
      expect(codes).to.be.an('array');
      expect(codes.length).to.be.greaterThan(0);
      expect(codes).to.include('8000');
    });

    it('should be case-insensitive', function () {
      const codes = database.findByCity('LAUSANNE');
      expect(codes).to.be.an('array');
      expect(codes).to.include('1000');
    });

    it('should return empty array for unknown city', function () {
      const codes = database.findByCity('UnknownCity12345');
      expect(codes).to.be.an('array');
      expect(codes.length).to.equal(0);
    });
  });

  describe('isKnownCity()', function () {
    it('should return true for Lausanne', function () {
      expect(database.isKnownCity('Lausanne')).to.be.true;
    });

    it('should return true for Zürich', function () {
      expect(database.isKnownCity('Zürich')).to.be.true;
    });

    it('should return true for Geneva (alias)', function () {
      expect(database.isKnownCity('Geneva')).to.be.true;
    });

    it('should return false for unknown city', function () {
      expect(database.isKnownCity('FakeCity12345')).to.be.false;
    });

    it('should be case-insensitive', function () {
      expect(database.isKnownCity('LAUSANNE')).to.be.true;
    });
  });

  describe('getCantonForPostalCode()', function () {
    it('should return VD for 1000', function () {
      expect(database.getCantonForPostalCode('1000')).to.equal('VD');
    });

    it('should return ZH for 8000', function () {
      expect(database.getCantonForPostalCode('8000')).to.equal('ZH');
    });

    it('should return null for unknown code', function () {
      expect(database.getCantonForPostalCode('0001')).to.be.null;
    });
  });

  describe('getStats()', function () {
    it('should return database statistics', function () {
      const stats = database.getStats();
      expect(stats).to.have.property('postalCodes');
      expect(stats).to.have.property('cities');
      expect(stats).to.have.property('cantons');
      expect(stats.postalCodes).to.be.greaterThan(100);
      expect(stats.cantons).to.equal(26);
    });
  });

  describe('singleton pattern', function () {
    it('should return same instance from getSwissPostalDatabase()', function () {
      const db1 = getSwissPostalDatabase();
      const db2 = getSwissPostalDatabase();
      expect(db1).to.equal(db2);
    });
  });
});
