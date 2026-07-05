import httpx
import urllib.parse
from datetime import datetime, timedelta
from typing import Optional
import uuid

from config import settings
from models import Platform
from supabase_client import supabase_client

def get_oauth_url(platform: Platform) -> str:
    """Generate OAuth authorization URL for platform"""
    state = str(uuid.uuid4())

    if platform == Platform.TIKTOK:
        params = {
            "client_key": settings.tiktok_client_id,
            "scope": "user.info.basic,video.upload",
            "response_type": "code",
            "redirect_uri": settings.tiktok_redirect_uri,
            "state": state
        }
        return f"https://www.tiktok.com/v1/oauth/authorize?{urllib.parse.urlencode(params)}"

    elif platform == Platform.INSTAGRAM:
        params = {
            "client_id": settings.instagram_client_id,
            "scope": "instagram_business_basic,instagram_business_content_publish",
            "response_type": "code",
            "redirect_uri": settings.instagram_redirect_uri,
            "state": state
        }
        return f"https://api.instagram.com/oauth/authorize?{urllib.parse.urlencode(params)}"

    elif platform == Platform.YOUTUBE:
        params = {
            "client_id": settings.youtube_client_id,
            "scope": "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/userinfo.email",
            "response_type": "code",
            "redirect_uri": settings.youtube_redirect_uri,
            "access_type": "offline",
            "state": state
        }
        return f"https://accounts.google.com/o/oauth2/v2/auth?{urllib.parse.urlencode(params)}"

    elif platform == Platform.FACEBOOK:
        params = {
            "client_id": settings.facebook_app_id,
            "scope": "pages_manage_metadata,pages_read_engagement,pages_manage_posts",
            "response_type": "code",
            "redirect_uri": settings.facebook_redirect_uri,
            "state": state
        }
        return f"https://www.facebook.com/v18.0/dialog/oauth?{urllib.parse.urlencode(params)}"

    else:
        raise ValueError(f"Unknown platform: {platform}")

async def handle_oauth_callback(
    platform: Platform,
    code: str,
    state: str,
    user_id: Optional[str] = None
) -> dict:
    """Handle OAuth callback and store credentials"""

    if platform == Platform.TIKTOK:
        return await _handle_tiktok_callback(code, user_id)
    elif platform == Platform.INSTAGRAM:
        return await _handle_instagram_callback(code, user_id)
    elif platform == Platform.YOUTUBE:
        return await _handle_youtube_callback(code, user_id)
    elif platform == Platform.FACEBOOK:
        return await _handle_facebook_callback(code, user_id)
    else:
        raise ValueError(f"Unknown platform: {platform}")

async def _handle_tiktok_callback(code: str, user_id: Optional[str]) -> dict:
    """TikTok OAuth token exchange"""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://open.tiktokapis.com/v1/oauth/token",
            data={
                "client_key": settings.tiktok_client_id,
                "client_secret": settings.tiktok_client_secret,
                "code": code,
                "grant_type": "authorization_code"
            }
        )
        data = response.json()

        if "access_token" not in data:
            raise Exception(f"TikTok OAuth error: {data}")

        expires_in = data.get("expires_in", 3600)
        token_expires_at = datetime.utcnow() + timedelta(seconds=expires_in)

        credential = {
            "platform": Platform.TIKTOK,
            "access_token": data["access_token"],
            "refresh_token": data.get("refresh_token"),
            "token_expires_at": token_expires_at.isoformat()
        }

        supabase_client.store_credential(user_id, credential)
        return {"platform": Platform.TIKTOK, "success": True}

async def _handle_instagram_callback(code: str, user_id: Optional[str]) -> dict:
    """Instagram OAuth token exchange"""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://graph.instagram.com/v18.0/oauth/access_token",
            data={
                "client_id": settings.instagram_client_id,
                "client_secret": settings.instagram_client_secret,
                "grant_type": "authorization_code",
                "redirect_uri": settings.instagram_redirect_uri,
                "code": code
            }
        )
        data = response.json()

        if "access_token" not in data:
            raise Exception(f"Instagram OAuth error: {data}")

        credential = {
            "platform": Platform.INSTAGRAM,
            "access_token": data["access_token"],
            "token_expires_at": (datetime.utcnow() + timedelta(days=60)).isoformat()
        }

        supabase_client.store_credential(user_id, credential)
        return {"platform": Platform.INSTAGRAM, "success": True}

async def _handle_youtube_callback(code: str, user_id: Optional[str]) -> dict:
    """YouTube OAuth token exchange"""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "client_id": settings.youtube_client_id,
                "client_secret": settings.youtube_client_secret,
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": settings.youtube_redirect_uri
            }
        )
        data = response.json()

        if "access_token" not in data:
            raise Exception(f"YouTube OAuth error: {data}")

        expires_in = data.get("expires_in", 3600)
        token_expires_at = datetime.utcnow() + timedelta(seconds=expires_in)

        credential = {
            "platform": Platform.YOUTUBE,
            "access_token": data["access_token"],
            "refresh_token": data.get("refresh_token"),
            "token_expires_at": token_expires_at.isoformat()
        }

        supabase_client.store_credential(user_id, credential)
        return {"platform": Platform.YOUTUBE, "success": True}

async def _handle_facebook_callback(code: str, user_id: Optional[str]) -> dict:
    """Facebook OAuth token exchange"""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://graph.facebook.com/v18.0/oauth/access_token",
            params={
                "client_id": settings.facebook_app_id,
                "client_secret": settings.facebook_app_secret,
                "redirect_uri": settings.facebook_redirect_uri,
                "code": code
            }
        )
        data = response.json()

        if "access_token" not in data:
            raise Exception(f"Facebook OAuth error: {data}")

        credential = {
            "platform": Platform.FACEBOOK,
            "access_token": data["access_token"],
            "token_expires_at": (datetime.utcnow() + timedelta(days=60)).isoformat()
        }

        supabase_client.store_credential(user_id, credential)
        return {"platform": Platform.FACEBOOK, "success": True}
