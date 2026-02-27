import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const STRIPE_SECRET = Deno.env.get("STRIPE_SECRET_KEY")!;
const PLATFORM_FEE_PCT = 0.05; // 5%

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { amount, currency = "usd", booking_id, operator_stripe_account, description } = await req.json();

    if (!amount || amount < 100) {
      throw new Error("Invalid amount — minimum $1.00");
    }

    const amountCents = Math.round(amount * 100);
    const platformFeeCents = Math.round(amountCents * PLATFORM_FEE_PCT);

    // Build Stripe PaymentIntent params
    const params: Record<string, string> = {
      amount: amountCents.toString(),
      currency,
      description: description || `Aviate Atelier Charter — Booking ${booking_id}`,
      "metadata[booking_id]": booking_id || "",
      "metadata[platform]": "aviate_atelier",
      "payment_method_types[]": "card",
    };

    // If operator has a Stripe Connect account, split the payment
    if (operator_stripe_account) {
      params["application_fee_amount"] = platformFeeCents.toString();
      params["transfer_data[destination]"] = operator_stripe_account;
    }

    const body = new URLSearchParams(params);

    const stripeRes = await fetch("https://api.stripe.com/v1/payment_intents", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    const intent = await stripeRes.json();

    if (intent.error) {
      throw new Error(intent.error.message);
    }

    return new Response(
      JSON.stringify({
        client_secret: intent.client_secret,
        payment_intent_id: intent.id,
        amount_cents: amountCents,
        platform_fee_cents: platformFeeCents,
        operator_receives_cents: amountCents - platformFeeCents,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
