
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
        const text = await res.text();
        console.log("Body:", text);
    } catch (e) {
        console.error("Error invoking function:", e);
    }
}

verify();
