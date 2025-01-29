import datetime
from typing import Optional
from src.agents.state import get_manager

async def broadcast_message(agent: str, message: str):
    manager = get_manager()
    if manager:
        data = {
            "type": "message",
            "agent": agent,
            "content": message,
            "timestamp": datetime.datetime.now().isoformat()
        }
        await manager.broadcast(data) 