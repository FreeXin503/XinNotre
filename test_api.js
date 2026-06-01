async function run() {
    const key = process.env.GEMINI_KEY || "YOUR_GEMINI_KEY";
    
    console.log("--- TEST 1: Gemini OpenAI endpoint with Bearer auth ---");
    try {
        const res = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${key}`
            },
            body: JSON.stringify({
                model: "gemini-2.5-flash",
                messages: [{role: "user", content: "Hi"}]
            })
        });
        console.log("Test 1 status:", res.status);
        const data = await res.json();
        console.log("Test 1 response:", JSON.stringify(data).substring(0, 300));
    } catch(e) {
        console.error("Test 1 failed:", e);
    }

    console.log("\n--- TEST 2: Gemini OpenAI endpoint with ?key= query parameter ---");
    try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/openai/chat/completions?key=${key}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "gemini-2.5-flash",
                messages: [{role: "user", content: "Hi"}]
            })
        });
        console.log("Test 2 status:", res.status);
        const data = await res.json();
        console.log("Test 2 response:", JSON.stringify(data).substring(0, 300));
    } catch(e) {
        console.error("Test 2 failed:", e);
    }
}
run();
