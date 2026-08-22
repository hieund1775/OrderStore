import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeAndValidatePhone,
  normalizeAndValidateFullName,
  validateCustomerRegisterInput,
  CustomerValidationError,
} from '../validation/customer-schemas.js';
import { validateCreateOrderInput } from '../validation/order-schemas.js';

describe('Customer & Order Validation Hardening Suite', () => {
  describe('Vietnamese and International (E.164) Phone Validation', () => {
    it('accepts valid 10-digit Vietnamese phone numbers across all mobile networks', () => {
      const validNumbers = [
        '0901234567', // Mobifone
        '0987654321', // Viettel
        '0888888888', // Vinaphone
        '0321234567', // Viettel 03
        '0561234567', // Vietnamobile 05
        '0701234567', // Mobifone 07
      ];

      for (const phone of validNumbers) {
        assert.equal(normalizeAndValidatePhone(phone), phone);
      }
    });

    it('normalizes Vietnamese numbers with +84 and 84 prefixes to 10-digit 0... format', () => {
      assert.equal(normalizeAndValidatePhone('+84901234567'), '0901234567');
      assert.equal(normalizeAndValidatePhone('84987654321'), '0987654321');
      assert.equal(normalizeAndValidatePhone('+84 901 234 567'), '0901234567');
      assert.equal(normalizeAndValidatePhone('090-123-4567'), '0901234567');
    });

    it('accepts valid international phone numbers with + prefix and country codes', () => {
      const validIntl = [
        '+12025550143',    // US
        '+821012345678',  // Korea
        '+8613800138000',  // China
        '+819012345678',   // Japan
        '+6591234567',     // Singapore
        '+447911123456',   // UK
        '+886912345678',   // Taiwan
      ];

      for (const phone of validIntl) {
        assert.equal(normalizeAndValidatePhone(phone), phone);
      }
    });

    it('rejects invalid domestic phone numbers (wrong length, wrong prefix, landlines)', () => {
      const invalidPhones = [
        '090123456',      // 9 digits
        '09012345678',    // 11 digits
        '0243123456',     // Hanoi landline 024
        '0123456789',     // Obsolete / invalid mobile prefix
        '0000000000',     // All zeros
        '09012abcde',     // Characters
        '1234567890',     // Missing 0 or +
      ];

      for (const phone of invalidPhones) {
        assert.throws(
          () => normalizeAndValidatePhone(phone),
          CustomerValidationError,
          `Expected phone "${phone}" to be rejected`
        );
      }
    });

    it('rejects invalid international phone numbers (missing +, too short, too long)', () => {
      const invalidIntl = [
        '12025550143',    // Missing +
        '+1234',          // Too short (< 8 digits)
        '+12345678901234567', // Too long (> 15 digits)
        '+0123456789',    // Country code cannot start with 0
      ];

      for (const phone of invalidIntl) {
        assert.throws(
          () => normalizeAndValidatePhone(phone),
          CustomerValidationError,
          `Expected international phone "${phone}" to be rejected`
        );
      }
    });
  });

  describe('Vietnamese Full Name Validation', () => {
    it('accepts properly formatted Vietnamese full names (2+ words, capitalized, with accents)', () => {
      const validNames = [
        'Nguyễn Du',
        'Trần Thị Mỹ Duyên',
        'Đặng Văn Lâm',
        'Lê Hoàng Long',
        'Phan Thị Bích Ngọc',
        'John Smith',
      ];

      for (const name of validNames) {
        assert.equal(normalizeAndValidateFullName(name), name);
      }
    });

    it('normalizes multiple spaces between words in full name', () => {
      assert.equal(normalizeAndValidateFullName('  Nguyễn   Văn   An  '), 'Nguyễn Văn An');
    });

    it('rejects improperly formatted names (single word, lowercase, numbers, special characters)', () => {
      const invalidNames = [
        'nguyen van an',   // lowercase
        'Nguyễn',          // single word
        'Nguyễn Văn A123', // contains numbers
        'Lê @ Hoàng',      // special character
        'Trần-Thị-Mai',    // hyphens instead of spaces
        '',                // empty
        'A',               // single letter
      ];

      for (const name of invalidNames) {
        assert.throws(
          () => normalizeAndValidateFullName(name),
          CustomerValidationError,
          `Expected name "${name}" to be rejected`
        );
      }
    });
  });

  describe('validateCustomerRegisterInput', () => {
    it('accepts valid registration input payload', () => {
      const input = {
        phone: '0901234567',
        fullname: 'Nguyễn Văn An',
        password: 'Password123!',
      };

      const result = validateCustomerRegisterInput(input);
      assert.equal(result.phone, '0901234567');
      assert.equal(result.fullname, 'Nguyễn Văn An');
      assert.equal(result.password, 'Password123!');
    });

    it('rejects registration with invalid phone or name or short password', () => {
      assert.throws(
        () => validateCustomerRegisterInput({ phone: '123', fullname: 'Nguyễn Văn An', password: 'Password123!' }),
        CustomerValidationError
      );
      assert.throws(
        () => validateCustomerRegisterInput({ phone: '0901234567', fullname: 'nguyen', password: 'Password123!' }),
        CustomerValidationError
      );
      assert.throws(
        () => validateCustomerRegisterInput({ phone: '0901234567', fullname: 'Nguyễn Văn An', password: 'short' }),
        CustomerValidationError
      );
    });
  });

  describe('validateCreateOrderInput Customer Name and Phone Integration', () => {
    it('validates and accepts proper customer name and phone in order payload', () => {
      const validPayload = {
        store_id: 1,
        customer_name: 'Trần Văn Bình',
        customer_phone: '0987654321',
        order_type: 'Take-away',
        payment_method: 'VietQR',
        items: [{ product_id: 1, qty: 1 }],
      };

      const result = validateCreateOrderInput(validPayload);
      assert.equal(result.storeId, 1);
    });

    it('rejects order creation with uncapitalized name or invalid phone', () => {
      const invalidNamePayload = {
        store_id: 1,
        customer_name: 'tran van binh',
        customer_phone: '0987654321',
        items: [{ product_id: 1, qty: 1 }],
      };
      assert.throws(() => validateCreateOrderInput(invalidNamePayload));

      const invalidPhonePayload = {
        store_id: 1,
        customer_name: 'Trần Văn Bình',
        customer_phone: '0000000000',
        items: [{ product_id: 1, qty: 1 }],
      };
      assert.throws(() => validateCreateOrderInput(invalidPhonePayload));
    });
  });
});
