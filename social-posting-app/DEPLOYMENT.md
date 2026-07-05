# Deployment Guide

## Overview

This guide covers deploying the Social Posting app to production with three components:
1. **Frontend** - macOS Electron app (.dmg installer)
2. **Backend** - Python FastAPI server
3. **Database** - Supabase (cloud-hosted PostgreSQL)

## Prerequisites

- Apple Developer Account (for code signing & notarization)
- Server with Python 3.8+ and Node.js 16+
- Supabase account with production project
- OAuth credentials for all platforms (production)
- Domain name (recommended for backend)
- SSL certificates (Let's Encrypt or similar)

## Phase 1: Database Setup (Supabase)

### 1.1 Create Production Project

1. Go to https://supabase.com
2. Click "New Project"
3. Enter project name (e.g., "social-posting-prod")
4. Choose region closest to your users
5. Wait for provisioning (2-3 minutes)

### 1.2 Apply Schema

1. In Supabase dashboard, go to "SQL Editor"
2. Create new query
3. Paste contents of `database/schema.sql`
4. Run query
5. Verify all tables created in "Table Editor"

### 1.3 Configure RLS Policies

1. Go to "Authentication" → "RLS"
2. Enable RLS on all tables (should be auto-enabled by schema)
3. Test a sample query to verify policies work

### 1.4 Get Connection Details

1. Go to "Project Settings" → "Database"
2. Copy:
   - Host: `your-project.supabase.co`
   - Port: `5432`
   - Database: `postgres`
   - Username: `postgres`
   - Password: (shown only once, save it)

3. Go to "Settings" → "API"
4. Copy:
   - Project URL: `https://your-project.supabase.co`
   - anon key: (public key for frontend)
   - service_role key: (admin key for backend)

### 1.5 Backup Strategy

1. Enable automated backups in Supabase Settings
2. Set daily backups, retain 7 days
3. Configure email alerts for backup failures

## Phase 2: Backend Deployment

### 2.1 Server Setup

Choose one of:

**Option A: DigitalOcean Droplet (Recommended)**
```bash
# Create Ubuntu 20.04+ droplet
# SSH into server

# Update system
sudo apt update && sudo apt upgrade -y

# Install dependencies
sudo apt install -y python3.10 python3.10-venv python3-pip
sudo apt install -y nginx supervisor

# Create app user
sudo useradd -m -s /bin/bash socialposter
sudo su - socialposter
```

**Option B: Heroku (Simpler)**
```bash
# Install Heroku CLI
npm install -g heroku

# Login
heroku login

# Create app
heroku create social-posting-prod

# Set environment variables via dashboard
```

**Option C: AWS EC2**
```bash
# Similar to DigitalOcean
# Use Ubuntu 20.04+ AMI
```

### 2.2 Backend Installation

```bash
# Clone repository
git clone https://github.com/yourusername/social-posting.git
cd social-posting-app/backend

# Create virtual environment
python3.10 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create production .env file
nano .env
```

### 2.3 Production Environment Variables

```bash
# .env (production)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_service_role_key  # Use service role, not anon

JWT_SECRET=your_very_secure_random_secret_key_min_32_chars

# Update OAuth redirect URIs to production domain
TIKTOK_CLIENT_ID=xxx
TIKTOK_CLIENT_SECRET=xxx
TIKTOK_REDIRECT_URI=https://yourdomain.com/auth/tiktok/callback

INSTAGRAM_CLIENT_ID=xxx
INSTAGRAM_CLIENT_SECRET=xxx
INSTAGRAM_REDIRECT_URI=https://yourdomain.com/auth/instagram/callback

YOUTUBE_CLIENT_ID=xxx
YOUTUBE_CLIENT_SECRET=xxx
YOUTUBE_REDIRECT_URI=https://yourdomain.com/auth/youtube/callback

FACEBOOK_APP_ID=xxx
FACEBOOK_APP_SECRET=xxx
FACEBOOK_REDIRECT_URI=https://yourdomain.com/auth/facebook/callback

# Encryption key (generate with: python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key())")
ENCRYPTION_KEY=your_fernet_key_base64

API_URL=https://yourdomain.com
```

### 2.4 Run with Gunicorn

```bash
# Install Gunicorn
pip install gunicorn

# Test locally
gunicorn main:app --workers 4 --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000

# For production, use Supervisor or systemd
```

**Supervisor Configuration:**

```bash
# Create /etc/supervisor/conf.d/socialposter.conf
[program:socialposter]
directory=/home/socialposter/social-posting-app/backend
command=/home/socialposter/social-posting-app/backend/venv/bin/gunicorn main:app --workers 4 --worker-class uvicorn.workers.UvicornWorker --bind 127.0.0.1:8000
user=socialposter
autostart=true
autorestart=true
redirect_stderr=true
stdout_logfile=/var/log/socialposter/app.log

[unix_http_server]
file=/tmp/supervisor.sock

[supervisord]
logfile=/var/log/supervisord.log

[supervisorctl]
serverurl=unix:///tmp/supervisor.sock

[rpcinterface:supervisor]
supervisor.rpcinterface_factory = supervisor.rpcinterface:make_main_rpcinterface
```

### 2.5 Nginx Reverse Proxy

```nginx
# /etc/nginx/sites-available/socialposter
server {
    listen 80;
    listen [::]:80;
    server_name yourdomain.com;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name yourdomain.com;

    # SSL certificates (use Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_buffering off;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/socialposter /etc/nginx/sites-enabled/

# Test config
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
```

### 2.6 Setup SSL with Let's Encrypt

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Get certificate
sudo certbot certonly --nginx -d yourdomain.com

# Auto-renewal
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer
```

### 2.7 Monitoring & Logging

```bash
# View app logs
sudo tail -f /var/log/socialposter/app.log

# View nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Monitor system resources
top
df -h
```

## Phase 3: Frontend Deployment

### 3.1 Code Signing (macOS)

Before building for production, you need:
1. Apple Developer Account ($99/year)
2. Code Signing Certificate
3. Provisioning Profile

```bash
# Request certificate in Xcode
# Export certificate as .p12 file
```

### 3.2 Build Configuration

Update `frontend/package.json` build settings:

```json
"build": {
  "appId": "com.socialposter.app",
  "productName": "Social Posting",
  "files": ["build/**/*", "node_modules/**/*", "public/electron.js"],
  "mac": {
    "target": ["dmg", "zip"],
    "identity": "Developer ID Application: Your Name",
    "certificateFile": "path/to/cert.p12",
    "certificatePassword": "password"
  },
  "dmg": {
    "contents": [
      {"x": 130, "y": 220, "type": "file"},
      {"x": 410, "y": 220, "type": "link", "path": "/Applications"}
    ]
  }
}
```

### 3.3 Build & Sign

```bash
cd frontend

# Set backend API URL to production
echo "REACT_APP_API_URL=https://yourdomain.com" > .env.production

# Build
npm run build

# Create .dmg installer (auto-signed)
npm run build  # This runs electron-builder
```

### 3.4 Notarization (Required for macOS 10.15+)

```bash
# Setup Apple ID
export APPLE_ID="your@appleid.com"
export APPLE_ID_PASSWORD="your-app-specific-password"
export TEAM_ID="XXXXXXXXXX"

# Build and notarize
npm run build  # Automatically notarizes if configured
```

### 3.5 Distribution

The `.dmg` file in `frontend/dist/` can be:
1. **GitHub Releases** - Drag to release page
2. **Website** - Host on your server
3. **App Store** - Requires additional approval process
4. **Homebrew** - Create tap for distribution

## Phase 4: OAuth Production Setup

### 4.1 TikTok Developer

1. Go to https://developer.tiktok.com/
2. Create application
3. Add redirect URI: `https://yourdomain.com/auth/tiktok/callback`
4. Copy Client ID and Secret to `.env`

### 4.2 Instagram/Facebook

1. Go to https://developers.facebook.com/
2. Create application
3. Add platforms: Instagram & Facebook
4. Add redirect URIs for both
5. Complete app review process

### 4.3 YouTube

1. Go to https://console.cloud.google.com/
2. Create project
3. Enable YouTube Data API v3
4. Create OAuth 2.0 credentials
5. Add redirect URI
6. Copy credentials to `.env`

### 4.4 Facebook

1. Already setup in step 4.2
2. Configure page access tokens for page posting

## Phase 5: Monitoring & Maintenance

### 5.1 Health Checks

```bash
# Check API is responding
curl https://yourdomain.com/health

# Monitor database
# Use Supabase dashboard for connection stats
```

### 5.2 Automated Backups

```bash
# Daily database backup
# Configure in Supabase Settings → Backups

# Daily code backup
0 2 * * * /usr/bin/git -C /home/socialposter/social-posting-app pull origin main
```

### 5.3 Error Tracking (Optional)

Add Sentry for error monitoring:

```bash
# Backend
pip install sentry-sdk

# Add to main.py
import sentry_sdk
sentry_sdk.init("your-sentry-dsn")
```

### 5.4 Performance Monitoring

```bash
# Monitor database performance
# Use Supabase dashboard "Database" section
# Check query execution times

# Monitor API response times
# Setup monitoring with New Relic or DataDog
```

## Troubleshooting Production Issues

### Backend won't start

```bash
# Check logs
sudo journalctl -u socialposter -n 50

# Test configuration
python3 -c "from config import settings; print(settings.dict())"

# Check Supabase connectivity
psql -h your-project.supabase.co -U postgres -d postgres
```

### OAuth callbacks failing

```bash
# Verify redirect URIs match exactly
# Check platform settings
# Ensure domain has SSL certificate
# Check firewall allows outbound HTTPS
```

### Database connection issues

```bash
# Verify connection string
echo $SUPABASE_URL
echo $SUPABASE_KEY

# Test connection
python3 -c "from supabase_client import supabase_client; print(supabase_client.client.auth.get_session())"

# Check Supabase status page
# https://status.supabase.com
```

### App crashes on startup

```bash
# Check app logs
~/Library/Logs/Social Posting/main.log

# Verify backend is running
curl https://yourdomain.com/health

# Try rebuilding app
cd frontend && npm run build
```

## Scaling Considerations

### When to Scale Up

- **Database**: > 1M posts/month → consider read replicas
- **Backend**: > 100 req/sec → add more workers or load balancer
- **Scheduler**: > 10k scheduled posts → switch to queue-based system

### Scaling Strategy

1. **Initial**: 1 backend instance, Supabase free tier
2. **Growth**: Add load balancer (HAProxy/ALB), increase Supabase plan
3. **Scale**: Switch to Kubernetes, multiple worker instances, Redis queue

## Security Checklist

- [ ] All environment variables set in production
- [ ] SSL/HTTPS enabled
- [ ] Firewall rules configured (only 80, 443 exposed)
- [ ] Database backups enabled
- [ ] OAuth tokens never logged
- [ ] Encryption keys secured
- [ ] Rate limiting configured
- [ ] CORS properly configured for production domain
- [ ] Security headers set (HSTS, CSP, etc.)
- [ ] Regular security updates applied

## Rollback Procedure

```bash
# If deployment breaks
git revert <commit-hash>
git push origin main

# Restart backend
sudo systemctl restart socialposter

# Verify
curl https://yourdomain.com/health
```

## Support & Resources

- **Supabase Docs**: https://supabase.com/docs
- **FastAPI Docs**: https://fastapi.tiangolo.com/
- **Electron Docs**: https://www.electronjs.org/docs
- **Platform API Docs**: 
  - TikTok: https://developers.tiktok.com/doc/
  - Instagram: https://developers.facebook.com/docs/instagram
  - YouTube: https://developers.google.com/youtube/
  - Facebook: https://developers.facebook.com/docs/graph-api/
