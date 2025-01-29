from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import asyncio
import uvicorn
import datetime
from pathlib import Path
from search_notebook import NotebookSearchEngine
from state import set_manager, get_manager
from agent import Agent
from web_server import ConnectionManager
from utils import broadcast_message
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["localhost:8765"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize manager and set it in global state
manager = ConnectionManager()
set_manager(manager)

# Create search engine instance
search_engine = NotebookSearchEngine(manager)

# Initialize agent
agent = Agent()

# User input queue
user_input_queue = asyncio.Queue()

async def get_user_input() -> str:
    return await user_input_queue.get()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    logger.info("New WebSocket connection request received")
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_json()
            if data.get("type") in ["notebook_opened", "notebook_updated"]:
                logger.info(f"Received message: {data.get('type')}  First 50 characters: {data.get('content')[:50]}")
            else:
                logger.info(f"Received message: {data.get('type')}")
            if data.get("type") == "notebook_opened":
                await manager.handle_notebook_opened(websocket, data)
            elif data.get("type") == "notebook_updated":
                await manager.handle_notebook_updated(websocket, data)
            elif data.get("type") == "user_input":
                selected_cells = data.get("selected_cells", "") or ""
                user_message = data.get("message", "") or ""
                
                logger.info(f"Processing user input - Message: {user_message}, Selected cells: {selected_cells}")
                await user_input_queue.put({
                    "message": user_message.strip(),
                    "selected_cells": selected_cells.strip()
                })
                continue
            
            await manager.broadcast(data)
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        await manager.disconnect(websocket)

@app.get("/health")
async def health_check():
    """Health check endpoint to verify server is running"""
    return {"status": "healthy"}

# Mount static files from frontend/build
frontend_path = Path(__file__).parent.parent.parent / "frontend" / "build"
if not frontend_path.exists():
    logger.error(f"Frontend build directory not found at {frontend_path}")
    raise FileNotFoundError(f"Frontend build directory not found at {frontend_path}")
logger.info(f"Mounting frontend from {frontend_path}")
app.mount("/", StaticFiles(directory=str(frontend_path), html=True), name="static")

async def main():
    port = 8765
    max_retries = 5
    
    print("\nStarting unified server...")
    logger.info("Initializing server components...")
    
    for attempt in range(max_retries):
        try:
            logger.info(f"Attempting to start server on port {port} (attempt {attempt + 1}/{max_retries})")
            config = uvicorn.Config(
                app, 
                host="localhost", 
                port=port, 
                log_level="info",
                log_config={
                    "version": 1,
                    "disable_existing_loggers": False,
                    "formatters": {
                        "default": {
                            "format": "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
                        }
                    },
                    "handlers": {
                        "default": {
                            "formatter": "default",
                            "class": "logging.StreamHandler",
                            "stream": "ext://sys.stderr"
                        }
                    },
                    "loggers": {
                        "uvicorn": {"handlers": ["default"], "level": "INFO"},
                        "uvicorn.error": {"level": "INFO"},
                        "uvicorn.access": {"handlers": ["default"], "level": "INFO"},
                    }
                }
            )
            server = uvicorn.Server(config)
            
            print(f"\nStarting server on http://localhost:{port}")
            print(f"WebSocket endpoint available at ws://localhost:{port}/ws")
            logger.info("Server configuration complete, starting server...")
            
            server_task = asyncio.create_task(server.serve())
            await asyncio.sleep(2)
            
            if not server_task.done():
                logger.info("Server started successfully")
                print("\nServer started successfully")
                print("Server is ready and waiting for connections...")
                await broadcast_message("System", "Ready to process queries.")
                
                try:
                    while True:
                        try:
                            user_input = await get_user_input()
                            logger.info(f"Processing input: {user_input}")
                            await broadcast_message("System", "Processing your request...")
                            result = await agent.process_query(user_input)
                            await broadcast_message("System", "Query processing complete")
                        except Exception as e:
                            logger.error(f"Error during conversation: {e}")
                            print(f"Error during conversation: {e}")
                            await broadcast_message("System", f"Error: {e}")
                            continue
                finally:
                    if server:
                        logger.info("Shutting down server...")
                        await server.shutdown()
                
                break
            else:
                logger.error("Server failed to start properly")
                raise Exception("Server failed to start properly")
            
        except Exception as e:
            if "address already in use" in str(e).lower():
                logger.warning(f"Port {port} is in use, trying next port...")
                print(f"Port {port} is in use, trying next port...")
                port += 1
                if attempt == max_retries - 1:
                    logger.error("Could not find an available port")
                    print("Could not find an available port")
                    return
            else:
                logger.error(f"Unexpected error: {e}")
                print(f"Unexpected error: {e}")
                raise

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nShutting down gracefully...")
    except SystemExit:
        print("\nServer shutdown requested...")
    except Exception as e:
        print(f"Unexpected error: {e}") 