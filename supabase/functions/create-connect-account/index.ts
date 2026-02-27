import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
const STRIPE_SECRET = Deno.env.get("STRIPE_SECRET_KEY")!;
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { email, company_name, operator_id } = await req.json();
    const accountBody = new URLSearchParams({ type: "express", "capabilities[transfers][requested]": "true", "capabilities[card_payments][requested]": "true", email, "business_profile[name]": company_name || "Charter Operator", "business_profile[url]": "https://aviateatelier.vercel.app", "metadata[operator_id]": operator_id || "" });
    const accountRes = await fetch("https://api.stripe.com/v1/accounts", { method: "POST", headers: { Authorization: `Bearer ${STRIPE_SECRET}`, "Content-Type": "application/x-www-form-urlencoded" }, body: accountBody.toString() });
    const account = await accountRes.json();
    if (account.error) throw new Error(account.error.message);
    const linkBody = new URLSearchParams({ account: account.id, refresh_url: "https://aviateatelier.vercel.app/aviate-atelier-operator.html", return_url: "https://aviateatelier.vercel.app/aviate-atelier-operator.html?stripe=connected", type: "account_onboarding" });
    const linkRes = await fetch("https://api.stripe.com/v1/account_links", { method: "POST", headers: { Authorization: `Bearer ${STRIPE_SECRET}`, "Content-Type": "application/x-www-form-urlencoded" }, body: linkBody.toString() });
    const link = await linkRes.json();
    if (link.error) throw new Error(link.error.message);
    return new Response(JSON.stringify({ stripe_account_id: account.id, onboarding_url: link.url }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) { return new Response(JSON.stringify({ error: err.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
});
