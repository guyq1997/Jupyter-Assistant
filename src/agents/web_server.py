from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import json
from typing import List, Dict, Any, Optional
import logging
import uvicorn
import datetime
import queue
from pathlib import Path
import os
from search_notebook import NotebookSearchEngine
from state import set_manager, get_manager
from starlette.websockets import WebSocketState

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.notebook_contents: Dict[str, Any] = {}  # Store notebook content
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
            # 先从 active_connections 中移除 websocket
            if websocket in self.active_connections:
                self.active_connections.remove(websocket)
                
            # 然后清理 notebook_contents
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
        #logger.info(f"Broadcasting message to {len(self.active_connections)} clients")
        if not self.active_connections:
            logger.warning("No active connections to broadcast to")
            return
        
        async with self._lock:
            # 创建需要断开连接的列表
            disconnected = []
            for connection in self.active_connections[:]:  # 创建副本进行迭代
                try:
                    # 直接检查连接状态
                    if connection.client_state == WebSocketState.DISCONNECTED:
                        disconnected.append(connection)
                        continue
                    await connection.send_json(message)
                except WebSocketDisconnect:
                    disconnected.append(connection)
                except ConnectionResetError:
                    logger.warning(f"Connection reset detected, removing connection")
                    disconnected.append(connection)
                except Exception as e:
                    logger.error(f"Error broadcasting message: {str(e)}", exc_info=True)
                    disconnected.append(connection)
            
            # 清理断开的连接
            for conn in disconnected:
                if conn in self.active_connections:  # 再次检查以确保安全移除
                    await self.disconnect(conn)

    def get_user_input(self, prompt: str = "") -> str:
        """Get user input from the web interface"""
        self.waiting_for_input = True
        try:
            loop = asyncio.get_event_loop() if asyncio.get_event_loop_policy().get_event_loop().is_running() else asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            loop.run_until_complete(self._send_system_message(f"{prompt}\nWaiting for user input...", True))
            return self.input_queue.get()
        finally:
            self.waiting_for_input = False

    async def handle_notebook_opened(self, websocket: WebSocket, data: Dict[str, Any]):
        """Handle newly opened notebook"""
        try:
            content = data.get("content")
            logger.info(f"Received notebook_opened event with content: {bool(content)}")
            
            if not content:
                logger.error("Missing content in notebook_opened message")
                return
            
            # Parse JSON string to dict
            try:
                if isinstance(content, str):
                    content = json.loads(content)
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse notebook content: {e}")
                return
            
            # Ensure content is a valid notebook structure
            if not isinstance(content, dict) or "cells" not in content:
                logger.error("Invalid notebook format")
                return
                
            async with self._lock:
                # Store the notebook content
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
            
            # Parse JSON string to dict
            try:
                if isinstance(content, str):
                    content = json.loads(content)
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse notebook content: {e}")
                return
                
            # Validate notebook structure
            if not isinstance(content, dict) or "cells" not in content:
                logger.error("Invalid notebook format")
                return
            
            # Update in-memory notebook
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

manager = ConnectionManager()
set_manager(manager)  # Set the manager in global state

# Create a queue for user input
user_input_queue = asyncio.Queue()

async def get_user_input() -> str:
    # Wait for input from the queue
    return await user_input_queue.get()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    logger.info("New WebSocket connection request received")
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_json()
            logger.info(f"Received message: {data}")
            
            if data.get("type") == "notebook_opened":
                await manager.handle_notebook_opened(websocket, data)
            elif data.get("type") == "notebook_updated":
                await manager.handle_notebook_updated(websocket, data)
            elif data.get("type") == "user_input":
                # Add null checks and default empty strings
                selected_cells = data.get("selected_cells", "") or ""
                user_message = data.get("message", "") or ""
                
                logger.info(f"Processing user input - Message: {user_message}, Selected cells: {selected_cells}")
                await user_input_queue.put({
                    "message": user_message.strip(),
                    "selected_cells": selected_cells.strip()
                })
                # Don't broadcast user_input messages
                continue
            
            # Only broadcast non-user_input messages
            await manager.broadcast(data)
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        await manager.disconnect(websocket)


# Function to broadcast messages
async def broadcast_message(agent: str, message: str):
    data = {
        "type": "message",
        "agent": agent,
        "content": message
    }
    await manager.broadcast(data)

@app.get("/health")
async def health_check():
    """Health check endpoint to verify server is running"""
    return {"status": "healthy"}

def start_server(app: FastAPI = app):
    """Start the web server"""
    config = uvicorn.Config(app, host="0.0.0.0", port=8765, log_level="info")
    server = uvicorn.Server(config)
    return server

if __name__ == "__main__":
    logger.info("Starting WebSocket server on port 8765...")
    server = start_server()
    asyncio.run(server.serve())

# Create search engine instance
search_engine = NotebookSearchEngine(manager)

# Export the manager instance
__all__ = ['app']  # Remove manager from exports since we now use state.py