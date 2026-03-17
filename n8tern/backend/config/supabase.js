import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_FILE = path.join(__dirname, '..', 'db.json');

// Initialize memDB from file or create empty if missing
let memDB = { students: [], listings: [], applications: [] };

if (fs.existsSync(DB_FILE)) {
  try {
    memDB = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
  } catch (err) {
    console.error('Error reading db.json, starting fresh.', err);
  }
}

function persist() {
  fs.writeFileSync(DB_FILE, JSON.stringify(memDB, null, 2), 'utf-8');
}

export function createMockClient() {
  return {
    from(table) {
      if (!memDB[table]) memDB[table] = [];
      
      let queryResult = [...memDB[table]];
      let isSingle = false;

      const chain = {
        select(fields) {
          if (fields && typeof fields === 'string') {
            if (fields.includes('listings (')) {
              queryResult = queryResult.map(r => ({ ...r, listings: memDB.listings.find(l => l.id === r.listing_id) || null }));
            }
            if (fields.includes('students (')) {
              queryResult = queryResult.map(r => ({ ...r, students: memDB.students.find(s => s.id === r.student_id) || null }));
            }
          }
          return this; 
        },
        order(col, opts) {
          const asc = opts?.ascending !== false;
          queryResult.sort((a,b) => {
            if (a[col] < b[col]) return asc ? -1 : 1;
            if (a[col] > b[col]) return asc ? 1 : -1;
            return 0;
          });
          return this;
        },
        eq(col, val) {
          queryResult = queryResult.filter(r => r[col] === val);
          return this;
        },
        overlaps(col, vals) {
          queryResult = queryResult.filter(r => r[col] && vals.some(v => r[col].includes(v)));
          return this;
        },
        single() {
          isSingle = true;
          return this;
        },
        insert(obj) {
          const payload = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...obj };
          memDB[table].push(payload);
          queryResult = [payload];
          persist();
          return this;
        },
        upsert(obj, opts) {
          const conflictCol = opts?.onConflict || 'id';
          const cols = conflictCol.split(',').map(s=>s.trim());
          const existingIdx = memDB[table].findIndex(r => cols.every(c => r[c] === obj[c]));
          
          let payload;
          if (existingIdx >= 0) {
             payload = { ...memDB[table][existingIdx], ...obj };
             memDB[table][existingIdx] = payload;
          } else {
             payload = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...obj };
             memDB[table].push(payload);
          }
          queryResult = [payload];
          persist();
          return this;
        },
        delete() {
           const toDelete = new Set(queryResult.map(r=>r.id));
           memDB[table] = memDB[table].filter(r => !toDelete.has(r.id));
           persist();
           return this;
        },
        then(resolve) {
          if (isSingle) {
            if (queryResult.length === 0) resolve({ data: null, error: new Error('Not found') });
            else resolve({ data: queryResult[0], error: null });
          } else {
            resolve({ data: queryResult, error: null });
          }
        }
      };
      
      return chain;
    }
  };
}

export const supabase = createMockClient();
export const supabaseAdmin = createMockClient();
