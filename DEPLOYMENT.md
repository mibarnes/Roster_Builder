# Deploy Roster Builder - Ultra Simple Guide

Your CFB Roster Portal is ready to deploy! Choose the easiest method below:

---

## 🚀 OPTION 1: Netlify Drop (EASIEST - 30 seconds)

**This is the simplest way - no account creation needed initially!**

1. **Build the project:**
   ```bash
   npm install
   npm run build
   ```

2. **Go to:** https://app.netlify.com/drop

3. **Drag and drop** the `dist` folder onto the page

4. **Done!** You get an instant live URL like: `https://random-name-123456.netlify.app`

5. **Optional:** Sign up (free) to:
   - Get a custom subdomain (e.g., `roster-builder.netlify.app`)
   - Keep the site permanently
   - Update it easily

---

## 🔧 OPTION 2: Netlify CLI (Still Easy)

1. **Install Netlify CLI:**
   ```bash
   npm install -g netlify-cli
   ```

2. **Build and deploy:**
   ```bash
   npm run build
   netlify deploy
   ```

3. **Follow the prompts:**
   - Create & authorize new site? Yes
   - Publish directory: `dist`

4. **Deploy to production:**
   ```bash
   netlify deploy --prod
   ```

---

## ⚡ OPTION 3: GitHub Integration (Auto-deploys on push)

1. **Push your code to GitHub** (already done if you're seeing this!)

2. **Go to:** https://app.netlify.com

3. **Click:** "Add new site" → "Import an existing project"

4. **Select:** GitHub → Choose your `Roster_Builder` repository

5. **Build settings** (auto-detected from `netlify.toml`):
   - Build command: `npm run build`
   - Publish directory: `dist`

6. **Click:** "Deploy site"

7. **Done!** Every push to main automatically deploys

---

## 🌐 OPTION 4: Vercel (Alternative to Netlify)

1. **Install Vercel CLI:**
   ```bash
   npm install -g vercel
   ```

2. **Deploy:**
   ```bash
   vercel
   ```

3. **Follow prompts** and you're live!

---

## 🎯 What You Get

After deploying, you'll receive a URL like:
- **Netlify:** `https://your-site.netlify.app`
- **Vercel:** `https://your-site.vercel.app`

You can then:
- ✅ Share this URL with anyone
- ✅ Add a custom domain (optional)
- ✅ Get automatic HTTPS
- ✅ Get automatic CDN distribution
- ✅ Free hosting (within generous limits)

---

## 🔄 Updating Your Live Site

### If you used Netlify Drop:
1. `npm run build`
2. Drag `dist` folder to your site's dashboard

### If you used CLI:
1. `npm run build`
2. `netlify deploy --prod` (or `vercel --prod`)

### If you used GitHub integration:
1. Just push to your repository - auto-deploys!

---

## 💡 Recommended: OPTION 1 (Netlify Drop)

For the absolute quickest share, use Netlify Drop. You can always upgrade to auto-deploy later.

**Total time: < 1 minute** 🎉
