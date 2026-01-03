# Environment Variables Guide

## New Environment Variables Required

### Email Configuration (NodeMailer)
These are required for the email system to send verification, password reset, and notification emails.

```env
# SMTP Server Configuration
SMTP_HOST=smtp.gmail.com                    # Your SMTP server hostname
SMTP_PORT=587                                # SMTP port (587 for TLS, 465 for SSL)
SMTP_SECURE=false                            # true for SSL (port 465), false for TLS (port 587)
SMTP_USER=your-email@gmail.com              # SMTP username (usually your email)
SMTP_PASS=your-app-password                 # SMTP password or app-specific password
SMTP_FROM=noreply@yourdomain.com            # From email address (optional, defaults to SMTP_USER)
```

**Common SMTP Providers:**
- **Gmail**: `smtp.gmail.com`, port `587`, requires app password
- **SendGrid**: `smtp.sendgrid.net`, port `587`, use API key as password
- **AWS SES**: `email-smtp.region.amazonaws.com`, port `587`
- **Mailgun**: `smtp.mailgun.org`, port `587`

### GitHub Integration
Required for bidirectional GitHub sync functionality.

```env
# GitHub OAuth App
GITHUB_CLIENT_ID=your_github_client_id      # From GitHub OAuth App settings
GITHUB_CLIENT_SECRET=your_github_client_secret  # From GitHub OAuth App settings

# GitHub Webhook Secret
GITHUB_WEBHOOK_SECRET=your_webhook_secret   # Secret for verifying GitHub webhook signatures

# GitHub Token Encryption (Optional)
GITHUB_ENCRYPTION_KEY=your_encryption_key   # Optional: defaults to NEXTAUTH_SECRET if not set
```

**How to get GitHub OAuth credentials:**
1. Go to GitHub Settings → Developer settings → OAuth Apps
2. Create a new OAuth App
3. Set Authorization callback URL to: `https://yourdomain.com/api/github/callback`
4. Copy Client ID and Client Secret

**How to set up GitHub Webhook:**

**For Production:**
1. Go to your repository → Settings → Webhooks → Add webhook
2. **Payload URL**: `https://yourdomain.com/api/github/webhook`
3. **Content type**: Select `application/json`
4. **Secret**: 
   - **Generate a secret** using one of these methods:
     - **On Mac/Linux**: Run `openssl rand -hex 32` in your terminal
     - **On Windows**: Use PowerShell: `-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 64 | % {[char]$_})`
     - **Online**: Use a secure random string generator (e.g., https://randomkeygen.com/)
   - **Copy the generated secret**
   - **Paste it into the "Secret" field** in the GitHub webhook form
   - **Add it to your `.env.local`** as: `GITHUB_WEBHOOK_SECRET=your_generated_secret_here`
   - **Also add it to Vercel** (or your production environment) in the environment variables section
5. **SSL verification**: Keep "Enable SSL verification" selected (recommended)
6. **Which events**: Select "Let me select individual events" and check:
   - `issues` (currently implemented)
   - `issue_comment` (optional, for future implementation)
7. **Active**: Check the "Active" checkbox
8. Click "Add webhook"

**For Local Development:**
- GitHub cannot send webhooks directly to `localhost`
- Use a tunneling service like [ngrok](https://ngrok.com/) or [localtunnel](https://localtunnel.github.io/www/)
- Example with ngrok: `ngrok http 3000`
- Use the ngrok URL in the Payload URL field: `https://your-ngrok-url.ngrok.io/api/github/webhook`
- Use the same secret for both local and production (or different secrets if preferred)

## Existing Environment Variables (Still Required)

### Authentication
```env
NEXTAUTH_URL=http://localhost:3000          # Your app URL (used for email links)
NEXTAUTH_SECRET=your_secret                  # Secret for NextAuth (also used for GitHub token encryption if GITHUB_ENCRYPTION_KEY not set)
```

### Database
```env
DATABASE_URL=your_postgres_connection_string
```

### Stripe (Already configured)
```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

### Pusher (Already configured)
```env
PUSHER_APP_ID=your_app_id
PUSHER_KEY=your_key
PUSHER_SECRET=your_secret
PUSHER_CLUSTER=us2
NEXT_PUBLIC_PUSHER_KEY=your_key
NEXT_PUBLIC_PUSHER_CLUSTER=us2
```

### AI (Already configured)
```env
AI_PROVIDER=gemini
GOOGLE_GEMINI_API_KEY=your_key
```

## Complete .env.local Example

```env
# Database
DATABASE_URL=postgresql://user:password@host/database

# Authentication
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-nextauth-secret-here

# Email (NEW)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@yourdomain.com

# GitHub Integration (NEW)
# Note: These are APPLICATION-LEVEL credentials. You create ONE GitHub OAuth App
# for your entire application. Each user/organization authenticates through this
# app and gets their own access token, which is stored encrypted per board.
GITHUB_CLIENT_ID=your_github_client_id          # From your GitHub OAuth App
GITHUB_CLIENT_SECRET=your_github_client_secret # From your GitHub OAuth App
GITHUB_WEBHOOK_SECRET=your_webhook_secret     # For verifying GitHub webhooks
GITHUB_ENCRYPTION_KEY=optional-encryption-key  # For encrypting user tokens (defaults to NEXTAUTH_SECRET)

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Pusher
PUSHER_APP_ID=your_app_id
PUSHER_KEY=your_key
PUSHER_SECRET=your_secret
PUSHER_CLUSTER=us2
NEXT_PUBLIC_PUSHER_KEY=your_key
NEXT_PUBLIC_PUSHER_CLUSTER=us2

# AI
AI_PROVIDER=gemini
GOOGLE_GEMINI_API_KEY=your_key
```

## Production Checklist

When deploying to production (e.g., Vercel), make sure to add:

1. ✅ All SMTP variables (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM)
2. ✅ GitHub OAuth credentials (GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET)
3. ✅ GitHub webhook secret (GITHUB_WEBHOOK_SECRET)
4. ✅ Update NEXTAUTH_URL to your production domain
5. ✅ Update GitHub OAuth callback URL to production domain
6. ✅ Update GitHub webhook URL to production domain

## Testing Email Locally

For local development, you can use:
- **Mailtrap** (free testing SMTP server)
- **Ethereal Email** (generates test credentials)
- **Gmail** with app password (requires 2FA enabled)

## Notes

- `SMTP_FROM` is optional - if not set, it defaults to `SMTP_USER`
- `GITHUB_ENCRYPTION_KEY` is optional - if not set, it uses `NEXTAUTH_SECRET`
- `SMTP_SECURE` should be `false` for port 587 (TLS) and `true` for port 465 (SSL)
- For Gmail, you'll need to generate an "App Password" in your Google Account settings (not your regular password)

## GitHub OAuth Setup

**Important**: The GitHub OAuth credentials (`GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`) are **application-level**, not per-user:

1. **Create ONE GitHub OAuth App** at https://github.com/settings/developers
   - Set Authorization callback URL to: `https://yourdomain.com/api/github/callback`
   - Copy the Client ID and Client Secret to your `.env.local`

2. **How it works**:
   - All users authenticate through the same OAuth App
   - Each user gets their own access token when they connect GitHub
   - Tokens are stored encrypted in the database per board (`githubAccessToken` field)
   - Each organization/user can connect their own GitHub account - the token is stored separately per board

3. **Webhook Setup** (optional, for bidirectional sync):
   - Create a webhook in your GitHub repository settings (see detailed instructions above)
   - Set the webhook URL to: `https://yourdomain.com/api/github/webhook` (production) or use ngrok for local development
   - Generate a webhook secret and add it to `GITHUB_WEBHOOK_SECRET` in your environment variables
   - Select `issues` events (and optionally `issue_comment` for future features)
   - Keep SSL verification enabled

