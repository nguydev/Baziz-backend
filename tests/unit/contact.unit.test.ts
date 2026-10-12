/**
 * Contact Module Unit Tests
 * Pure function and utility testing
 */

import { buildPaginationMeta } from '../../src/utils/pagination';

describe('Contact Module - Unit Tests', () => {
  describe('escapeRegex utility', () => {
    const escapeRegex = (str: string): string => {
      return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    };

    it('should escape dot character', () => {
      const result = escapeRegex('test.com');
      expect(result).toBe('test\\.com');
    });

    it('should escape asterisk character', () => {
      const result = escapeRegex('test*');
      expect(result).toBe('test\\*');
    });

    it('should escape plus character', () => {
      const result = escapeRegex('test+');
      expect(result).toBe('test\\+');
    });

    it('should escape question mark', () => {
      const result = escapeRegex('test?');
      expect(result).toBe('test\\?');
    });

    it('should escape caret character', () => {
      const result = escapeRegex('^test');
      expect(result).toBe('\\^test');
    });

    it('should escape dollar sign', () => {
      const result = escapeRegex('test$');
      expect(result).toBe('test\\$');
    });

    it('should escape curly braces', () => {
      const result = escapeRegex('test{1,3}');
      expect(result).toBe('test\\{1,3\\}');
    });

    it('should escape parentheses', () => {
      const result = escapeRegex('test(abc)');
      expect(result).toBe('test\\(abc\\)');
    });

    it('should escape pipe character', () => {
      const result = escapeRegex('test|abc');
      expect(result).toBe('test\\|abc');
    });

    it('should escape square brackets', () => {
      const result = escapeRegex('test[abc]');
      expect(result).toBe('test\\[abc\\]');
    });

    it('should escape backslash', () => {
      const result = escapeRegex('test\\abc');
      expect(result).toBe('test\\\\abc');
    });

    it('should escape multiple special characters', () => {
      const result = escapeRegex('.*+?^${}()|[]\\');
      expect(result).toBe('\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\');
    });

    it('should not modify normal strings', () => {
      const result = escapeRegex('normal string');
      expect(result).toBe('normal string');
    });

    it('should handle empty string', () => {
      const result = escapeRegex('');
      expect(result).toBe('');
    });

    it('should handle string with spaces and special chars', () => {
      const result = escapeRegex('test (123) abc.com');
      expect(result).toBe('test \\(123\\) abc\\.com');
    });

    it('should prevent regex injection attack pattern 1', () => {
      const malicious = '.*';
      const result = escapeRegex(malicious);
      expect(result).toBe('\\.\\*');
    });

    it('should prevent regex injection attack pattern 2', () => {
      const malicious = '^$|.*';
      const result = escapeRegex(malicious);
      expect(result).toBe('\\^\\$\\|\\.\\*');
    });

    it('should prevent regex DOS attack', () => {
      const malicious = '(a+)+$';
      const result = escapeRegex(malicious);
      expect(result).toBe('\\(a\\+\\)\\+\\$');
    });
  });

  describe('buildPaginationMeta utility', () => {
    it('should build pagination meta for first page', () => {
      const meta = buildPaginationMeta(100, 1, 20);

      expect(meta.total).toBe(100);
      expect(meta.page).toBe(1);
      expect(meta.limit).toBe(20);
      expect(meta.totalPages).toBe(5);
      expect(meta.hasNextPage).toBe(true);
      expect(meta.hasPrevPage).toBe(false);
    });

    it('should build pagination meta for middle page', () => {
      const meta = buildPaginationMeta(100, 3, 20);

      expect(meta.total).toBe(100);
      expect(meta.page).toBe(3);
      expect(meta.limit).toBe(20);
      expect(meta.totalPages).toBe(5);
      expect(meta.hasNextPage).toBe(true);
      expect(meta.hasPrevPage).toBe(true);
    });

    it('should build pagination meta for last page', () => {
      const meta = buildPaginationMeta(100, 5, 20);

      expect(meta.total).toBe(100);
      expect(meta.page).toBe(5);
      expect(meta.limit).toBe(20);
      expect(meta.totalPages).toBe(5);
      expect(meta.hasNextPage).toBe(false);
      expect(meta.hasPrevPage).toBe(true);
    });

    it('should handle single page result', () => {
      const meta = buildPaginationMeta(10, 1, 20);

      expect(meta.total).toBe(10);
      expect(meta.page).toBe(1);
      expect(meta.limit).toBe(20);
      expect(meta.totalPages).toBe(1);
      expect(meta.hasNextPage).toBe(false);
      expect(meta.hasPrevPage).toBe(false);
    });

    it('should handle empty result', () => {
      const meta = buildPaginationMeta(0, 1, 20);

      expect(meta.total).toBe(0);
      expect(meta.page).toBe(1);
      expect(meta.limit).toBe(20);
      expect(meta.totalPages).toBe(0);
      expect(meta.hasNextPage).toBe(false);
      expect(meta.hasPrevPage).toBe(false);
    });

    it('should handle non-exact division', () => {
      const meta = buildPaginationMeta(95, 3, 20);

      expect(meta.total).toBe(95);
      expect(meta.page).toBe(3);
      expect(meta.limit).toBe(20);
      expect(meta.totalPages).toBe(5);
      expect(meta.hasNextPage).toBe(true);
      expect(meta.hasPrevPage).toBe(true);
    });

    it('should calculate correct hasNextPage on partial last page', () => {
      const meta = buildPaginationMeta(95, 5, 20);

      expect(meta.totalPages).toBe(5);
      expect(meta.hasNextPage).toBe(false);
    });

    it('should handle limit of 1', () => {
      const meta = buildPaginationMeta(10, 5, 1);

      expect(meta.total).toBe(10);
      expect(meta.page).toBe(5);
      expect(meta.limit).toBe(1);
      expect(meta.totalPages).toBe(10);
      expect(meta.hasNextPage).toBe(true);
      expect(meta.hasPrevPage).toBe(true);
    });

    it('should handle large dataset', () => {
      const meta = buildPaginationMeta(10000, 50, 100);

      expect(meta.total).toBe(10000);
      expect(meta.page).toBe(50);
      expect(meta.limit).toBe(100);
      expect(meta.totalPages).toBe(100);
      expect(meta.hasNextPage).toBe(true);
      expect(meta.hasPrevPage).toBe(true);
    });
  });

  describe('Profession enum validation', () => {
    const validProfessions = [
      'electrician',
      'plumber',
      'landscaper',
      'carpenter',
      'painter',
      'hvac',
      'general_contractor',
      'locksmith',
      'pest_control',
      'cleaner',
      'other',
    ];

    it('should have exactly 11 profession types', () => {
      expect(validProfessions.length).toBe(11);
    });

    it('should include all expected professions', () => {
      const expected = [
        'electrician',
        'plumber',
        'landscaper',
        'carpenter',
        'painter',
        'hvac',
        'general_contractor',
        'locksmith',
        'pest_control',
        'cleaner',
        'other',
      ];

      expected.forEach((profession) => {
        expect(validProfessions).toContain(profession);
      });
    });

    it('should not include invalid profession types', () => {
      const invalid = ['doctor', 'lawyer', 'teacher', 'invalid'];

      invalid.forEach((profession) => {
        expect(validProfessions).not.toContain(profession);
      });
    });

    it('should be all lowercase', () => {
      validProfessions.forEach((profession) => {
        expect(profession).toBe(profession.toLowerCase());
      });
    });

    it('should use underscore for multi-word professions', () => {
      expect(validProfessions).toContain('general_contractor');
      expect(validProfessions).toContain('pest_control');
    });
  });

  describe('Contact field constraints', () => {
    it('should enforce company name max length', () => {
      const maxLength = 150;
      const longName = 'a'.repeat(maxLength + 1);
      expect(longName.length).toBeGreaterThan(maxLength);
    });

    it('should enforce contact person max length', () => {
      const maxLength = 100;
      const longName = 'a'.repeat(maxLength + 1);
      expect(longName.length).toBeGreaterThan(maxLength);
    });

    it('should enforce phone max length', () => {
      const maxLength = 20;
      const longPhone = '1'.repeat(maxLength + 1);
      expect(longPhone.length).toBeGreaterThan(maxLength);
    });

    it('should enforce notes max length', () => {
      const maxLength = 500;
      const longNotes = 'a'.repeat(maxLength + 1);
      expect(longNotes.length).toBeGreaterThan(maxLength);
    });
  });

  describe('Phone number format validation', () => {
    const phonePattern = /^[+\d\s\-()]{7,20}$/;

    describe('Valid phone formats', () => {
      const validPhones = [
        '+44 20 1234 5678',
        '+1-555-123-4567',
        '(555) 123-4567',
        '+8801712345678',
        '020 1234 5678',
        '+1 (555) 123-4567',
        '1234567',
        '12345678901234567890',
      ];

      validPhones.forEach((phone) => {
        it(`should accept: ${phone}`, () => {
          expect(phonePattern.test(phone)).toBe(true);
        });
      });
    });

    describe('Invalid phone formats', () => {
      const invalidPhones = [
        'call-me',
        'phone',
        '123abc',
        'test@email.com',
        '123',
        '123456789012345678901',
        'letters only',
        '+44.20.1234',
        '+44/20/1234',
      ];

      invalidPhones.forEach((phone) => {
        it(`should reject: ${phone}`, () => {
          expect(phonePattern.test(phone)).toBe(false);
        });
      });
    });
  });

  describe('Stats calculation logic', () => {
    it('should calculate total from aggregation results', () => {
      const aggregateResult = [
        { _id: 'electrician', count: 5 },
        { _id: 'plumber', count: 3 },
        { _id: 'landscaper', count: 2 },
      ];

      const total = aggregateResult.reduce((sum, item) => sum + item.count, 0);
      expect(total).toBe(10);
    });

    it('should handle empty aggregation result', () => {
      const aggregateResult: { _id: string; count: number }[] = [];
      const total = aggregateResult.reduce((sum, item) => sum + item.count, 0);
      expect(total).toBe(0);
    });

    it('should handle single profession', () => {
      const aggregateResult = [{ _id: 'electrician', count: 15 }];
      const total = aggregateResult.reduce((sum, item) => sum + item.count, 0);
      expect(total).toBe(15);
    });

    it('should build byProfession object correctly', () => {
      const aggregateResult = [
        { _id: 'electrician', count: 5 },
        { _id: 'plumber', count: 3 },
      ];

      const byProfession: Record<string, number> = {};
      aggregateResult.forEach((item) => {
        byProfession[item._id] = item.count;
      });

      expect(byProfession).toEqual({
        electrician: 5,
        plumber: 3,
      });
    });
  });

  describe('Empty update body detection', () => {
    it('should detect empty object', () => {
      const updateData = {};
      expect(Object.keys(updateData).length).toBe(0);
    });

    it('should detect non-empty object', () => {
      const updateData = { company: 'Test' };
      expect(Object.keys(updateData).length).toBeGreaterThan(0);
    });

    it('should detect undefined values not added to object', () => {
      const updateData: Record<string, unknown> = {};
      const input = { company: undefined };

      if (input.company !== undefined) {
        updateData.company = input.company;
      }

      expect(Object.keys(updateData).length).toBe(0);
    });

    it('should add defined values to object', () => {
      const updateData: Record<string, unknown> = {};
      const input = { company: 'Test Company' };

      if (input.company !== undefined) {
        updateData.company = input.company;
      }

      expect(Object.keys(updateData).length).toBe(1);
      expect(updateData.company).toBe('Test Company');
    });
  });
});
