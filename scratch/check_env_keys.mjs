import fs from 'fs';
import dotenv from 'dotenv';
const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
console.log('Available keys in .env.local:', Object.keys(envConfig));
