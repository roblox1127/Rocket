export async function onRequest(context) {
    const API_KEY = "37019|udH6Fb4IC7cV942W6q6nIZl2qIsWR8Ep4YXVIygV68139ae4";
    const TRACKING_ID = "rocket";
    
    const BLOCKED_APPS = []; // e.g., ["Shein", "Temu"]

    const request = context.request;
    const url = new URL(request.url);
    
    // 1. Define CORS Headers AT THE TOP so both Try and Catch blocks can use them
    const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,HEAD,POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Content-Type": "application/json"
    };

    // 2. Handle browser preflight checks automatically
    if (request.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }
    
    // 3. GET USERNAME
    const username = url.searchParams.get('username') || "Guest";

    let userCountry = request.cf?.country || 'US'; 
    const userIP = request.headers.get('CF-Connecting-IP') || '1.1.1.1';
    const userAgent = request.headers.get('User-Agent') || 'Mozilla/5.0';

    // 4. Determine OS
    let userOS = "Desktop"; 
    if (/android/i.test(userAgent)) userOS = "Android";
    else if (/iPad|iPhone|iPod/i.test(userAgent)) userOS = "iOS";

    // 5. Handle Country Codes
    let allowedCodes = [userCountry];
    if (userCountry === 'GB') allowedCodes.push('UK');

    const params = new URLSearchParams({ 
        ip: userIP, 
        country_code: userCountry, 
        user_agent: userAgent, 
        limit: '100', // Excellent idea to bump this up
        aff_sub5: TRACKING_ID 
    });

    try {
        const response = await fetch(`https://lockedpage1.website/api/v2/?${params.toString()}`, {
            headers: { "Authorization": `Bearer ${API_KEY}` }
        });

        // Safe JSON parsing
        const textData = await response.text();
        let data;
        try { data = JSON.parse(textData); } 
        catch(e) { throw new Error("Invalid API Response"); }

        if (data.success && data.offers && data.offers.length > 0) {
            
            // --- FILTERING ---
            let offers = data.offers.filter(offer => {
                const title = (offer.name_short || "").toLowerCase();
                
                // Block List
                if (BLOCKED_APPS.some(badWord => title.includes(badWord.toLowerCase()))) return false;

                // Device Check
                if (offer.devices) {
                    const allowedDevices = offer.devices.map(d => d.toLowerCase());
                    if (userOS === "Android" && !allowedDevices.includes("android")) return false;
                    if (userOS === "iOS" && !allowedDevices.includes("iphone") && !allowedDevices.includes("ipad")) return false;
                }

                // Country Check (Your new logic here is perfect)
                if (!offer.countries || offer.countries.includes("ALL")) return true;
                return offer.countries.some(c => allowedCodes.includes(c));
            });

            // --- PROCESSING & TRACKING ---
            offers = offers.map(offer => {
                let link = offer.link || offer.tracking_url;
                if (link) {
                    const separator = link.includes('?') ? '&' : '?';
                    // Inject Username into sub4 (Crucial for postbacks)
                    link = `${link}${separator}aff_sub4=${encodeURIComponent(username)}&aff_sub5=${TRACKING_ID}`;
                    offer.link = link;
                    offer.tracking_url = link;
                }
                return offer;
            });

            // --- PRIORITY SORTING ---
            const getPriorityScore = (offer) => {
                const type = (offer.payout_type || "").toUpperCase();
                const title = (offer.name_short || "").toUpperCase();
                const desc = (offer.adcopy || "").toUpperCase();

                if (type === "CPI" || title.includes("INSTALL") || desc.includes("INSTALL") || title.includes("DOWNLOAD")) return 30;
                if (type === "CPE" || title.includes("LEVEL") || desc.includes("LEVEL") || desc.includes("REACH")) return 10;
                return 20; 
            };

            offers.sort((a, b) => {
                const scoreA = getPriorityScore(a);
                const scoreB = getPriorityScore(b);
                if (scoreA !== scoreB) return scoreB - scoreA; 
                if (a.epc && b.epc) return parseFloat(b.epc) - parseFloat(a.epc);
                return parseFloat(b.payout) - parseFloat(a.payout);
            });

            return new Response(JSON.stringify(offers.slice(0, 8)), { headers: corsHeaders });
        } else {
            return new Response(JSON.stringify({ error: "No valid offers found" }), { status: 400, headers: corsHeaders });
        }
    } catch (error) {
        // Because corsHeaders is now at the top, this block won't crash!
        return new Response(JSON.stringify({ error: "Server Error connecting to node" }), { status: 500, headers: corsHeaders });
    }
}
