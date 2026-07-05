# Architecture Overview

## System Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    macOS Desktop App                         │
│                  (Electron + React)                          │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Login      │  │  Dashboard   │  │   Create     │      │
│  │   Page       │→ │   (Posts)    │→ │  Post Page   │      │
│  │              │  │              │  │              │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                              ↓                │
│  ┌──────────────┐                   ┌──────────────┐        │
│  │  Settings    │←──────────────────│  OAuth Flow  │        │
│  │ (Platforms)  │                   │   Handler    │        │
│  └──────────────┘                   └──────────────┘        │
│           ↓                                ↓                  │
└───────────┼────────────────────────────────┼─────────────────┘
            │ HTTPS (Axios)                 │
            ↓                                ↓
┌─────────────────────────────────────────────────────────────┐
│              Backend Server (FastAPI)                         │
│              Running on localhost:8000                        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │             FastAPI Application                       │   │
│  │  ├─ /auth/authorize/{platform}                       │   │
│  │  ├─ /auth/callback/{platform}                        │   │
│  │  ├─ /posts/create                                    │   │
│  │  ├─ /posts/{user_id}                                 │   │
│  │  ├─ /posts/{post_id}/publish                         │   │
│  │  └─ /platforms/{user_id}                             │   │
│  └──────────────────────────────────────────────────────┘   │
│           ↓                            ↓                      │
│  ┌──────────────────────┐   ┌──────────────────────┐        │
│  │  OAuth Handlers      │   │  Post Publishers     │        │
│  │  - TikTok           │   │  - TikTok API        │        │
│  │  - Instagram        │   │  - Instagram API     │        │
│  │  - YouTube          │   │  - YouTube API       │        │
│  │  - Facebook         │   │  - Facebook API      │        │
│  └──────────────────────┘   └──────────────────────┘        │
│           ↓                            ↓                      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         Post Scheduler (Background Job)              │   │
│  │  - Polls every 60 seconds                            │   │
│  │  - Finds scheduled posts ready to publish            │   │
│  │  - Publishes to platforms                            │   │
│  │  - Updates status in database                        │   │
│  └──────────────────────────────────────────────────────┘   │
│           ↓                                                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         Supabase Client (Database Ops)               │   │
│  │  - user management                                   │   │
│  │  - credential storage (encrypted)                    │   │
│  │  - post CRUD operations                              │   │
│  │  - platform status tracking                          │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
└─────────────────────────────┬───────────────────────────────┘
                              │ PostgreSQL
                              ↓
┌─────────────────────────────────────────────────────────────┐
│              Supabase (PostgreSQL)                            │
│                                                               │
│  Tables:                                                      │
│  ├─ users (user accounts)                                    │
│  ├─ platform_credentials (encrypted OAuth tokens)            │
│  ├─ posts (user posts)                                       │
│  └─ post_platform_status (per-platform status)               │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow

### 1. Post Creation Flow

```
User Selects Video
       ↓
Select Platforms & Add Captions
       ↓
Frontend: POST /posts/create
       ↓
Backend: Create post record in DB (status=draft/scheduled)
       ↓
Update UI: Show post in dashboard
```

### 2. OAuth Connection Flow

```
User clicks "Connect [Platform]"
       ↓
Frontend: GET /auth/authorize/{platform}
       ↓
Backend: Generate OAuth URL with state
       ↓
Frontend: Open OAuth authorization window
       ↓
User logs in and grants permission
       ↓
OAuth Provider: Redirects to /auth/callback/{platform}?code=xxx
       ↓
Frontend: POST /auth/callback/{platform}
       ↓
Backend: Exchange code for access token
       ↓
Backend: Encrypt & store token in DB
       ↓
Update UI: Show platform as connected
```

### 3. Scheduled Post Publishing Flow

```
Backend Scheduler (runs every 60 seconds)
       ↓
Query: SELECT posts WHERE status='scheduled' AND scheduled_for <= NOW()
       ↓
For each post:
  ├─ GET user's platform credentials
  ├─ Call platform APIs with video & caption
  ├─ Receive video IDs from platforms
  ├─ Update post status to 'posted'
  └─ Update post_platform_status for each platform
       ↓
User sees post status updated in dashboard
```

## Component Breakdown

### Frontend Components

**App.js** - Router configuration
- Routes: /login, /, /create, /settings
- Auth state management

**Pages:**
- **LoginPage** - Simple authentication
- **DashboardPage** - View posts with filtering
- **CreatePostPage** - Video upload & post creation
- **SettingsPage** - Platform OAuth management

**Services:**
- **api.js** - Axios configuration with interceptors

### Backend Components

**main.py** - FastAPI application
- Route handlers
- CORS configuration
- Startup event to start scheduler

**oauth_handlers.py** - OAuth logic
- `get_oauth_url()` - Generate authorization URLs
- Platform-specific token exchange methods
- Credentials storage

**post_publishers.py** - Platform integrations
- Async functions for each platform
- Video upload & post creation
- Error handling & retry logic

**post_scheduler.py** - Background job
- AsyncIO loop that runs every 60 seconds
- Finds due posts
- Calls publishers
- Updates database

**supabase_client.py** - Database access
- CRUD operations for all tables
- Token encryption/decryption
- RLS policy handling

## Security Architecture

### Credential Storage

```
OAuth Access Token
       ↓
Encrypt with Fernet key
       ↓
Store encrypted in Supabase
       ↓
(When needed) Decrypt in memory
       ↓
Use for API calls
```

### Authentication Flow

```
Desktop App
       ↓
OAuth login with platform
       ↓
Access token received
       ↓
Store in localStorage (for session)
       ↓
Send with each API request
       ↓
Backend validates token
```

### Database Access

```
User makes request
       ↓
Backend: GET user_id from token
       ↓
Query: SELECT * FROM posts WHERE user_id = ? (RLS enforced)
       ↓
Only user's own data returned
```

## Scalability Considerations

### Current Design (Single Scheduler)

- One backend instance with scheduler
- Scheduler checks every 60 seconds
- Good for < 10k users

### Future Scaling

**Option 1: Multiple Schedulers with Locking**
```
Database: scheduler_lock table
          | scheduler_id | last_heartbeat |
Scheduler A acquires lock
→ Processes posts
→ Releases lock after 30 mins
→ Scheduler B can acquire if A dies
```

**Option 2: Message Queue (Recommended)**
```
Frontend: POST /posts/create
       ↓
Create post in DB
       ↓
Push message to Redis/RabbitMQ queue
       ↓
Worker instances consume queue
       ↓
Horizontal scaling possible
```

**Option 3: Scheduled Cloud Functions**
```
Use Firebase Cloud Functions or AWS Lambda
- Triggered on schedule
- Scales automatically
- Pay per execution
```

## Database Design

### users Table
```sql
id: UUID (Primary Key)
email: VARCHAR (Unique)
created_at: TIMESTAMP
updated_at: TIMESTAMP
```

### platform_credentials Table
```sql
id: UUID (Primary Key)
user_id: UUID (Foreign Key → users.id)
platform: VARCHAR (tiktok|instagram|youtube|facebook)
access_token: TEXT (encrypted)
refresh_token: TEXT (encrypted, optional)
token_expires_at: TIMESTAMP
created_at: TIMESTAMP
updated_at: TIMESTAMP
UNIQUE: (user_id, platform)
```

### posts Table
```sql
id: UUID (Primary Key)
user_id: UUID (Foreign Key → users.id)
video_url: TEXT (file path or base64)
captions: JSONB ({
  "tiktok": "...",
  "instagram": "...",
  "youtube": "...",
  "facebook": "..."
})
platforms: TEXT[] (["tiktok", "instagram"])
status: VARCHAR (draft|scheduled|posted|failed)
scheduled_for: TIMESTAMP (NULL if posted now)
posted_at: TIMESTAMP (when actually posted)
error_message: TEXT (if failed)
created_at: TIMESTAMP
updated_at: TIMESTAMP
```

### post_platform_status Table
```sql
id: UUID (Primary Key)
post_id: UUID (Foreign Key → posts.id)
platform: VARCHAR
status: VARCHAR (draft|scheduled|posted|failed)
platform_post_id: VARCHAR (video ID from platform)
error_message: TEXT
posted_at: TIMESTAMP
created_at: TIMESTAMP
updated_at: TIMESTAMP
UNIQUE: (post_id, platform)
```

## API Specification

### Authentication Endpoints

**GET /auth/authorize/{platform}**
```
Response: {
  "auth_url": "https://oauth.platform.com/authorize?..."
}
```

**POST /auth/callback/{platform}**
```
Body: { code, state }
Response: {
  "platform": "tiktok",
  "success": true
}
```

### Post Endpoints

**POST /posts/create**
```
Body: {
  "user_id": "...",
  "video_url": "data:video/mp4;base64,...",
  "captions": {
    "tiktok": "Cool video!",
    "instagram": "Check this out!",
    ...
  },
  "platforms": ["tiktok", "instagram", "youtube"],
  "scheduled_for": "2024-01-15T15:30:00" (null = now)
}
Response: {
  "post_id": "...",
  "status": "scheduled",
  ...
}
```

**GET /posts/{user_id}**
```
Query params: status=draft|scheduled|posted|failed
Response: {
  "posts": [
    {
      "id": "...",
      "status": "scheduled",
      "scheduled_for": "2024-01-15T15:30:00",
      ...
    }
  ]
}
```

## Error Handling

### Platform API Errors

```
TikTok API fails
       ↓
post_platform_status.status = 'failed'
post_platform_status.error_message = 'TikTok API error...'
       ↓
posts.status = 'failed' (if all platforms fail)
       ↓
User sees error in dashboard
```

### Network Errors

```
HTTP timeout
       ↓
Retry logic in post_publishers.py
       ↓
Log error after 3 retries
       ↓
Mark as failed
```

## Deployment

### Development
- Frontend: `npm start` (Electron + React dev server)
- Backend: `uvicorn main:app --reload`

### Production
- Frontend: `npm run build` → creates .dmg for macOS
- Backend: Deploy to server with gunicorn/waitress
- Database: Supabase cloud instance (auto-managed)

## Testing Strategy

### Unit Tests
- OAuth token exchange
- Caption formatting
- Database queries

### Integration Tests
- Full posting flow
- OAuth callback handling
- Scheduler execution

### E2E Tests
- User creates post → backend processes → verify in DB
- OAuth connect flow → verify credentials stored → post with new token
