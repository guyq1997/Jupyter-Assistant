from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
import asyncio
import json
from typing import List, Dict, Any, Optional
import logging
import datetime
import queue
from starlette.websockets import WebSocketState

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.notebook_contents: Dict[str, Any] = {}
        self.input_queue: queue.Queue = queue.Queue()
        self.waiting_for_input: bool = False
        self._lock = asyncio.Lock()
        self.readonly = True

    async def _send_system_message(self, content: str, waiting_input: bool = False, websocket: Optional[WebSocket] = None):
        """Helper method to send system messages"""
        try:
            message = {
                "type": "message",
                "agent": "System",
                "content": content,
                "timestamp": datetime.datetime.now().isoformat(),
                "waiting_input": waiting_input
            }
            if websocket:
                await websocket.send_json(message)
            else:
                await self.broadcast(message)
        except Exception as e:
            logger.error(f"Error sending system message: {e}")

    async def connect(self, websocket: WebSocket):
        logger.info("New client attempting to connect")
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"Client connected. Total connections: {len(self.active_connections)}")
        await self._send_system_message("Connected to server", websocket=websocket)

    async def disconnect(self, websocket: WebSocket):
        try:
            if websocket in self.active_connections:
                self.active_connections.remove(websocket)
                
            to_remove = []
            for path, info in self.notebook_contents.items():
                if isinstance(info, dict) and info.get('websocket') == websocket:
                    to_remove.append(path)
            
            for path in to_remove:
                del self.notebook_contents[path]
                
            logger.info(f"Client disconnected. Remaining connections: {len(self.active_connections)}")
        except Exception as e:
            logger.error(f"Error during disconnect: {str(e)}", exc_info=True)

    async def broadcast(self, message: Dict[str, Any]):
        if not self.active_connections:
            logger.warning("No active connections to broadcast to")
            return
        
        async with self._lock:
            disconnected = []
            for connection in self.active_connections[:]:
                try:
                    if connection.client_state == WebSocketState.DISCONNECTED:
                        disconnected.append(connection)
                        continue
                    await connection.send_json(message)
                    logger.debug(f"Successfully sent message to connection")
                except (WebSocketDisconnect, ConnectionResetError):
                    logger.warning("Connection lost while broadcasting")
                    disconnected.append(connection)
                except Exception as e:
                    logger.error(f"Error broadcasting message: {str(e)}", exc_info=True)
                    disconnected.append(connection)
            
            for conn in disconnected:
                if conn in self.active_connections:
                    await self.disconnect(conn)

    async def handle_notebook_opened(self, websocket: WebSocket, data: Dict[str, Any]):
        """Handle newly opened notebook"""
        try:
            content = data.get("content")
            logger.info(f"Received notebook_opened event with content: {bool(content)}")
            
            if not content:
                logger.error("Missing content in notebook_opened message")
                return
            
            try:
                if isinstance(content, str):
                    content = json.loads(content)
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse notebook content: {e}")
                return
            
            if not isinstance(content, dict) or "cells" not in content:
                logger.error("Invalid notebook format")
                return
                
            async with self._lock:
                self.notebook_contents = content
                logger.info(f"Notebook loaded with {len(content.get('cells', []))} cells")
                logger.info(f"First cell content: {content.get('cells', [])[0] if content.get('cells') else 'No cells'}")
            
        except Exception as e:
            logger.error(f"Error handling notebook opened: {e}")
            await self._send_system_message(
                f"Error handling notebook: {str(e)}",
                websocket=websocket
            )

    async def handle_notebook_updated(self, websocket: WebSocket, data: Dict[str, Any]):
        """Handle notebook content updates from frontend."""
        try:
            content = data.get("content")
            logger.info(f"Received notebook_updated event with content: {bool(content)}")
            
            if content is None:
                logger.error("Missing content in notebook_updated message")
                return
            
            try:
                if isinstance(content, str):
                    content = json.loads(content)
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse notebook content: {e}")
                return
                
            if not isinstance(content, dict) or "cells" not in content:
                logger.error("Invalid notebook format")
                return
            
            self.notebook_contents = content
            logger.info(f"Updated notebook with {len(content.get('cells', []))} cells")
            logger.info(f"First cell content: {content.get('cells', [])[0] if content.get('cells') else 'No cells'}")
            
        except Exception as e:
            logger.error(f"Error handling notebook update: {e}")
            await self._send_system_message(
                f"Error updating notebook: {str(e)}",
                websocket=websocket
            )

    def get_notebook_content(self) -> Dict[str, Any]:
        """Direct access to notebook content"""
        if not self.notebook_contents:
            logger.warning("Attempting to access notebook content when none is loaded")
        return self.notebook_contents

