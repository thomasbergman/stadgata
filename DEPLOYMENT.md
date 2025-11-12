# Deployment Guide

This guide covers how to deploy the Stockholmsparkering app to various platforms.

## Prerequisites

1. **Build the app locally first** to ensure it works:
   ```bash
   npm run build
   ```
   This creates a `dist/` folder with the production build.

2. **Environment Variable**: You'll need to set `VITE_STOCKHOLM_API_KEY` in your deployment platform's environment variables.

## Deployment Options

### Option 1: Vercel (Recommended - Easiest)

Vercel is the easiest option with automatic deployments from Git.

#### Steps:

1. **Push your code to GitHub** (if not already):
   ```bash
   git add .
   git commit -m "Ready for deployment"
   git push origin main
   ```

2. **Sign up/Login to Vercel**:
   - Go to [vercel.com](https://vercel.com)
   - Sign up with your GitHub account

3. **Import your project**:
   - Click "Add New Project"
   - Select your GitHub repository
   - Vercel will auto-detect it's a Vite project

4. **Configure environment variables**:
   - In project settings, go to "Environment Variables"
   - Add: `VITE_STOCKHOLM_API_KEY` with your API key value
   - Select "Production", "Preview", and "Development"

5. **Deploy**:
   - Click "Deploy"
   - Vercel will build and deploy automatically
   - You'll get a URL like `your-app.vercel.app`

6. **Future deployments**:
   - Every push to `main` branch auto-deploys
   - Pull requests get preview deployments

#### Vercel Configuration File (Optional)

Create `vercel.json` in the root for custom settings:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite"
}
```

---

### Option 2: Netlify

Similar to Vercel, also very easy.

#### Steps:

1. **Push your code to GitHub**

2. **Sign up/Login to Netlify**:
   - Go to [netlify.com](https://netlify.com)
   - Sign up with your GitHub account

3. **Import your project**:
   - Click "Add new site" → "Import an existing project"
   - Select your GitHub repository

4. **Configure build settings**:
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Netlify should auto-detect these

5. **Set environment variables**:
   - Go to Site settings → Environment variables
   - Add: `VITE_STOCKHOLM_API_KEY` with your API key

6. **Deploy**:
   - Click "Deploy site"
   - You'll get a URL like `your-app.netlify.app`

#### Netlify Configuration File (Optional)

Create `netlify.toml` in the root:

```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

---

### Option 3: GitHub Pages

Free hosting directly from GitHub, but requires a bit more setup.

#### Steps:

1. **Install gh-pages package**:
   ```bash
   npm install --save-dev gh-pages
   ```

2. **Add deploy script to `package.json`**:
   ```json
   "scripts": {
     "deploy": "npm run build && gh-pages -d dist"
   }
   ```

3. **Update `vite.config.ts`** to set the base path:
   ```typescript
   export default defineConfig({
     base: '/your-repo-name/', // Replace with your GitHub repo name
     plugins: [svelte()],
     // ... rest of config
   })
   ```

4. **Deploy**:
   ```bash
   npm run deploy
   ```

5. **Enable GitHub Pages**:
   - Go to your repo on GitHub
   - Settings → Pages
   - Source: `gh-pages` branch
   - Your site will be at `username.github.io/repo-name`

**Note**: GitHub Pages doesn't support environment variables directly. You'll need to use a different approach or use GitHub Actions with secrets.

---

### Option 4: Cloudflare Pages

Fast and free, similar to Vercel/Netlify.

#### Steps:

1. **Push your code to GitHub**

2. **Sign up/Login to Cloudflare**:
   - Go to [cloudflare.com](https://cloudflare.com)
   - Sign up and go to Pages

3. **Create a new project**:
   - Click "Create a project"
   - Connect your GitHub repository

4. **Configure build settings**:
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Root directory: `/` (or leave empty)

5. **Set environment variables**:
   - In project settings → Environment variables
   - Add: `VITE_STOCKHOLM_API_KEY` with your API key

6. **Deploy**:
   - Click "Save and Deploy"
   - You'll get a URL like `your-app.pages.dev`

---

## Important Notes

### Environment Variables

All platforms require you to set `VITE_STOCKHOLM_API_KEY`:
- **Vercel**: Project Settings → Environment Variables
- **Netlify**: Site Settings → Environment Variables
- **Cloudflare Pages**: Project Settings → Environment Variables
- **GitHub Pages**: Use GitHub Actions secrets (more complex)

### Custom Domain

All platforms support custom domains:
- **Vercel**: Project Settings → Domains
- **Netlify**: Site Settings → Domain management
- **Cloudflare Pages**: Custom domains in project settings
- **GitHub Pages**: Settings → Pages → Custom domain

### Build Optimization

Before deploying, you can optimize your build:

```bash
# Build for production
npm run build

# Preview the production build locally
npm run preview
```

---

## Recommended: Vercel

For this project, **Vercel is recommended** because:
- ✅ Easiest setup
- ✅ Automatic deployments from Git
- ✅ Free tier is generous
- ✅ Great performance
- ✅ Easy environment variable management
- ✅ Preview deployments for PRs

---

## Troubleshooting

### Build fails
- Check that all dependencies are in `package.json`
- Ensure `VITE_STOCKHOLM_API_KEY` is set
- Check build logs in the deployment platform

### Environment variables not working
- Make sure variable name is exactly `VITE_STOCKHOLM_API_KEY`
- Redeploy after adding environment variables
- Check that variables are set for the correct environment (Production/Preview)

### Routing issues (404 on refresh)
- Ensure your platform is configured to serve `index.html` for all routes
- Vercel/Netlify handle this automatically
- For GitHub Pages, you may need a `404.html` that redirects to `index.html`

