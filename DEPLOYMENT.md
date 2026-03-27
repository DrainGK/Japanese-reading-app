# Deployment Guide

This guide covers how to deploy N2 Reader to various platforms.

## Prerequisites

1. Built project: `npm run build`
2. The `dist/` folder ready for upload
3. A hosting service account (pick one below)

## Option 1: Netlify (Easiest)

### Method A: Drag & Drop
1. Go to [netlify.com](https://netlify.com)
2. Sign up/login
3. Drag the `dist/` folder onto the deployment area
4. Done! Your app is live

### Method B: CLI
```bash
# Install Netlify CLI
npm install -g netlify-cli

# Deploy
netlify deploy --prod --dir=dist
```

Your app will be available at: `your-site.netlify.app`

## Option 2: Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel --prod
```

Your app will be available at: `your-project.vercel.app`

## Option 3: GitHub Pages

1. Create a GitHub repository
2. Update `vite.config.ts`:
   ```typescript
   export default defineConfig({
     base: '/repo-name/',  // Change repo-name
     // ... rest of config
   })
   ```

3. Build: `npm run build`

4. Commit and push:
   ```bash
   git add .
   git commit -m "Deploy N2 Reader"
   git push origin main
   ```

5. Go to Repository Settings → Pages
6. Set Source to "Deploy from a branch"
7. Select `main` branch and `/dist` folder
8. Your app will be available at: `username.github.io/repo-name`

## Option 4: Traditional Web Server

### Using cPanel/Shared Hosting
1. Build: `npm run build`
2. FTP the `dist/` folder contents to `public_html/`
3. Done!

### Using Linux Server (Apache)
```bash
# Build locally
npm run build

# Transfer to server
scp -r dist/ user@example.com:/var/www/html/

# SSH into server and set permissions
ssh user@example.com
sudo chown -R www-data:www-data /var/www/html/
sudo chmod -R 755 /var/www/html/
```

### Using nginx
```bash
# Build
npm run build

# Copy to nginx directory
sudo cp -r dist/* /var/www/n2-reader/

# nginx config (/etc/nginx/sites-available/n2-reader)
server {
    listen 80;
    server_name yourdomain.com;
    
    root /var/www/n2-reader;
    
    # React Router support - send all requests to index.html
    try_files $uri $uri/ /index.html;
    
    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript;
}

# Enable and test
sudo nginx -s reload
```

### Using Docker
```dockerfile
# Dockerfile
FROM node:18-alpine as build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

Build and run:
```bash
docker build -t n2-reader .
docker run -p 80:80 n2-reader
```

## Option 5: AWS S3 + CloudFront

1. Create S3 bucket
2. Enable "Static website hosting"
3. Upload `dist/` contents
4. Create CloudFront distribution
5. Point domain to CloudFront

## Post-Deployment Checklist

- [ ] App loads and works on desktop
- [ ] App works on mobile phone
- [ ] Can install as PWA (Android Chrome, iOS Safari)
- [ ] WaniKani API connection works
- [ ] All routes work correctly
- [ ] Data persists locally
- [ ] Service worker is registered
- [ ] Icons display correctly

## Environment Setup (Optional)

If you need environment variables:

1. Create `.env.example`:
   ```
   VITE_WANIKANI_API=https://api.wanikani.com/v2
   ```

2. Create `.env.local` (not committed):
   ```
   VITE_WANIKANI_API=https://api.wanikani.com/v2
   ```

3. Use in code:
   ```typescript
   const API_BASE = import.meta.env.VITE_WANIKANI_API;
   ```

4. Build includes variables automatically

## Custom Domain

### With Netlify
1. Go to Site settings → Domain management
2. Click "Add custom domain"
3. Point your domain registrar DNS to Netlify nameservers

### With Vercel
1. Go to Project settings → Domains
2. Add your domain
3. Update DNS records at your registrar

### With GitHub Pages
1. Add `CNAME` file in `public/`:
   ```
   yourdomain.com
   ```
2. Update DNS A records to GitHub's IPs

## HTTPS Setup

Most platforms (Netlify, Vercel, GitHub Pages) provide free HTTPS automatically.

For self-hosted servers, use Let's Encrypt:
```bash
# Using Certbot
sudo certbot certonly --standalone -d yourdomain.com
```

## Monitoring & Maintenance

- Check analytics in your hosting dashboard
- Monitor errors in DevTools Console
- Test PWA functionality regularly
- Update content in `src/data/passages.ts` as needed
- Keep dependencies updated: `npm update`

## Troubleshooting Deployment

### "Cannot GET /" error
- Add `try_files` (nginx) or `<rewrite>` (Apache) to send all requests to index.html
- Check that dist/index.html exists

### PWA not installable
- Verify manifest.json is accessible
- Check that icons (icon-192.png, icon-512.png) exist
- Use Chrome DevTools > Application > Manifest to debug

### Service worker not updating
- Increment version in `public/service-worker.js`
- Hard refresh browser (Ctrl+Shift+R)
- Clear service worker in DevTools

### Data not persisting
- Check localStorage is enabled
- Check browser privacy settings
- Test with developer tools > Application > Local Storage

---

**Questions? Check the main [README.md](../README.md) for more help!**
