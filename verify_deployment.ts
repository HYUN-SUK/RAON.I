
const url = "https://khqiqwtoyvesxahsjukk.supabase.co/functions/v1/camping-reminder";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocWlxd3RveXZlc3hhaHNqdWtrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4Mzk2MDUsImV4cCI6MjA4MTQxNTYwNX0.n9IkcemnveChPAP1L_Dd2rWrp7gz7Bzr3xXnSwfTECg";

async function verify() {
    console.log("Invoking:", url);
    try {
        const res = await fetch(url, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${key}`,
                "Content-Type": "application/json"
            }
        });
        console.log("Status:", res.status);
        const data = await res.json();
        console.log("Response:", JSON.stringify(data, null, 2));

        const fs = require('fs');
        fs.writeFileSync('deployment_debug.json', JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
        console.error("Error invoking function:", e);
    }
}

verify();
