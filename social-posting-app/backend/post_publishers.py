import httpx
import logging
from typing import Optional
from datetime import datetime
from models import Platform
from supabase_client import supabase_client

logger = logging.getLogger(__name__)

async def publish_to_platforms(post: dict):
    """Publish post to all requested platforms"""
    platforms = post.get("platforms", [])
    user_id = post["user_id"]
    post_id = post["id"]

    results = {}
    for platform in platforms:
        try:
            if platform == Platform.TIKTOK:
                results[platform] = await publish_to_tiktok(post, user_id)
            elif platform == Platform.INSTAGRAM:
                results[platform] = await publish_to_instagram(post, user_id)
            elif platform == Platform.YOUTUBE:
                results[platform] = await publish_to_youtube(post, user_id)
            elif platform == Platform.FACEBOOK:
                results[platform] = await publish_to_facebook(post, user_id)
        except Exception as e:
            logger.error(f"Error publishing to {platform}: {e}")
            results[platform] = {"success": False, "error": str(e)}

    # Update post status based on results
    all_success = all(r.get("success", False) for r in results.values())
    if all_success:
        supabase_client.update_post_status(post_id, "posted")
    else:
        errors = [f"{p}: {r.get('error')}" for p, r in results.items() if not r.get("success")]
        supabase_client.update_post_status(post_id, "failed", "; ".join(errors))

    # Update individual platform statuses
    for platform, result in results.items():
        status = "posted" if result.get("success") else "failed"
        platform_post_id = result.get("platform_post_id")
        supabase_client.update_platform_status(
            post_id, platform, status, platform_post_id
        )

    return results

async def publish_to_tiktok(post: dict, user_id: str) -> dict:
    """Publish to TikTok"""
    credential = supabase_client.get_credential(user_id, Platform.TIKTOK)
    if not credential:
        raise Exception("TikTok credentials not found")

    caption = post.get("captions", {}).get(Platform.TIKTOK, "")
    video_url = post["video_url"]

    async with httpx.AsyncClient() as client:
        # TikTok upload endpoint
        response = await client.post(
            "https://open.tiktokapis.com/v1/video/upload/",
            headers={"Authorization": f"Bearer {credential['access_token']}"},
            data={
                "video_url": video_url,
                "description": caption,
                "privacy_level": "PUBLIC_TO_EVERYONE"
            }
        )

        data = response.json()
        if response.status_code == 200 and data.get("data", {}).get("video_id"):
            return {
                "success": True,
                "platform_post_id": data["data"]["video_id"]
            }
        else:
            return {
                "success": False,
                "error": data.get("error", {}).get("message", "Unknown error")
            }

async def publish_to_instagram(post: dict, user_id: str) -> dict:
    """Publish to Instagram"""
    credential = supabase_client.get_credential(user_id, Platform.INSTAGRAM)
    if not credential:
        raise Exception("Instagram credentials not found")

    caption = post.get("captions", {}).get(Platform.INSTAGRAM, "")
    video_url = post["video_url"]

    async with httpx.AsyncClient() as client:
        # First create media object
        response = await client.post(
            "https://graph.instagram.com/v18.0/me/media",
            params={
                "video_url": video_url,
                "caption": caption,
                "media_type": "REELS",
                "access_token": credential["access_token"]
            }
        )

        data = response.json()
        if response.status_code == 200 and data.get("id"):
            media_id = data["id"]

            # Publish the media
            pub_response = await client.post(
                f"https://graph.instagram.com/v18.0/{media_id}/publish",
                params={"access_token": credential["access_token"]}
            )

            pub_data = pub_response.json()
            if pub_response.status_code == 200:
                return {
                    "success": True,
                    "platform_post_id": media_id
                }
            else:
                return {
                    "success": False,
                    "error": pub_data.get("error", {}).get("message", "Failed to publish")
                }
        else:
            return {
                "success": False,
                "error": data.get("error", {}).get("message", "Failed to create media")
            }

async def publish_to_youtube(post: dict, user_id: str) -> dict:
    """Publish to YouTube Shorts"""
    credential = supabase_client.get_credential(user_id, Platform.YOUTUBE)
    if not credential:
        raise Exception("YouTube credentials not found")

    caption = post.get("captions", {}).get(Platform.YOUTUBE, "")
    video_url = post["video_url"]

    async with httpx.AsyncClient() as client:
        # YouTube shorts upload
        response = await client.post(
            "https://www.googleapis.com/youtube/v3/videos?part=snippet,status",
            headers={"Authorization": f"Bearer {credential['access_token']}"},
            json={
                "snippet": {
                    "title": caption[:100],
                    "description": caption,
                    "tags": ["short"],
                    "categoryId": "22"  # Shorts category
                },
                "status": {
                    "privacyStatus": "public",
                    "madeForKids": False
                }
            }
        )

        data = response.json()
        if response.status_code == 200 and data.get("id"):
            return {
                "success": True,
                "platform_post_id": data["id"]
            }
        else:
            return {
                "success": False,
                "error": data.get("error", {}).get("message", "Unknown error")
            }

async def publish_to_facebook(post: dict, user_id: str) -> dict:
    """Publish to Facebook"""
    credential = supabase_client.get_credential(user_id, Platform.FACEBOOK)
    if not credential:
        raise Exception("Facebook credentials not found")

    caption = post.get("captions", {}).get(Platform.FACEBOOK, "")
    video_url = post["video_url"]

    async with httpx.AsyncClient() as client:
        # Get user's pages
        pages_response = await client.get(
            "https://graph.facebook.com/v18.0/me/accounts",
            params={"access_token": credential["access_token"]}
        )

        pages_data = pages_response.json()
        if not pages_data.get("data"):
            return {
                "success": False,
                "error": "No Facebook pages found"
            }

        # Use first page
        page_id = pages_data["data"][0]["id"]
        page_token = pages_data["data"][0]["access_token"]

        # Upload video to page
        response = await client.post(
            f"https://graph.facebook.com/v18.0/{page_id}/videos",
            data={
                "source": video_url,
                "description": caption,
                "access_token": page_token
            }
        )

        data = response.json()
        if response.status_code == 200 and data.get("id"):
            return {
                "success": True,
                "platform_post_id": data["id"]
            }
        else:
            return {
                "success": False,
                "error": data.get("error", {}).get("message", "Unknown error")
            }
