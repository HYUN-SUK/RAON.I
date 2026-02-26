require('dotenv').config({ path: '.env.local' });
const envKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hardcodedKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocWlxd3RveXZlc3hhaHNqdWtrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTgzOTYwNSwiZXhwIjoyMDgxNDE1NjA1fQ.EKpyz8NvGZLbmTPn4m_-PZNeDD4GgcpzlqPDdY1inHI';

console.log("Env Key:      ", envKey?.substring(0, 50) + "...");
console.log("Hardcoded Key:", hardcodedKey.substring(0, 50) + "...");
console.log("Match?", envKey === hardcodedKey);
