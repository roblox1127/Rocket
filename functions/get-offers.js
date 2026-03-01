export async function onRequest(context) {
    const API_KEY = "37019|udH6Fb4IC7cV942W6q6nIZl2qIsWR8Ep4YXVIygV68139ae4";
    const TRACKING_ID = "Rocket";
    const request = context.request;

    // 1. Always attach CORS headers
    const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,HEAD,POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Content-Type": "application/json"
    };

    if (request.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    let userCountry = request.cf?.country || 'US'; 
    const userIP = request.headers.get('CF-Connecting-IP') || '1.1.1.1';
    const userAgent = request.headers.get('User-Agent') || 'Mozilla/5.0';

    let userOS = "Unknown";
    if (/android/i.test(userAgent)) userOS = "Android";
    else if (/iPad|iPhone|iPod/i.test(userAgent)) userOS = "iOS";

    let allowedCodes = [userCountry];
    if (userCountry === 'GB') allowedCodes.push('UK');

    const params = new URLSearchParams({ 
        ip: userIP, 
        country_code: userCountry, 
        user_agent: userAgent, 
        limit: '40', 
        aff_sub5: TRACKING_ID 
    });

    try {
        const response = await fetch(`https://confirmapp.online/api/v2/?${params.toString()}`, {
            headers: { "Authorization": `Bearer ${API_KEY}` }
        });
        
        const data = await response.json();

        if (data.success && data.offers && data.offers.length > 0) {
            let offers = data.offers.filter(offer => {
                // Fix: Make devices lowercase to ensure it matches regardless of API formatting
                const offerDevices = (offer.devices ||[]).map(d => d.toLowerCase());
                
                if (userOS === "Android" && !offerDevices.includes("android")) return false;
                if (userOS === "iOS" && !offerDevices.includes("iphone") && !offerDevices.includes("ipad")) return false;
                
                // Fix: Corrected the US filtering bug
                if (offer.countries && offer.countries.includes("US") && !allowedCodes.includes("US")) return false;
                if (!offer.countries || offer.countries.includes("ALL")) return true;
                
                return offer.countries.some(c => allowedCodes.includes(c));
            });

            offers = offers.map(offer => {
                let link = offer.link || offer.tracking_url;
                if (link) {
                    const separator = link.includes('?') ? '&' : '?';
                    link = `${link}${separator}aff_sub5=${TRACKING_ID}`;
                    offer.link = link;
                    offer.tracking_url = link;
                }
                return offer;
            });

            // Sort by EPC first, then payout
            offers.sort((a, b) => {
                if (a.epc && b.epc) return parseFloat(b.epc) - parseFloat(a.epc);
                return parseFloat(b.payout) - parseFloat(a.payout);
            });

            // Return array directly so frontend can loop through it easily
            return new Response(JSON.stringify(offers.slice(0, 8)), { headers: corsHeaders });
        } else {
            return new Response(JSON.stringify({ error: "No valid offers found for your region." }), { status: 400, headers: corsHeaders });
        }
    } catch (error) {
        return new Response(JSON.stringify({ error: "Server Error connecting to node" }), { status: 500, headers: corsHeaders });
    }
}
