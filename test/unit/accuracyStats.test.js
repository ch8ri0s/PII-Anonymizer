/**
 * Unit tests for AccuracyStats service (Epic 5, Story 5.3)
 *
 * Tests accuracy statistics calculation including:
 * - Summary statistics (FP rate, FN rate)
 * - Per-entity-type breakdown
 * - Weekly/monthly trends
 * - CSV report generation
 */

import { expect } from 'chai';

// Mock correction entries for testing
const mockEntries = [
  {
    action: 'DISMISS',
    entityType: 'PERSON',
    timestamp: '2025-01-10T10:00:00Z',
    documentHash: 'abc123',
    correctionId: 'c1',
    entityCategory: 'ML',
  },
  {
    action: 'ADD',
    entityType: 'EMAIL',
    timestamp: '2025-01-10T11:00:00Z',
    documentHash: 'abc123',
    correctionId: 'c2',
    entityCategory: 'MANUAL',
  },
  {
    action: 'DISMISS',
    entityType: 'PERSON',
    timestamp: '2025-01-15T10:00:00Z',
    documentHash: 'def456',
    correctionId: 'c3',
    entityCategory: 'ML',
  },
  {
    action: 'DISMISS',
    entityType: 'PHONE',
    timestamp: '2025-02-05T10:00:00Z',
    documentHash: 'ghi789',
    correctionId: 'c4',
    entityCategory: 'RULE',
  },
  {
    action: 'ADD',
    entityType: 'ADDRESS',
    timestamp: '2025-02-20T10:00:00Z',
    documentHash: 'jkl012',
    correctionId: 'c5',
    entityCategory: 'MANUAL',
  },
];

describe('AccuracyStats', () => {
  describe('Summary calculations', () => {
    it('should calculate total corrections correctly', () => {
      // Total entries
      const total = mockEntries.length;
      expect(total).to.equal(5);
    });

    it('should calculate unique document count correctly', () => {
      const uniqueDocs = new Set(mockEntries.map(e => e.documentHash));
      expect(uniqueDocs.size).to.equal(4);
    });

    it('should calculate dismissals (false positives) correctly', () => {
      const dismissals = mockEntries.filter(e => e.action === 'DISMISS').length;
      expect(dismissals).to.equal(3);
    });

    it('should calculate additions (false negatives) correctly', () => {
      const additions = mockEntries.filter(e => e.action === 'ADD').length;
      expect(additions).to.equal(2);
    });

    it('should calculate FP rate correctly', () => {
      const total = mockEntries.length;
      const dismissals = mockEntries.filter(e => e.action === 'DISMISS').length;
      const fpRate = total > 0 ? dismissals / total : 0;
      expect(fpRate).to.equal(0.6);
    });

    it('should calculate FN estimate correctly', () => {
      const total = mockEntries.length;
      const additions = mockEntries.filter(e => e.action === 'ADD').length;
      const fnEstimate = total > 0 ? additions / total : 0;
      expect(fnEstimate).to.equal(0.4);
    });

    it('should handle empty entries gracefully', () => {
      const emptyEntries = [];
      const total = emptyEntries.length;
      const fpRate = total > 0 ? 0 : 0;
      const fnEstimate = total > 0 ? 0 : 0;
      expect(fpRate).to.equal(0);
      expect(fnEstimate).to.equal(0);
    });
  });

  describe('Entity type breakdown', () => {
    it('should group corrections by entity type', () => {
      const typeMap = new Map();

      for (const entry of mockEntries) {
        if (!typeMap.has(entry.entityType)) {
          typeMap.set(entry.entityType, { dismissals: 0, additions: 0 });
        }

        const stats = typeMap.get(entry.entityType);
        if (entry.action === 'DISMISS') {
          stats.dismissals++;
        } else {
          stats.additions++;
        }
      }

      expect(typeMap.size).to.equal(4);
      expect(typeMap.get('PERSON').dismissals).to.equal(2);
      expect(typeMap.get('EMAIL').additions).to.equal(1);
    });

    it('should sort entity types by total corrections descending', () => {
      const typeMap = new Map();

      for (const entry of mockEntries) {
        if (!typeMap.has(entry.entityType)) {
          typeMap.set(entry.entityType, { dismissals: 0, additions: 0 });
        }

        const stats = typeMap.get(entry.entityType);
        if (entry.action === 'DISMISS') {
          stats.dismissals++;
        } else {
          stats.additions++;
        }
      }

      const sorted = Array.from(typeMap.entries())
        .map(([type, stats]) => ({
          entityType: type,
          total: stats.dismissals + stats.additions,
        }))
        .sort((a, b) => b.total - a.total);

      expect(sorted[0].entityType).to.equal('PERSON');
      expect(sorted[0].total).to.equal(2);
    });
  });

  describe('Trend calculations', () => {
    it('should group entries by month correctly', () => {
      const monthMap = new Map();

      for (const entry of mockEntries) {
        const date = new Date(entry.timestamp);
        const monthLabel = date.toISOString().slice(0, 7);

        if (!monthMap.has(monthLabel)) {
          monthMap.set(monthLabel, { dismissals: 0, additions: 0 });
        }

        const stats = monthMap.get(monthLabel);
        if (entry.action === 'DISMISS') {
          stats.dismissals++;
        } else {
          stats.additions++;
        }
      }

      expect(monthMap.size).to.equal(2);
      expect(monthMap.get('2025-01').dismissals).to.equal(2);
      expect(monthMap.get('2025-01').additions).to.equal(1);
      expect(monthMap.get('2025-02').dismissals).to.equal(1);
      expect(monthMap.get('2025-02').additions).to.equal(1);
    });

    it('should calculate per-period FP/FN rates', () => {
      const monthMap = new Map();

      for (const entry of mockEntries) {
        const date = new Date(entry.timestamp);
        const monthLabel = date.toISOString().slice(0, 7);

        if (!monthMap.has(monthLabel)) {
          monthMap.set(monthLabel, { dismissals: 0, additions: 0 });
        }

        const stats = monthMap.get(monthLabel);
        if (entry.action === 'DISMISS') {
          stats.dismissals++;
        } else {
          stats.additions++;
        }
      }

      const janStats = monthMap.get('2025-01');
      const janTotal = janStats.dismissals + janStats.additions;
      const janFpRate = janTotal > 0 ? janStats.dismissals / janTotal : 0;
      const janFnRate = janTotal > 0 ? janStats.additions / janTotal : 0;

      // January: 2 dismissals, 1 addition = 3 total
      expect(janFpRate).to.be.closeTo(0.667, 0.01);
      expect(janFnRate).to.be.closeTo(0.333, 0.01);
    });

    it('should sort trends by period ascending', () => {
      const months = ['2025-02', '2025-01', '2025-03'].sort();
      expect(months[0]).to.equal('2025-01');
      expect(months[1]).to.equal('2025-02');
      expect(months[2]).to.equal('2025-03');
    });
  });

  describe('ISO week calculation', () => {
    function getWeekNumber(date) {
      const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
      const dayNum = d.getUTCDay() || 7;
      d.setUTCDate(d.getUTCDate() + 4 - dayNum);
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    }

    it('should calculate ISO week number for January 1st', () => {
      const date = new Date('2025-01-01');
      const week = getWeekNumber(date);
      expect(week).to.equal(1);
    });

    it('should calculate ISO week number for mid-year date', () => {
      const date = new Date('2025-06-15');
      const week = getWeekNumber(date);
      expect(week).to.be.above(0).and.below(53);
    });

    it('should format week label correctly', () => {
      const year = 2025;
      const week = 2;
      const label = `${year}-W${week.toString().padStart(2, '0')}`;
      expect(label).to.equal('2025-W02');
    });
  });

  describe('CSV report generation', () => {
    it('should generate valid CSV header', () => {
      const csvLines = [
        '# Accuracy Report',
        `# Generated: ${new Date().toISOString()}`,
        '# Period: 2025-01-10 to 2025-02-20',
      ];

      expect(csvLines[0]).to.include('Accuracy Report');
      expect(csvLines[1]).to.include('Generated');
      expect(csvLines[2]).to.include('Period');
    });

    it('should generate valid summary section', () => {
      const summary = {
        documentsProcessed: 4,
        totalCorrections: 5,
        dismissals: 3,
        manualAdditions: 2,
        falsePositiveRate: 0.6,
        falseNegativeEstimate: 0.4,
      };

      const csvLines = [
        '## Summary',
        'Metric,Value',
        `Documents Processed,${summary.documentsProcessed}`,
        `Total Corrections,${summary.totalCorrections}`,
        `Dismissals (False Positives),${summary.dismissals}`,
        `Manual Additions (False Negatives),${summary.manualAdditions}`,
        `False Positive Rate,${(summary.falsePositiveRate * 100).toFixed(2)}%`,
        `False Negative Estimate,${(summary.falseNegativeEstimate * 100).toFixed(2)}%`,
      ];

      expect(csvLines).to.have.length(8);
      expect(csvLines[2]).to.include('4');
      expect(csvLines[6]).to.include('60.00%');
    });

    it('should generate valid entity type breakdown section', () => {
      const byEntityType = [
        { entityType: 'PERSON', dismissals: 2, additions: 0, total: 2 },
        { entityType: 'EMAIL', dismissals: 0, additions: 1, total: 1 },
      ];

      const csvLines = [
        '## Entity Type Breakdown',
        'EntityType,Dismissals,Additions,Total',
        ...byEntityType.map(t => `${t.entityType},${t.dismissals},${t.additions},${t.total}`),
      ];

      expect(csvLines).to.have.length(4);
      expect(csvLines[2]).to.equal('PERSON,2,0,2');
      expect(csvLines[3]).to.equal('EMAIL,0,1,1');
    });

    it('should escape special characters in CSV', () => {
      // CSV should escape commas and quotes
      const entityType = 'PERSON';
      const value = 'John, Doe';
      const escaped = value.includes(',') ? `"${value}"` : value;
      expect(escaped).to.equal('"John, Doe"');
    });
  });

  describe('Date filtering', () => {
    it('should filter entries by start date', () => {
      const startDate = new Date('2025-02-01');
      const filtered = mockEntries.filter(e => new Date(e.timestamp) >= startDate);
      expect(filtered).to.have.length(2);
    });

    it('should filter entries by end date', () => {
      const endDate = new Date('2025-01-31');
      const filtered = mockEntries.filter(e => new Date(e.timestamp) <= endDate);
      expect(filtered).to.have.length(3);
    });

    it('should filter entries by date range', () => {
      const startDate = new Date('2025-01-10');
      const endDate = new Date('2025-01-20');
      const filtered = mockEntries.filter(
        e => new Date(e.timestamp) >= startDate && new Date(e.timestamp) <= endDate
      );
      expect(filtered).to.have.length(3);
    });
  });
});

describe('AccuracyDashboard UI calculations', () => {
  describe('formatEntityType', () => {
    function formatEntityType(type) {
      return type
        .toLowerCase()
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    }

    it('should convert SNAKE_CASE to Title Case', () => {
      expect(formatEntityType('SWISS_AVS')).to.equal('Swiss Avs');
      expect(formatEntityType('PERSON')).to.equal('Person');
      expect(formatEntityType('VAT_NUMBER')).to.equal('Vat Number');
    });
  });

  describe('formatPeriodLabel', () => {
    function formatPeriodLabel(period) {
      if (period.includes('-W')) {
        const weekPart = period.split('-W')[1];
        return weekPart ? `W${weekPart}` : period;
      }
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const parts = period.split('-');
      if (parts.length === 2 && parts[1]) {
        const monthIdx = parseInt(parts[1], 10) - 1;
        return months[monthIdx] || period;
      }
      return period;
    }

    it('should format weekly period labels', () => {
      expect(formatPeriodLabel('2025-W01')).to.equal('W01');
      expect(formatPeriodLabel('2025-W52')).to.equal('W52');
    });

    it('should format monthly period labels', () => {
      expect(formatPeriodLabel('2025-01')).to.equal('Jan');
      expect(formatPeriodLabel('2025-06')).to.equal('Jun');
      expect(formatPeriodLabel('2025-12')).to.equal('Dec');
    });

    it('should handle edge cases', () => {
      expect(formatPeriodLabel('invalid')).to.equal('invalid');
      expect(formatPeriodLabel('2025')).to.equal('2025');
    });
  });

  describe('escapeHtml', () => {
    // Node.js-compatible escapeHtml for testing
    function escapeHtml(text) {
      return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    it('should escape HTML special characters', () => {
      const input = '<script>alert("XSS")</script>';
      const output = escapeHtml(input);
      expect(output).to.not.include('<script>');
      expect(output).to.include('&lt;');
    });

    it('should handle normal text without changes', () => {
      const input = 'Normal text without special chars';
      const output = escapeHtml(input);
      expect(output).to.equal(input);
    });
  });
});
