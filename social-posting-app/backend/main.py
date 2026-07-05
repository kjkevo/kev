from fastapi import FastAPI, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
from typing import Optional
import uuid

from config import settings
from models import Platform, PostStatus
from oauth_handlers import get_oauth_url, handle_oauth_callback
from supabase_client import supabase_client
from post_scheduler import start_scheduler

app = FastAPI(title="Social Posting API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    start_scheduler()

@app.get("/health")
async def health():
    return {"status": "ok"}

@app.get("/auth/authorize/{platform}")
async def authorize(platform: Platform):
    """Get OAuth authorization URL for a platform"""
    try:
        auth_url = get_oauth_url(platform)
        return {"auth_url": auth_url}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/auth/callback/{platform}")
async def oauth_callback(platform: Platform, code: str, state: str):
    """Handle OAuth callback from platform"""
    try:
        result = await handle_oauth_callback(platform, code, state)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/platforms/{user_id}")
async def get_user_platforms(user_id: str):
    """Get authenticated platforms for user"""
    try:
        credentials = supabase_client.get_user_credentials(user_id)
        return {
            "platforms": [c["platform"] for c in credentials],
            "credentials": credentials
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/posts/create")
async def create_post(
    user_id: str,
    video_url: str,
    captions: dict,
    platforms: list[str],
    scheduled_for: Optional[str] = None
):
    """Create a new post"""
    try:
        post_id = str(uuid.uuid4())

        scheduled_dt = None
        if scheduled_for:
            scheduled_dt = datetime.fromisoformat(scheduled_for)

        post_data = {
            "id": post_id,
            "user_id": user_id,
            "video_url": video_url,
            "captions": captions,
            "platforms": platforms,
            "status": "scheduled" if scheduled_for else "draft",
            "scheduled_for": scheduled_dt,
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }

        supabase_client.create_post(post_data)
        return {"post_id": post_id, **post_data}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/posts/{post_id}/publish")
async def publish_post(post_id: str):
    """Immediately publish a post"""
    try:
        result = await supabase_client.publish_post(post_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/posts/{user_id}")
async def get_user_posts(user_id: str, status: Optional[str] = None):
    """Get user's posts"""
    try:
        posts = supabase_client.get_user_posts(user_id, status)
        return {"posts": posts}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.delete("/posts/{post_id}")
async def delete_post(post_id: str):
    """Delete a post (only if not posted)"""
    try:
        supabase_client.delete_post(post_id)
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
