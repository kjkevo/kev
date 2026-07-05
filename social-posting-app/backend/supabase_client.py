from supabase import create_client, Client
from config import settings
from typing import Optional, List
from datetime import datetime
from cryptography.fernet import Fernet
import os
import json

class SupabaseManager:
    def __init__(self):
        self.client: Client = create_client(settings.supabase_url, settings.supabase_key)
        # In production, load from secure key management system
        self.encryption_key = os.getenv("ENCRYPTION_KEY", b"development-key-not-secure")
        self.cipher = Fernet(self.encryption_key)

    def _encrypt_token(self, token: str) -> str:
        """Encrypt sensitive token"""
        return self.cipher.encrypt(token.encode()).decode()

    def _decrypt_token(self, encrypted_token: str) -> str:
        """Decrypt sensitive token"""
        return self.cipher.decrypt(encrypted_token.encode()).decode()

    def create_user(self, user_id: str, email: str) -> dict:
        """Create user record"""
        response = self.client.table("users").insert({
            "id": user_id,
            "email": email,
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }).execute()
        return response.data[0] if response.data else None

    def store_credential(self, user_id: str, credential: dict) -> dict:
        """Store encrypted OAuth credential"""
        encrypted_token = self._encrypt_token(credential["access_token"])
        encrypted_refresh = None
        if credential.get("refresh_token"):
            encrypted_refresh = self._encrypt_token(credential["refresh_token"])

        response = self.client.table("platform_credentials").upsert({
            "user_id": user_id,
            "platform": credential["platform"],
            "access_token": encrypted_token,
            "refresh_token": encrypted_refresh,
            "token_expires_at": credential.get("token_expires_at"),
            "updated_at": datetime.utcnow().isoformat()
        }).execute()
        return response.data[0] if response.data else None

    def get_user_credentials(self, user_id: str) -> List[dict]:
        """Get all platform credentials for user"""
        response = self.client.table("platform_credentials").select("*").eq(
            "user_id", user_id
        ).execute()

        # Don't decrypt for display - only decrypt when using tokens
        return response.data if response.data else []

    def get_credential(self, user_id: str, platform: str) -> Optional[dict]:
        """Get specific platform credential (decrypted)"""
        response = self.client.table("platform_credentials").select("*").eq(
            "user_id", user_id
        ).eq("platform", platform).execute()

        if response.data:
            cred = response.data[0]
            cred["access_token"] = self._decrypt_token(cred["access_token"])
            if cred.get("refresh_token"):
                cred["refresh_token"] = self._decrypt_token(cred["refresh_token"])
            return cred
        return None

    def create_post(self, post_data: dict) -> dict:
        """Create a new post"""
        response = self.client.table("posts").insert(post_data).execute()
        return response.data[0] if response.data else None

    def get_user_posts(self, user_id: str, status: Optional[str] = None) -> List[dict]:
        """Get user's posts"""
        query = self.client.table("posts").select("*").eq("user_id", user_id)
        if status:
            query = query.eq("status", status)
        response = query.order("created_at", desc=True).execute()
        return response.data if response.data else []

    def get_post(self, post_id: str) -> Optional[dict]:
        """Get a specific post"""
        response = self.client.table("posts").select("*").eq("id", post_id).execute()
        return response.data[0] if response.data else None

    def update_post_status(self, post_id: str, status: str, error_msg: Optional[str] = None):
        """Update post status"""
        data = {
            "status": status,
            "updated_at": datetime.utcnow().isoformat()
        }
        if error_msg:
            data["error_message"] = error_msg
        if status == "posted":
            data["posted_at"] = datetime.utcnow().isoformat()

        response = self.client.table("posts").update(data).eq("id", post_id).execute()
        return response.data[0] if response.data else None

    def update_platform_status(self, post_id: str, platform: str, status: str, platform_post_id: Optional[str] = None):
        """Update platform-specific post status"""
        data = {
            "status": status,
            "updated_at": datetime.utcnow().isoformat()
        }
        if status == "posted":
            data["posted_at"] = datetime.utcnow().isoformat()
        if platform_post_id:
            data["platform_post_id"] = platform_post_id

        response = self.client.table("post_platform_status").upsert(
            {**data, "post_id": post_id, "platform": platform}
        ).execute()
        return response.data[0] if response.data else None

    async def publish_post(self, post_id: str) -> dict:
        """Publish post immediately"""
        post = self.get_post(post_id)
        if not post:
            raise Exception("Post not found")

        # Update status to scheduled with immediate time
        self.update_post_status(post_id, "scheduled")
        return {"success": True, "post_id": post_id}

    def delete_post(self, post_id: str):
        """Delete post (only drafts/scheduled)"""
        post = self.get_post(post_id)
        if post and post["status"] not in ["draft", "scheduled"]:
            raise Exception("Can only delete draft or scheduled posts")

        self.client.table("posts").delete().eq("id", post_id).execute()
        return {"success": True}

    def get_scheduled_posts(self) -> List[dict]:
        """Get all posts ready to be posted"""
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc).isoformat()

        response = self.client.table("posts").select("*").eq(
            "status", "scheduled"
        ).lte("scheduled_for", now).execute()

        return response.data if response.data else []

supabase_client = SupabaseManager()
