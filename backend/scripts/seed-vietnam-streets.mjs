import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import postgresDb from '../config/db-postgres.js';
import addressRepository from '../repositories/postgres/address.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const MAJOR_PROVINCES = [
  'Hồ Chí Minh',
  'Hà Nội',
  'Đà Nẵng',
  'Bình Dương',
  'Đồng Nai',
  'Cần Thơ',
  'Hải Phòng',
  'Bà Rịa - Vũng Tàu',
  'Khánh Hòa',
  'Lâm Đồng',
  'Quảng Nam',
  'Thừa Thiên Huế',
];

export async function seedStreets({ all = false, offlineJsonPath = null } = {}) {
  console.log('🌱 [Vietnam Streets Seeder] Starting...');

  const localSeedsPath = offlineJsonPath || path.join(__dirname, '../database/postgres/seeds/vietnam-streets.json');
  if (fs.existsSync(localSeedsPath)) {
    console.log(`📁 Found local dataset at ${localSeedsPath}`);
    const data = JSON.parse(fs.readFileSync(localSeedsPath, 'utf8'));
    console.log(`📦 Loaded ${data.length} street records from local file.`);
    const formatted = data.map((item) => ({
      province_name: item.p,
      district_name: item.d,
      street_name: item.s,
    }));
    const inserted = await addressRepository.insertStreetsBatch(formatted);
    console.log(`✅ Successfully seeded ${inserted} streets into database.`);
    return inserted;
  }

  console.log('🌐 Local dataset not found, fetching index from CDN...');
  const indexRes = await fetch('https://cdn.jsdelivr.net/gh/thien0291/vietnam_dataset@1.0.0/Index.json');
  const index = await indexRes.json();
  const entries = Object.entries(index).filter(([provName]) => {
    return all ? true : MAJOR_PROVINCES.includes(provName);
  });

  console.log(`📥 Downloading ${entries.length} provinces...`);
  let totalInserted = 0;
  for (const [provName, info] of entries) {
    try {
      const url = `https://cdn.jsdelivr.net/gh/thien0291/vietnam_dataset@1.0.0/${info.file_path.replace('./', '')}`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();
      const streets = [];
      for (const d of (data.district || [])) {
        for (const s of (d.street || [])) {
          if (s && typeof s === 'string' && s.trim()) {
            streets.push({
              province_name: provName.trim(),
              district_name: d.name.trim(),
              street_name: s.trim(),
            });
          }
        }
      }
      if (streets.length > 0) {
        const inserted = await addressRepository.insertStreetsBatch(streets);
        console.log(`  - ${provName}: ${streets.length} streets (inserted: ${inserted})`);
        totalInserted += inserted;
      }
    } catch (err) {
      console.error(`  - Failed to seed ${provName}: ${err.message}`);
    }
  }

  console.log(`✅ Done seeding ${totalInserted} streets.`);
  return totalInserted;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const isAll = process.argv.includes('--all');
  seedStreets({ all: isAll })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Fatal seeding error:', err);
      process.exit(1);
    });
}
