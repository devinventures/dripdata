import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabase } from "@/lib/supabase";
import type Stripe from "stripe";

// Stripe requires the raw body — disable body parsing
export const runtime = "nodejs";

async function updateSubscription(subscription: Stripe.Subscription) {
  const userId =
    subscription.metadata?.supabase_user_id ??
    (subscription as unknown as { customer: Stripe.Customer }).customer?.metadata
      ?.supabase_user_id;

  if (!userId) {
    // Fallback: look up by stripe_customer_id
    const customerId =
      typeof subscription.customer === "string"
        ? subscription.customer
        : subscription.customer?.id;

    if (customerId) {
      await supabase
        .from("profiles")
        .update({
          subscription_status: subscription.status,
          stripe_subscription_id: subscription.id,
        })
        .eq("stripe_customer_id", customerId);
    }
    return;
  }

  await supabase
    .from("profiles")
    .upsert({
      id: userId,
      subscription_status: subscription.status,
      stripe_subscription_id: subscription.id,
    });
}

export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const body = await req.text();
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    console.error("[stripe webhook] signature verification failed", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === "subscription" && session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(
            session.subscription as string
          );
          // Attach user ID to subscription metadata if not already set
          const userId =
            subscription.metadata?.supabase_user_id ??
            session.metadata?.supabase_user_id ??
            session.client_reference_id;

          if (userId && !subscription.metadata?.supabase_user_id) {
            await stripe.subscriptions.update(subscription.id, {
              metadata: { supabase_user_id: userId },
            });
          }
          await updateSubscription(subscription);
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
        await updateSubscription(event.data.object as Stripe.Subscription);
        break;

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId =
          typeof subscription.customer === "string"
            ? subscription.customer
            : subscription.customer?.id;

        if (customerId) {
          await supabase
            .from("profiles")
            .update({ subscription_status: "canceled", stripe_subscription_id: null })
            .eq("stripe_customer_id", customerId);
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId =
          typeof invoice.customer === "string"
            ? invoice.customer
            : (invoice.customer as Stripe.Customer)?.id;

        if (customerId) {
          await supabase
            .from("profiles")
            .update({ subscription_status: "past_due" })
            .eq("stripe_customer_id", customerId);
        }
        break;
      }
    }
  } catch (err) {
    console.error("[stripe webhook] handler error", event.type, err);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
