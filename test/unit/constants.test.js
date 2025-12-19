/**
 * Unit tests for central constants configuration
 * Story 6.8 - Constants and Magic Numbers
 */

import { expect } from 'chai';

// Import all constants from the compiled module
import {
  PREVIEW,
  PROCESSING,
  SECURITY,
  TIMEOUT,
  LOGGING,
  UI,
  CONSTANTS,
} from '../../dist/config/constants.js';

describe('Central Constants Configuration', function () {
  describe('PREVIEW constants', function () {
    it('should have LINE_LIMIT defined as 20', function () {
      expect(PREVIEW.LINE_LIMIT).to.equal(20);
    });

    it('should have CHAR_LIMIT defined as 1000', function () {
      expect(PREVIEW.CHAR_LIMIT).to.equal(1000);
    });

    it('should have DEFAULT_LINES defined as 100', function () {
      expect(PREVIEW.DEFAULT_LINES).to.equal(100);
    });

    it('should have DEFAULT_CHARS defined as 10000', function () {
      expect(PREVIEW.DEFAULT_CHARS).to.equal(10000);
    });

    it('should have all expected keys', function () {
      expect(PREVIEW).to.have.all.keys('LINE_LIMIT', 'CHAR_LIMIT', 'DEFAULT_LINES', 'DEFAULT_CHARS');
    });
  });

  describe('PROCESSING constants', function () {
    it('should have FUZZY_MATCH_GAP_TOLERANCE defined as 2', function () {
      expect(PROCESSING.FUZZY_MATCH_GAP_TOLERANCE).to.equal(2);
    });

    it('should have MAX_ENTITY_LENGTH defined as 50', function () {
      expect(PROCESSING.MAX_ENTITY_LENGTH).to.equal(50);
    });

    it('should have MIN_ENTITY_LENGTH defined as 3', function () {
      expect(PROCESSING.MIN_ENTITY_LENGTH).to.equal(3);
    });

    it('should have MAX_ENTITY_CHARS_CLEANED defined as 30', function () {
      expect(PROCESSING.MAX_ENTITY_CHARS_CLEANED).to.equal(30);
    });

    it('should have REGEX_TIMEOUT_MS defined as 100', function () {
      expect(PROCESSING.REGEX_TIMEOUT_MS).to.equal(100);
    });

    it('should have BASE_TIMEOUT_MS defined as 30000', function () {
      expect(PROCESSING.BASE_TIMEOUT_MS).to.equal(30000);
    });

    it('should have PER_MB_TIMEOUT_MS defined as 10000', function () {
      expect(PROCESSING.PER_MB_TIMEOUT_MS).to.equal(10000);
    });

    it('should have all expected keys', function () {
      expect(PROCESSING).to.have.all.keys(
        'FUZZY_MATCH_GAP_TOLERANCE',
        'MAX_ENTITY_LENGTH',
        'MIN_ENTITY_LENGTH',
        'MAX_ENTITY_CHARS_CLEANED',
        'REGEX_TIMEOUT_MS',
        'BASE_TIMEOUT_MS',
        'PER_MB_TIMEOUT_MS',
      );
    });
  });

  describe('SECURITY constants', function () {
    it('should have MAX_FILE_SIZE_BYTES defined as 100MB', function () {
      expect(SECURITY.MAX_FILE_SIZE_BYTES).to.equal(100 * 1024 * 1024);
    });

    it('should have MAX_STRING_LENGTH defined as 1MB', function () {
      expect(SECURITY.MAX_STRING_LENGTH).to.equal(1024 * 1024);
    });

    it('should have MAX_ARRAY_ITEMS defined as 10000', function () {
      expect(SECURITY.MAX_ARRAY_ITEMS).to.equal(10000);
    });

    it('should have MAX_OBJECT_DEPTH defined as 10', function () {
      expect(SECURITY.MAX_OBJECT_DEPTH).to.equal(10);
    });

    it('should have MAX_PATH_LENGTH defined as 4096', function () {
      expect(SECURITY.MAX_PATH_LENGTH).to.equal(4096);
    });

    it('should have all expected keys', function () {
      expect(SECURITY).to.have.all.keys(
        'MAX_FILE_SIZE_BYTES',
        'MAX_STRING_LENGTH',
        'MAX_ARRAY_ITEMS',
        'MAX_OBJECT_DEPTH',
        'MAX_PATH_LENGTH',
      );
    });
  });

  describe('TIMEOUT constants', function () {
    it('should have FILE_PROCESSING_MS defined as 60 seconds', function () {
      expect(TIMEOUT.FILE_PROCESSING_MS).to.equal(60 * 1000);
    });

    it('should have FILE_PREVIEW_MS defined as 30 seconds', function () {
      expect(TIMEOUT.FILE_PREVIEW_MS).to.equal(30 * 1000);
    });

    it('should have METADATA_MS defined as 10 seconds', function () {
      expect(TIMEOUT.METADATA_MS).to.equal(10 * 1000);
    });

    it('should have JSON_READ_MS defined as 5 seconds', function () {
      expect(TIMEOUT.JSON_READ_MS).to.equal(5 * 1000);
    });

    it('should have MIN_MS defined as 10 seconds', function () {
      expect(TIMEOUT.MIN_MS).to.equal(10 * 1000);
    });

    it('should have MAX_MS defined as 10 minutes', function () {
      expect(TIMEOUT.MAX_MS).to.equal(600 * 1000);
    });

    it('should have all expected keys', function () {
      expect(TIMEOUT).to.have.all.keys(
        'FILE_PROCESSING_MS',
        'FILE_PREVIEW_MS',
        'METADATA_MS',
        'JSON_READ_MS',
        'MIN_MS',
        'MAX_MS',
      );
    });
  });

  describe('LOGGING constants', function () {
    it('should have MAX_LOG_FILES defined as 60', function () {
      expect(LOGGING.MAX_LOG_FILES).to.equal(60);
    });

    it('should have MAX_ENTRIES_PER_FILE defined as 10000', function () {
      expect(LOGGING.MAX_ENTRIES_PER_FILE).to.equal(10000);
    });

    it('should have MAX_TOTAL_ENTRIES defined as 100000', function () {
      expect(LOGGING.MAX_TOTAL_ENTRIES).to.equal(100000);
    });

    it('should have all expected keys', function () {
      expect(LOGGING).to.have.all.keys('MAX_LOG_FILES', 'MAX_ENTRIES_PER_FILE', 'MAX_TOTAL_ENTRIES');
    });
  });

  describe('UI constants', function () {
    it('should have ANIMATION_DURATION_MS defined as 200', function () {
      expect(UI.ANIMATION_DURATION_MS).to.equal(200);
    });

    it('should have SEARCH_DEBOUNCE_MS defined as 300', function () {
      expect(UI.SEARCH_DEBOUNCE_MS).to.equal(300);
    });

    it('should have TOAST_DURATION_MS defined as 3000', function () {
      expect(UI.TOAST_DURATION_MS).to.equal(3000);
    });

    it('should have all expected keys', function () {
      expect(UI).to.have.all.keys('ANIMATION_DURATION_MS', 'SEARCH_DEBOUNCE_MS', 'TOAST_DURATION_MS');
    });
  });

  describe('CONSTANTS aggregate', function () {
    it('should contain all category objects', function () {
      expect(CONSTANTS).to.have.property('PREVIEW');
      expect(CONSTANTS).to.have.property('PROCESSING');
      expect(CONSTANTS).to.have.property('SECURITY');
      expect(CONSTANTS).to.have.property('TIMEOUT');
      expect(CONSTANTS).to.have.property('LOGGING');
      expect(CONSTANTS).to.have.property('UI');
    });

    it('should reference the same objects', function () {
      expect(CONSTANTS.PREVIEW).to.equal(PREVIEW);
      expect(CONSTANTS.PROCESSING).to.equal(PROCESSING);
      expect(CONSTANTS.SECURITY).to.equal(SECURITY);
      expect(CONSTANTS.TIMEOUT).to.equal(TIMEOUT);
      expect(CONSTANTS.LOGGING).to.equal(LOGGING);
      expect(CONSTANTS.UI).to.equal(UI);
    });
  });

  describe('Value consistency checks', function () {
    it('should have TIMEOUT.MIN_MS < TIMEOUT.MAX_MS', function () {
      expect(TIMEOUT.MIN_MS).to.be.lessThan(TIMEOUT.MAX_MS);
    });

    it('should have PROCESSING.MIN_ENTITY_LENGTH < PROCESSING.MAX_ENTITY_LENGTH', function () {
      expect(PROCESSING.MIN_ENTITY_LENGTH).to.be.lessThan(PROCESSING.MAX_ENTITY_LENGTH);
    });

    it('should have PREVIEW.LINE_LIMIT < PREVIEW.DEFAULT_LINES', function () {
      expect(PREVIEW.LINE_LIMIT).to.be.lessThan(PREVIEW.DEFAULT_LINES);
    });

    it('should have PREVIEW.CHAR_LIMIT < PREVIEW.DEFAULT_CHARS', function () {
      expect(PREVIEW.CHAR_LIMIT).to.be.lessThan(PREVIEW.DEFAULT_CHARS);
    });

    it('should have reasonable timeout ordering', function () {
      // JSON should be faster than metadata which should be faster than preview
      expect(TIMEOUT.JSON_READ_MS).to.be.lessThan(TIMEOUT.METADATA_MS);
      expect(TIMEOUT.METADATA_MS).to.be.lessThan(TIMEOUT.FILE_PREVIEW_MS);
      expect(TIMEOUT.FILE_PREVIEW_MS).to.be.lessThan(TIMEOUT.FILE_PROCESSING_MS);
    });
  });
});
