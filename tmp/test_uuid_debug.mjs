import { v5 as uuidv5 } from 'uuid';
const MY_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

function generateId(source, name, address) {
    try {
        const input = `${source}|${String(name).trim()}|${String(address).trim()}`;
        return uuidv5(input, MY_NAMESPACE);
    } catch (e) {
        console.error('FAILED TO GENERATE:', e.message);
        return null;
    }
}

const name = '(주)이마트 신월점';
const addr = '서울특별시 양천구 화곡로 59 (신월동)';
const id = generateId('LOCALDATA_MART_SSM', name, addr);

console.log('--- UUID TEST ---');
console.log('Name:', name);
console.log('Addr:', addr);
console.log('Generated ID:', id);
if (!id) console.log('ERROR: ID is NULL');
