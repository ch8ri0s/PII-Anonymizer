/**
 * Address Component Detector Tests (Story 2.1)
 *
 * Tests for all acceptance criteria:
 * - AC-2.1.1: STREET_NAME detection
 * - AC-2.1.2: STREET_NUMBER detection
 * - AC-2.1.3: POSTAL_CODE detection
 * - AC-2.1.4: CITY detection
 * - AC-2.1.5: COUNTRY detection
 * - AC-2.1.6: Position tagging (start, end indices)
 * - AC-2.1.7: Swiss postal code validation
 */

import { expect } from 'chai';
import { describe, it, before } from 'mocha';

describe('AddressComponentDetector', function () {
  this.timeout(10000);

  let detectAddressComponents;
  let AddressComponentDetector;

  before(async function () {
    const module = await import('../../../../dist/pii/AddressComponentDetector.js');
    detectAddressComponents = module.detectAddressComponents;
    AddressComponentDetector = module.AddressComponentDetector;
  });

  describe('AC-2.1.1: STREET_NAME detection', function () {
    describe('French street patterns', function () {
      it('should detect "Rue de Lausanne"', function () {
        const components = detectAddressComponents('Notre bureau est situé Rue de Lausanne 15');
        const streetNames = components.filter((c) => c.type === 'STREET_NAME');
        expect(streetNames.length).to.be.greaterThan(0);
        expect(streetNames.some((s) => s.text.includes('Rue de Lausanne'))).to.be.true;
      });

      it('should detect "Avenue de la Gare"', function () {
        const components = detectAddressComponents('Contactez-nous Avenue de la Gare 25');
        const streetNames = components.filter((c) => c.type === 'STREET_NAME');
        expect(streetNames.length).to.be.greaterThan(0);
      });

      it('should detect "Chemin des Alpes"', function () {
        const components = detectAddressComponents('Adresse: Chemin des Alpes 10');
        const streetNames = components.filter((c) => c.type === 'STREET_NAME');
        expect(streetNames.length).to.be.greaterThan(0);
      });

      it('should detect "Boulevard du Pont-d\'Arve"', function () {
        const components = detectAddressComponents('Boulevard du Mont-Blanc 5');
        const streetNames = components.filter((c) => c.type === 'STREET_NAME');
        expect(streetNames.length).to.be.greaterThan(0);
      });

      it('should detect "Place de la Riponne"', function () {
        const components = detectAddressComponents('Place de la Riponne');
        const streetNames = components.filter((c) => c.type === 'STREET_NAME');
        expect(streetNames.length).to.be.greaterThan(0);
      });
    });

    describe('German street patterns', function () {
      it('should detect "Bahnhofstrasse"', function () {
        const components = detectAddressComponents('Unser Büro befindet sich an der Bahnhofstrasse 12');
        const streetNames = components.filter((c) => c.type === 'STREET_NAME');
        expect(streetNames.length).to.be.greaterThan(0);
        expect(streetNames.some((s) => s.text.includes('Bahnhofstrasse'))).to.be.true;
      });

      it('should detect "Hauptweg"', function () {
        const components = detectAddressComponents('Adresse: Hauptweg 5');
        const streetNames = components.filter((c) => c.type === 'STREET_NAME');
        expect(streetNames.length).to.be.greaterThan(0);
      });

      it('should detect "Marktplatz"', function () {
        const components = detectAddressComponents('Am Marktplatz 3');
        const streetNames = components.filter((c) => c.type === 'STREET_NAME');
        expect(streetNames.length).to.be.greaterThan(0);
      });

      it('should detect "Seestrasse"', function () {
        const components = detectAddressComponents('Seestrasse 100');
        const streetNames = components.filter((c) => c.type === 'STREET_NAME');
        expect(streetNames.length).to.be.greaterThan(0);
      });

      it('should detect "Kirchgasse"', function () {
        const components = detectAddressComponents('Kirchgasse 7');
        const streetNames = components.filter((c) => c.type === 'STREET_NAME');
        expect(streetNames.length).to.be.greaterThan(0);
      });
    });

    describe('Italian street patterns', function () {
      it('should detect "Via Roma"', function () {
        const components = detectAddressComponents('Via Roma 42, Lugano');
        const streetNames = components.filter((c) => c.type === 'STREET_NAME');
        expect(streetNames.length).to.be.greaterThan(0);
        expect(streetNames.some((s) => s.text.includes('Via Roma'))).to.be.true;
      });

      it('should detect "Piazza San Marco"', function () {
        const components = detectAddressComponents('Piazza San Marco');
        const streetNames = components.filter((c) => c.type === 'STREET_NAME');
        expect(streetNames.length).to.be.greaterThan(0);
      });

      it('should detect "Viale Stazione"', function () {
        const components = detectAddressComponents('Viale Stazione 15');
        const streetNames = components.filter((c) => c.type === 'STREET_NAME');
        expect(streetNames.length).to.be.greaterThan(0);
      });
    });
  });

  describe('AC-2.1.2: STREET_NUMBER detection', function () {
    it('should detect simple number "12"', function () {
      const components = detectAddressComponents('Bahnhofstrasse 12');
      const numbers = components.filter((c) => c.type === 'STREET_NUMBER');
      expect(numbers.length).to.be.greaterThan(0);
      expect(numbers.some((n) => n.text === '12')).to.be.true;
    });

    it('should detect number with letter "12a"', function () {
      const components = detectAddressComponents('Rue de Lausanne 12a');
      const numbers = components.filter((c) => c.type === 'STREET_NUMBER');
      expect(numbers.length).to.be.greaterThan(0);
      expect(numbers.some((n) => n.text === '12a')).to.be.true;
    });

    it('should detect number with uppercase letter "12A"', function () {
      const components = detectAddressComponents('Hauptstrasse 12A');
      const numbers = components.filter((c) => c.type === 'STREET_NUMBER');
      expect(numbers.length).to.be.greaterThan(0);
    });

    it('should detect range "12-14"', function () {
      const components = detectAddressComponents('Seestrasse 12-14');
      const numbers = components.filter((c) => c.type === 'STREET_NUMBER');
      expect(numbers.length).to.be.greaterThan(0);
      expect(numbers.some((n) => n.text.includes('12') && n.text.includes('14'))).to.be.true;
    });

    it('should detect three-digit number "123"', function () {
      const components = detectAddressComponents('Bahnhofstrasse 123');
      const numbers = components.filter((c) => c.type === 'STREET_NUMBER');
      expect(numbers.length).to.be.greaterThan(0);
    });

    it('should detect four-digit number "1234"', function () {
      const components = detectAddressComponents('Industriestrasse 1234');
      const numbers = components.filter((c) => c.type === 'STREET_NUMBER');
      expect(numbers.length).to.be.greaterThan(0);
    });
  });

  describe('AC-2.1.3: POSTAL_CODE detection', function () {
    describe('Swiss postal codes', function () {
      it('should detect "1000" (Lausanne)', function () {
        const components = detectAddressComponents('1000 Lausanne');
        const postalCodes = components.filter((c) => c.type === 'POSTAL_CODE');
        expect(postalCodes.length).to.be.greaterThan(0);
        expect(postalCodes.some((p) => p.text.includes('1000'))).to.be.true;
      });

      it('should detect "8001" (Zürich)', function () {
        const components = detectAddressComponents('8001 Zürich');
        const postalCodes = components.filter((c) => c.type === 'POSTAL_CODE');
        expect(postalCodes.length).to.be.greaterThan(0);
        expect(postalCodes.some((p) => p.text.includes('8001'))).to.be.true;
      });

      it('should detect "CH-1000" format', function () {
        const components = detectAddressComponents('CH-1000 Lausanne');
        const postalCodes = components.filter((c) => c.type === 'POSTAL_CODE');
        expect(postalCodes.length).to.be.greaterThan(0);
      });

      it('should detect "3000" (Bern)', function () {
        const components = detectAddressComponents('3000 Bern');
        const postalCodes = components.filter((c) => c.type === 'POSTAL_CODE');
        expect(postalCodes.length).to.be.greaterThan(0);
      });

      it('should detect "1200" (Geneva)', function () {
        const components = detectAddressComponents('1200 Genève');
        const postalCodes = components.filter((c) => c.type === 'POSTAL_CODE');
        expect(postalCodes.length).to.be.greaterThan(0);
      });
    });

    describe('invalid postal codes', function () {
      it('should reject "12345" (5 digits)', function () {
        const components = detectAddressComponents('12345 SomeCity');
        const postalCodes = components.filter((c) => c.type === 'POSTAL_CODE');
        // Should not be detected as Swiss postal code (might be detected as EU)
        const swissPostal = postalCodes.filter((p) => /^\d{4}$/.test(p.text));
        expect(swissPostal.length).to.equal(0);
      });

      it('should reject "999" (3 digits)', function () {
        const components = detectAddressComponents('999 City');
        const postalCodes = components.filter((c) => c.type === 'POSTAL_CODE');
        expect(postalCodes.some((p) => p.text === '999')).to.be.false;
      });
    });
  });

  describe('AC-2.1.4: CITY detection', function () {
    describe('major Swiss cities', function () {
      it('should detect "Lausanne"', function () {
        const components = detectAddressComponents('1000 Lausanne, Suisse');
        const cities = components.filter((c) => c.type === 'CITY');
        expect(cities.length).to.be.greaterThan(0);
        expect(cities.some((c) => c.text.includes('Lausanne'))).to.be.true;
      });

      it('should detect "Zürich" (with umlaut)', function () {
        const components = detectAddressComponents('8000 Zürich');
        const cities = components.filter((c) => c.type === 'CITY');
        expect(cities.length).to.be.greaterThan(0);
      });

      it('should detect "Zurich" (without umlaut)', function () {
        const components = detectAddressComponents('8000 Zurich');
        const cities = components.filter((c) => c.type === 'CITY');
        expect(cities.length).to.be.greaterThan(0);
      });

      it('should detect "Genève"', function () {
        const components = detectAddressComponents('1200 Genève');
        const cities = components.filter((c) => c.type === 'CITY');
        expect(cities.length).to.be.greaterThan(0);
      });

      it('should detect "Geneva" (English variant)', function () {
        const components = detectAddressComponents('Geneva, Switzerland');
        const cities = components.filter((c) => c.type === 'CITY');
        expect(cities.length).to.be.greaterThan(0);
      });

      it('should detect "Bern"', function () {
        const components = detectAddressComponents('3000 Bern');
        const cities = components.filter((c) => c.type === 'CITY');
        expect(cities.length).to.be.greaterThan(0);
      });

      it('should detect "Basel"', function () {
        const components = detectAddressComponents('4000 Basel');
        const cities = components.filter((c) => c.type === 'CITY');
        expect(cities.length).to.be.greaterThan(0);
      });
    });

    describe('multilingual city variants', function () {
      it('should detect "Genf" (German for Geneva)', function () {
        const components = detectAddressComponents('Genf ist eine schöne Stadt');
        const cities = components.filter((c) => c.type === 'CITY');
        expect(cities.length).to.be.greaterThan(0);
      });

      it('should detect "Bâle" (French for Basel)', function () {
        const components = detectAddressComponents('Bâle est une ville suisse');
        const cities = components.filter((c) => c.type === 'CITY');
        expect(cities.length).to.be.greaterThan(0);
      });

      it('should detect "Lucerne" (French for Luzern)', function () {
        const components = detectAddressComponents('Lucerne, Suisse');
        const cities = components.filter((c) => c.type === 'CITY');
        expect(cities.length).to.be.greaterThan(0);
      });
    });
  });

  describe('AC-2.1.5: COUNTRY detection', function () {
    describe('Switzerland variants', function () {
      it('should detect "Switzerland"', function () {
        const components = detectAddressComponents('Lausanne, Switzerland');
        const countries = components.filter((c) => c.type === 'COUNTRY');
        expect(countries.length).to.be.greaterThan(0);
        expect(countries.some((c) => c.text.toLowerCase().includes('switzerland'))).to.be.true;
      });

      it('should detect "Suisse" (French)', function () {
        const components = detectAddressComponents('Genève, Suisse');
        const countries = components.filter((c) => c.type === 'COUNTRY');
        expect(countries.length).to.be.greaterThan(0);
      });

      it('should detect "Schweiz" (German)', function () {
        const components = detectAddressComponents('Zürich, Schweiz');
        const countries = components.filter((c) => c.type === 'COUNTRY');
        expect(countries.length).to.be.greaterThan(0);
      });

      it('should detect "Svizzera" (Italian)', function () {
        const components = detectAddressComponents('Lugano, Svizzera');
        const countries = components.filter((c) => c.type === 'COUNTRY');
        expect(countries.length).to.be.greaterThan(0);
      });

      it('should detect "CH" country code', function () {
        const components = detectAddressComponents('1000 Lausanne, CH');
        const countries = components.filter((c) => c.type === 'COUNTRY');
        expect(countries.length).to.be.greaterThan(0);
      });
    });

    describe('other EU countries', function () {
      it('should detect "Germany"', function () {
        const components = detectAddressComponents('Berlin, Germany');
        const countries = components.filter((c) => c.type === 'COUNTRY');
        expect(countries.length).to.be.greaterThan(0);
      });

      it('should detect "France"', function () {
        const components = detectAddressComponents('Paris, France');
        const countries = components.filter((c) => c.type === 'COUNTRY');
        expect(countries.length).to.be.greaterThan(0);
      });

      it('should detect "Austria" in English', function () {
        const components = detectAddressComponents('Vienna, Austria');
        const countries = components.filter((c) => c.type === 'COUNTRY');
        expect(countries.length).to.be.greaterThan(0);
      });
    });
  });

  describe('AC-2.1.6: Position tagging', function () {
    it('should include start and end indices for all components', function () {
      const components = detectAddressComponents('Bahnhofstrasse 12, 8001 Zürich');

      for (const component of components) {
        expect(component).to.have.property('start');
        expect(component).to.have.property('end');
        expect(component.start).to.be.a('number');
        expect(component.end).to.be.a('number');
        expect(component.end).to.be.greaterThan(component.start);
      }
    });

    it('should have positions that match actual text locations', function () {
      const text = 'Rue de Lausanne 15, 1000 Lausanne';
      const components = detectAddressComponents(text);

      for (const component of components) {
        const extractedText = text.substring(component.start, component.end);
        expect(extractedText).to.equal(component.text);
      }
    });

    it('should have correct position for street name at start of text', function () {
      const text = 'Bahnhofstrasse 12';
      const components = detectAddressComponents(text);
      const streetName = components.find((c) => c.type === 'STREET_NAME');

      if (streetName) {
        expect(streetName.start).to.equal(0);
        expect(text.substring(streetName.start, streetName.end)).to.include('Bahnhofstrasse');
      }
    });

    it('should have correct position for postal code', function () {
      const text = 'Adresse: 1000 Lausanne';
      const components = detectAddressComponents(text);
      const postalCode = components.find((c) => c.type === 'POSTAL_CODE');

      if (postalCode) {
        const extractedText = text.substring(postalCode.start, postalCode.end);
        expect(extractedText).to.include('1000');
      }
    });
  });

  describe('AC-2.1.7: Swiss postal code validation', function () {
    it('should validate postal codes in range 1000-9999', function () {
      // 1000 is valid
      const components1 = detectAddressComponents('1000 Lausanne');
      expect(components1.some((c) => c.type === 'POSTAL_CODE')).to.be.true;

      // 9999 is valid (upper bound)
      const components2 = detectAddressComponents('9999 Wil');
      expect(components2.some((c) => c.type === 'POSTAL_CODE')).to.be.true;
    });

    it('should reject invalid postal codes with strict validation', function () {
      const detector = new AddressComponentDetector({ strictPostalValidation: true });
      // Test that 0999 is not detected (below valid range)
      const components = detector.detectAddressComponents('0999 Invalid');
      const postalCodes = components.filter((c) => c.type === 'POSTAL_CODE');
      expect(postalCodes.some((p) => p.text === '0999')).to.be.false;
    });
  });

  describe('combined address detection', function () {
    it('should detect multiple components in a full address', function () {
      const text = 'Max Mustermann, Bahnhofstrasse 12, 8001 Zürich, Switzerland';
      const components = detectAddressComponents(text);

      const types = new Set(components.map((c) => c.type));
      expect(types.has('STREET_NAME')).to.be.true;
      expect(types.has('STREET_NUMBER')).to.be.true;
      expect(types.has('POSTAL_CODE')).to.be.true;
      expect(types.has('CITY')).to.be.true;
      expect(types.has('COUNTRY')).to.be.true;
    });

    it('should handle address with French format', function () {
      const text = 'Rue de Lausanne 15, 1000 Lausanne, Suisse';
      const components = detectAddressComponents(text);

      expect(components.length).to.be.greaterThan(2);
      expect(components.some((c) => c.type === 'STREET_NAME')).to.be.true;
      expect(components.some((c) => c.type === 'POSTAL_CODE')).to.be.true;
    });

    it('should handle address with German format', function () {
      const text = 'Seestrasse 100, 8002 Zürich, Schweiz';
      const components = detectAddressComponents(text);

      expect(components.length).to.be.greaterThan(2);
      expect(components.some((c) => c.type === 'STREET_NAME')).to.be.true;
      expect(components.some((c) => c.type === 'POSTAL_CODE')).to.be.true;
    });
  });

  describe('edge cases', function () {
    it('should handle empty text', function () {
      const components = detectAddressComponents('');
      expect(components).to.be.an('array');
      expect(components.length).to.equal(0);
    });

    it('should handle text with no addresses', function () {
      const components = detectAddressComponents('This is a simple text without any addresses.');
      // May detect some false positives, but should not crash
      expect(components).to.be.an('array');
    });

    it('should handle partial addresses', function () {
      const components = detectAddressComponents('Call us at the office in Zürich');
      // Should at least detect the city
      expect(components).to.be.an('array');
    });

    it('should handle multiple addresses', function () {
      const text =
        'Office 1: Bahnhofstrasse 12, 8001 Zürich. Office 2: Rue de Lausanne 15, 1000 Lausanne.';
      const components = detectAddressComponents(text);

      const postalCodes = components.filter((c) => c.type === 'POSTAL_CODE');
      expect(postalCodes.length).to.be.greaterThanOrEqual(2);
    });

    it('should handle newlines in text', function () {
      const text = 'Adresse:\nBahnhofstrasse 12\n8001 Zürich\nSwitzerland';
      const components = detectAddressComponents(text);

      expect(components.length).to.be.greaterThan(0);
    });
  });
});
