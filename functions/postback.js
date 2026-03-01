export async function onRequest(context) {
    const url = new URL(context.request.url);
    const username = url.searchParams.get('username');
    const key = url.searchParams.get('key'); 
    const MY_SECRET = "supersecret123"; 

    if (key !== MY_SECRET) return new Response("Error: Invalid Password.", { status: 401 });
    if (!username) return new Response("Error: Missing username", { status: 400 });

    try {
        await context.env.BRAINROT_DB.put(username, "true", { expirationTtl: 7200 });
        return new Response("Postback Success", { status: 200 });
    } catch (err) {
        return new Response("DB Error: " + err.message, { status: 500 });
    }
}
