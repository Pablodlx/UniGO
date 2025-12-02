"use client";

import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { ReactNode } from "react";

let stripePromise: ReturnType<typeof loadStripe> | null = null;

function getStripe() {
  if (!stripePromise) {
    const stripeKey = process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY;
    if (stripeKey) {
      stripePromise = loadStripe(stripeKey);
    }
  }
  return stripePromise;
}

interface StripeProviderWrapperProps {
  children: ReactNode;
}

export default function StripeProviderWrapper({ children }: StripeProviderWrapperProps) {
  const stripePromise = getStripe();

  // If Stripe is not configured, just render children without provider
  if (!stripePromise) {
    return <>{children}</>;
  }

  return (
    <Elements stripe={stripePromise}>
      {children}
    </Elements>
  );
}

