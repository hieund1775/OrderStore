import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { toStoreDto, DEFAULT_STORE_AMENITIES } from '../dto/store-dto.js';

describe('toStoreDto Amenities Synchronization', () => {
  it('returns null for null store input', () => {
    assert.equal(toStoreDto(null), null);
    assert.equal(toStoreDto(undefined), null);
  });

  it('supplies DEFAULT_STORE_AMENITIES when amenities is null or undefined', () => {
    const dto1 = toStoreDto({ id: 1, name: 'TeaPlus Q1', amenities: null });
    assert.deepEqual(dto1.amenities, DEFAULT_STORE_AMENITIES);

    const dto2 = toStoreDto({ id: 2, name: 'TeaPlus Bình Thạnh' });
    assert.deepEqual(dto2.amenities, DEFAULT_STORE_AMENITIES);
  });

  it('supplies DEFAULT_STORE_AMENITIES when amenities is empty array or empty string', () => {
    const dto1 = toStoreDto({ id: 1, name: 'TeaPlus Q1', amenities: [] });
    assert.deepEqual(dto1.amenities, DEFAULT_STORE_AMENITIES);

    const dto2 = toStoreDto({ id: 2, name: 'TeaPlus D2', amenities: '' });
    assert.deepEqual(dto2.amenities, DEFAULT_STORE_AMENITIES);

    const dto3 = toStoreDto({ id: 3, name: 'Suối Tiên', amenities: '[]' });
    assert.deepEqual(dto3.amenities, DEFAULT_STORE_AMENITIES);

    const dto4 = toStoreDto({ id: 4, name: 'Suối Tiên', amenities: ['  '] });
    assert.deepEqual(dto4.amenities, DEFAULT_STORE_AMENITIES);
  });

  it('preserves configured custom amenities when provided as array', () => {
    const custom = ['Chỗ đỗ ô tô', 'Máy lạnh', 'View Landmark 81'];
    const dto = toStoreDto({ id: 1, name: 'TeaPlus Landmark', amenities: custom });
    assert.deepEqual(dto.amenities, custom);
  });

  it('correctly parses JSON string amenities array', () => {
    const dto = toStoreDto({
      id: 1,
      name: 'TeaPlus',
      amenities: JSON.stringify(['Đỗ ô tô', 'Máy lạnh']),
    });
    assert.deepEqual(dto.amenities, ['Đỗ ô tô', 'Máy lạnh']);
  });
});
