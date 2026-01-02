# Deployment Fixes for NextAuth.js

## Issue: Sign-in works on localhost but not in production

### Common Causes:

1. **NEXTAUTH_URL not set correctly**
2. **Cookie settings not configured for HTTPS**
3. **Domain mismatch issues**

### Fixes Applied:

1. **Updated cookie configuration** in `src/lib/auth-config.ts`:
   - Added `Secure` flag for production (HTTPS only)
   - Added `SameSite: "lax"` for cross-site compatibility
   - Added `__Secure-` prefix for production cookies (browser security requirement)

### Required Environment Variables in Vercel:

Make sure these are set in your Vercel project settings:

#### Production Environment:
```env
NEXTAUTH_URL=https://your-app.vercel.app
NEXTAUTH_SECRET=your-secret-here (generate with: openssl rand -base64 32)
DATABASE_URL=your-neon-connection-string
```

#### Important Notes:

1. **NEXTAUTH_URL must match your production domain exactly**
   - If your app is at `https://my-app.vercel.app`, set `NEXTAUTH_URL=https://my-app.vercel.app`
   - No trailing slash
   - Must use `https://` (not `http://`)

2. **NEXTAUTH_SECRET must be the same across all environments**
   - Generate once: `openssl rand -base64 32`
   - Use the same secret in all environments (production, preview, development)

3. **Cookie Settings:**
   - Production cookies require `Secure` flag (HTTPS only)
   - `SameSite: "lax"` allows cookies to work with redirects
   - `__Secure-` prefix is a browser security requirement for production

### How to Set in Vercel:

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add/Update these variables:
   - `NEXTAUTH_URL` = `https://your-app.vercel.app` (Production)
   - `NEXTAUTH_SECRET` = `your-generated-secret` (All environments)
   - `DATABASE_URL` = `your-neon-connection-string` (All environments)

4. **Redeploy** after adding/updating environment variables

### Testing:

After deploying:
1. Try signing in on the production site
2. Check browser DevTools → Application → Cookies
3. Look for `next-auth.session-token` cookie (or `__Secure-next-auth.session-token` in production)
4. Verify the cookie has:
   - `Secure` flag (production only)
   - `SameSite: Lax`
   - Correct domain

### Troubleshooting:

If still not working:

1. **Check Vercel logs** for NextAuth errors
2. **Verify NEXTAUTH_URL** matches your domain exactly
3. **Check cookie domain** - should match your Vercel domain
4. **Try incognito mode** to rule out cookie conflicts
5. **Check browser console** for any cookie-related errors

### Additional Debugging:

Enable debug mode in production temporarily:
```env
NEXTAUTH_DEBUG=true
```

This will show detailed logs in Vercel's function logs.


