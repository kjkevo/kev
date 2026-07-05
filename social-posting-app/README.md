# Social Posting - Multi-Platform Social Media Posting Desktop App

A macOS desktop application that lets you post to TikTok, Instagram, YouTube Shorts, and Facebook all at once.

## Features

✅ **Multi-Platform Posting** - Post videos to TikTok, Instagram, YouTube Shorts, and Facebook simultaneously
✅ **OAuth Authentication** - Securely authenticate with each platform with one-time sign-in
✅ **Customizable Captions** - Add platform-specific or shared captions
✅ **Scheduled Posting** - Schedule posts for later or post immediately
✅ **Post Management** - View, edit, and delete your posts
✅ **Background Scheduling** - Posts are queued and published even if the app is closed
✅ **Secure Credential Storage** - OAuth tokens encrypted and stored securely in Supabase

## Architecture

```
social-posting-app/
├── frontend/              # Electron + React desktop app
│   ├── public/           # Static files and Electron main process
│   └── src/              # React components and styles
│
├── backend/              # Python FastAPI server
│   ├── main.py          # FastAPI application
│   ├── oauth_handlers.py # OAuth logic for each platform
│   ├── post_publishers.py # Platform API integration
│   ├── post_scheduler.py  # Background job scheduler
│   └── supabase_client.py # Database operations
│
└── database/            # Supabase schema and migrations
    └── schema.sql       # PostgreSQL schema
```

## Tech Stack

**Frontend:**
- Electron (macOS)
- React 18
- Axios

**Backend:**
- Python 3.8+
- FastAPI
- Supabase (PostgreSQL)
- HTTPX (async HTTP client)

**Database:**
- Supabase (PostgreSQL with Row Level Security)

## Setup Instructions

### Prerequisites

- Node.js 16+ and npm
- Python 3.8+
- Supabase account (free tier works)
- OAuth credentials from each platform:
  - TikTok Developer Account
  - Instagram/Facebook App
  - Google Cloud Project (YouTube)
  - Facebook App

### 1. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy environment variables
cp .env.example .env

# Update .env with your credentials
# SUPABASE_URL, SUPABASE_KEY, OAuth credentials, etc.

# Run migrations (in Supabase dashboard)
# Go to SQL Editor and run database/schema.sql

# Start backend server
uvicorn main:app --reload
```

Backend will run on `http://localhost:8000`

### 2. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development (opens Electron app with React dev server)
npm start
```

### 3. Supabase Setup

1. Create a new Supabase project
2. Go to SQL Editor
3. Paste and run the contents of `database/schema.sql`
4. Copy your project URL and API key to backend `.env`

### 4. OAuth Credentials

For each platform, you'll need to register OAuth applications:

**TikTok:**
- Visit: https://developer.tiktok.com/
- Create app with redirect URI: `http://localhost:3000/auth/tiktok/callback`

**Instagram/Facebook:**
- Visit: https://developers.facebook.com/
- Create app, add Instagram/Facebook products
- Redirect URI: `http://localhost:3000/auth/instagram/callback`

**YouTube:**
- Visit: https://console.cloud.google.com/
- Create OAuth 2.0 credentials
- Redirect URI: `http://localhost:3000/auth/youtube/callback`

**Facebook:**
- Already created above
- Redirect URI: `http://localhost:3000/auth/facebook/callback`

Copy all credentials to backend `.env` file.

## Project Structure Details

### Frontend Components

**Pages:**
- `LoginPage.js` - Simple email/password login
- `DashboardPage.js` - View all posts with filters (drafts, scheduled, posted)
- `CreatePostPage.js` - Create and upload videos with multi-platform support
- `SettingsPage.js` - Manage platform connections via OAuth

**Services:**
- `api.js` - Axios configuration and API methods

**Styles:**
- Responsive CSS for all pages
- Dark sidebar navigation
- Clean, modern card-based UI

### Backend Endpoints

```
Authentication:
GET    /health                          - Health check
GET    /auth/authorize/{platform}       - Get OAuth URL
POST   /auth/callback/{platform}        - Handle OAuth callback

Posts:
POST   /posts/create                    - Create new post
GET    /posts/{user_id}                 - Get user's posts
POST   /posts/{post_id}/publish         - Publish immediately
DELETE /posts/{post_id}                 - Delete post

Platforms:
GET    /platforms/{user_id}             - Get connected platforms
```

### Database Schema

**users** - User accounts
**platform_credentials** - Encrypted OAuth tokens (one per platform per user)
**posts** - Posts created by users
**post_platform_status** - Individual status tracking per platform

Row-level security (RLS) ensures users can only access their own data.

## Environment Variables

### Backend (.env)

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_supabase_anon_key
JWT_SECRET=your_secret_key

TIKTOK_CLIENT_ID=xxx
TIKTOK_CLIENT_SECRET=xxx
TIKTOK_REDIRECT_URI=http://localhost:3000/auth/tiktok/callback

INSTAGRAM_CLIENT_ID=xxx
INSTAGRAM_CLIENT_SECRET=xxx
INSTAGRAM_REDIRECT_URI=http://localhost:3000/auth/instagram/callback

YOUTUBE_CLIENT_ID=xxx
YOUTUBE_CLIENT_SECRET=xxx
YOUTUBE_REDIRECT_URI=http://localhost:3000/auth/youtube/callback

FACEBOOK_APP_ID=xxx
FACEBOOK_APP_SECRET=xxx
FACEBOOK_REDIRECT_URI=http://localhost:3000/auth/facebook/callback

API_URL=http://localhost:8000
ENCRYPTION_KEY=your_fernet_key_base64
```

### Frontend (.env)

```
REACT_APP_API_URL=http://localhost:8000
```

## How It Works

### Posting Flow

1. **User selects video** - Upload existing video file
2. **Select platforms** - Check which platforms to post to
3. **Add captions** - Write platform-specific captions (or use same for all)
4. **Choose timing** - Post now or schedule for later
5. **Publish** - Post sent to backend

### Scheduled Posts

- Backend scheduler checks every 60 seconds for due posts
- When scheduled time arrives, post is queued for publishing
- Platform APIs are called asynchronously
- Individual platform status tracked in database
- Users notified of success/failure

### OAuth Flow

1. User clicks "Connect [Platform]"
2. Desktop app opens OAuth authorization URL
3. User logs in and grants permission
4. OAuth callback returns code
5. Backend exchanges code for access/refresh tokens
6. Tokens encrypted and stored in Supabase
7. User can now post to that platform

## Building for Production

### macOS App Bundle

```bash
cd frontend
npm run build
npm run build  # Builds Electron app
```

Creates `.dmg` installer in `dist/` folder.

## Security Considerations

- ✅ OAuth tokens encrypted at rest with Fernet
- ✅ Row-level security on database tables
- ✅ HTTPS only in production
- ✅ Environment variables for secrets (not in code)
- ✅ IPC sandboxing between Electron main and renderer
- ✅ No direct Node.js access from React code

## Troubleshooting

**Port already in use:**
```bash
# Backend on different port
uvicorn main:app --reload --port 8001

# Update frontend API_URL to match
```

**OAuth callback not working:**
- Make sure redirect URIs exactly match in OAuth apps and .env
- Check localhost is resolvable
- Clear browser cookies if testing multiple accounts

**Supabase connection errors:**
- Verify SUPABASE_URL and SUPABASE_KEY are correct
- Check project is active in Supabase dashboard
- Ensure schema.sql was run successfully

**Video upload issues:**
- Check video format (MP4, MOV, AVI supported)
- Video should be under 5GB
- Ensure sufficient disk space

## Development Tips

**Testing OAuth locally:**
- Use ngrok to tunnel localhost: `ngrok http 3000`
- Update OAuth redirect URIs to ngrok URL
- Use in .env as well

**Database debugging:**
- Use Supabase dashboard SQL editor to query tables
- Check RLS policies if permission errors occur

**Backend logging:**
- Enable debug logging in config.py
- Check post_scheduler.py logs for publishing issues

## Future Enhancements

- [ ] TikTok Shop integration
- [ ] Instagram Stories posting
- [ ] Analytics and performance metrics
- [ ] Batch scheduling for multiple posts
- [ ] Content calendar view
- [ ] AI-powered caption suggestions
- [ ] Video editing tools (trim, crop, filters)
- [ ] Hashtag research and optimization
- [ ] Best time to post recommendations

## Contributing

Contributions welcome! Please follow existing code style and add tests for new features.

## License

MIT - Feel free to use for personal or commercial projects.

## Support

For issues, feature requests, or questions:
- Check existing GitHub issues
- Create new issue with detailed description
- Include error logs and reproduction steps
