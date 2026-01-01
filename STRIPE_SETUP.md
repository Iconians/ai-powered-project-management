# Stripe Setup Guide

This guide will walk you through setting up Stripe products and prices for your subscription plans.

## Step 1: Create Products and Prices in Stripe

You have two options:

### Option A: Stripe Dashboard (Recommended for first-time setup)

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/test/products) (use test mode for development)
2. Click "Add product"
3. Create products for each plan:

   **Pro Plan:**
   - Name: `Pro Plan`
   - Description: `Pro subscription plan`
   - Pricing: `$29.99/month` (recurring)
   - Copy the **Price ID** (starts with `price_`)

   **Enterprise Plan:**
   - Name: `Enterprise Plan`
   - Description: `Enterprise subscription plan`
   - Pricing: `$99.99/month` (recurring)
   - Copy the **Price ID** (starts with `price_`)

### Option B: Stripe CLI

```bash
# Install Stripe CLI if you haven't already
# brew install stripe/stripe-cli/stripe

# Login to Stripe
stripe login

# Create Pro product and price
stripe products create \
  --name="Pro Plan" \
  --description="Pro subscription plan"

# Note the product ID, then create a price
stripe prices create \
  --product=prod_xxxxx \
  --unit-amount=2999 \
  --currency=usd \
  --recurring[interval]=month

# Create Enterprise product and price
stripe products create \
  --name="Enterprise Plan" \
  --description="Enterprise subscription plan"

# Note the product ID, then create a price
stripe prices create \
  --product=prod_xxxxx \
  --unit-amount=9999 \
  --currency=usd \
  --recurring[interval]=month
```

## Step 2: Update Plans in Database

After creating the prices in Stripe, you need to update the plans in your database with the Stripe Price IDs.

### Option A: Using the Update Script

```bash
STRIPE_PRO_PRICE_ID=price_xxxxx STRIPE_ENTERPRISE_PRICE_ID=price_yyyyy bun run scripts/update-stripe-prices.ts
```

### Option B: Using Prisma Studio

```bash
bunx prisma studio
```

1. Navigate to the `Plan` table
2. Find the "Pro" plan
3. Update the `stripePriceId` field with your Stripe Price ID
4. Repeat for the "Enterprise" plan

### Option C: Direct Database Update

```bash
# Using Prisma CLI
bunx prisma db execute --stdin <<EOF
UPDATE "Plan" SET "stripePriceId" = 'price_xxxxx' WHERE name = 'Pro';
UPDATE "Plan" SET "stripePriceId" = 'price_yyyyy' WHERE name = 'Enterprise';
EOF
```

## Step 3: Verify Setup

Check that your plans have Stripe Price IDs:

```bash
bunx prisma studio
```

Navigate to the `Plan` table and verify:
- Pro plan has a `stripePriceId` (not null)
- Enterprise plan has a `stripePriceId` (not null)
- Free plan has `stripePriceId` as null (this is correct)

## Step 4: Test Subscription Flow

1. Start your development server: `bun run dev`
2. Navigate to `/billing`
3. Select an organization
4. Try subscribing to the Pro or Enterprise plan
5. You should be redirected to Stripe Checkout

## Environment Variables

Make sure you have these set in your `.env.local`:

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

## Webhook Setup

For production, you'll need to set up webhooks:

1. Go to [Stripe Dashboard > Webhooks](https://dashboard.stripe.com/test/webhooks)
2. Click "Add endpoint"
3. Set the endpoint URL to: `https://yourdomain.com/api/stripe/webhook`
4. Select events to listen to:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Copy the webhook signing secret to `STRIPE_WEBHOOK_SECRET` in your `.env.local`

For local development, use Stripe CLI:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

This will give you a webhook secret starting with `whsec_` - use this for `STRIPE_WEBHOOK_SECRET` in development.

## Notes

- The Free plan doesn't need a Stripe Price ID (it's handled directly in the code)
- Make sure you're using test mode keys for development
- Switch to live mode keys when deploying to production
- Price IDs are different between test and live mode

