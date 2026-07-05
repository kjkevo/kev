import asyncio
from datetime import datetime
import logging
from supabase_client import supabase_client
from post_publishers import publish_to_platforms

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class PostScheduler:
    def __init__(self):
        self.running = False
        self.task = None

    async def check_and_publish(self):
        """Check for scheduled posts and publish them"""
        try:
            scheduled_posts = supabase_client.get_scheduled_posts()

            for post in scheduled_posts:
                logger.info(f"Publishing post {post['id']}")
                await publish_to_platforms(post)

        except Exception as e:
            logger.error(f"Error in scheduler: {e}")

    async def run(self):
        """Main scheduler loop - runs every 60 seconds"""
        self.running = True
        logger.info("Post scheduler started")

        while self.running:
            try:
                await self.check_and_publish()
                await asyncio.sleep(60)  # Check every minute
            except Exception as e:
                logger.error(f"Scheduler error: {e}")
                await asyncio.sleep(60)

    def start(self):
        """Start the scheduler"""
        if not self.running:
            self.task = asyncio.create_task(self.run())

    def stop(self):
        """Stop the scheduler"""
        self.running = False

scheduler = PostScheduler()

def start_scheduler():
    """Start scheduler on app startup"""
    scheduler.start()
