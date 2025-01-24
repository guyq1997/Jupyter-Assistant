from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import json
from typing import List, Dict, Any, Optional, Callable
import logging
import uvicorn
from pathlib import Path
import datetime
import queue
import threading
import shutil
import os
import nbformat
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

# Create uploads directory if it doesn't exist
UPLOAD_DIR = Path(__file__).parent.parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

# Mount the templates and static directories
templates_dir = Path(__file__).parent.parent / "templates"
static_dir = Path(__file__).parent.parent / "static"
app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

class NotebookWatcher(FileSystemEventHandler):
    def __init__(self, connection_manager):
        self.manager = connection_manager
        self.observer = Observer()
        self._last_modified = 0
        self._debounce_delay = 0.5  # seconds
        self._is_watching = False
        self._loop = None
        self._lock = asyncio.Lock()
        self._watched_path = None
        self._websocket = None

    def start(self, path: str, websocket: WebSocket):
        """Start watching the notebook file"""
        try:
            if self._is_watching:
                self.stop()
            
            self._watched_path = path
            self._websocket = websocket
            self.observer = Observer()
            watch_dir = os.path.dirname(path)
            self.observer.schedule(self, watch_dir, recursive=False)
            self.observer.start()
            self._is_watching = True
            self._loop = asyncio.new_event_loop()
            logger.info(f"Started watching notebook at {path} for websocket connection")
        except Exception as e:
            logger.error(f"Error starting notebook watcher: {e}")
            self._is_watching = False

    def on_modified(self, event):
        try:
            if not event.is_directory and event.src_path == self._watched_path:
                current_time = datetime.datetime.now().timestamp()
                if current_time - self._last_modified > self._debounce_delay:
                    self._last_modified = current_time
                    
                    # Create a new event loop if needed
                    if not self._loop or self._loop.is_closed():
                        self._loop = asyncio.new_event_loop()
                    
                    asyncio.set_event_loop(self._loop)
                    self._loop.run_until_complete(self._handle_modification())
                    logger.info(f"Broadcast notebook update for {event.src_path}")
        except Exception as e:
            logger.error(f"Error handling file modification: {e}")

    async def _handle_modification(self):
        """Handle file modification in an async context"""
        try:
            async with self._lock:
                # Add a small delay to ensure file is completely written
                await asyncio.sleep(0.1)
                
                # Verify file exists and is readable
                if not os.path.isfile(self._watched_path):
                    logger.error(f"Notebook file not found: {self._watched_path}")
                    return
                
                # Try to read the file multiple times if needed
                max_retries = 3
                retry_delay = 0.1
                last_error = None
                
                for attempt in range(max_retries):
                    try:
                        if self._websocket and self._websocket in self.manager.active_connections:
                            await self.manager.broadcast_notebook_update(self._watched_path, self._websocket)
                        break
                    except Exception as e:
                        last_error = e
                        if attempt < max_retries - 1:
                            await asyncio.sleep(retry_delay)
                            continue
                        raise last_error
        except Exception as e:
            logger.error(f"Error handling modification: {e}")

    def stop(self):
        """Stop watching the notebook file"""
        try:
            if self._is_watching:
                self.observer.stop()
                self.observer.join()
                self._is_watching = False
                if self._loop and not self._loop.is_closed():
                    self._loop.close()
                self._loop = None
                self._watched_path = None
                self._websocket = None
                logger.info("Stopped watching notebook")
        except Exception as e:
            logger.error(f"Error stopping notebook watcher: {e}")

# Store active connections and input callbacks
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.input_queue: queue.Queue = queue.Queue()
        self.waiting_for_input: bool = False
        self._loop = None
        self.notebook_watchers: Dict[WebSocket, NotebookWatcher] = {}  # Track watchers per connection
        self._lock = asyncio.Lock()  # Add lock for thread safety

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
        try:
            await websocket.accept()
            async with self._lock:
                self.active_connections.append(websocket)
                self.notebook_watchers[websocket] = NotebookWatcher(self)
            logger.info(f"New connection. Total connections: {len(self.active_connections)}")
            await self._send_system_message("Connected to server", websocket=websocket)
        except WebSocketDisconnect:
            await self.disconnect(websocket)
        except Exception as e:
            logger.error(f"Error accepting connection: {e}")
            try:
                await self.disconnect(websocket)
            except:
                pass

    async def disconnect(self, websocket: WebSocket):
        try:
            async with self._lock:
                if websocket in self.active_connections:
                    self.active_connections.remove(websocket)
                    if websocket in self.notebook_watchers:
                        self.notebook_watchers[websocket].stop()
                        del self.notebook_watchers[websocket]
                    logger.info(f"Connection closed. Total connections: {len(self.active_connections)}")
        except Exception as e:
            logger.error(f"Error during disconnect: {e}")

    async def broadcast(self, message: Dict[str, Any]):
        if not self.active_connections:
            logger.warning("No active connections to broadcast to")
            return
        
        async with self._lock:
            disconnected = []
            for connection in self.active_connections:
                try:
                    await connection.send_json(message)
                except WebSocketDisconnect:
                    disconnected.append(connection)
                except ConnectionResetError:
                    logger.warning(f"Connection reset detected, removing connection")
                    disconnected.append(connection)
                except Exception as e:
                    logger.error(f"Error sending message: {e}")
                    disconnected.append(connection)
            
            # Clean up disconnected connections
            for conn in disconnected:
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

    async def process_notebook(self, notebook_path: str) -> Dict:
        """Helper method to process notebook content"""
        try:
            with open(notebook_path, 'r', encoding='utf-8') as f:
                nb = nbformat.read(f, as_version=4)
            
            return {
                'cells': [{
                    'cell_type': cell.cell_type,
                    'source': cell.source,
                    'metadata': cell.metadata
                } for cell in nb.cells]
            }
        except Exception as e:
            logger.error(f"Error processing notebook {notebook_path}: {e}")
            raise

    async def broadcast_notebook_update(self, notebook_path: str, target_websocket: WebSocket):
        """Broadcast notebook content to specific client"""
        try:
            if not os.path.isfile(notebook_path):
                logger.error(f"Notebook file not found: {notebook_path}")
                return
                
            max_retries = 3
            retry_delay = 0.1
            last_error = None
            
            for attempt in range(max_retries):
                try:
                    notebook_data = await self.process_notebook(notebook_path)
                    break
                except Exception as e:
                    last_error = e
                    if attempt < max_retries - 1:
                        await asyncio.sleep(retry_delay)
                        continue
                    raise last_error
            
            await target_websocket.send_json({
                "type": "notebook_update",
                "content": notebook_data,
                "notebook_path": notebook_path,
                "timestamp": datetime.datetime.now().isoformat()
            })
            
            logger.info(f"Successfully sent notebook update for {notebook_path}")
        except Exception as e:
            logger.error(f"Error sending notebook update: {e}")
            await self._send_system_message(f"Error updating notebook: {str(e)}", websocket=target_websocket)

    def set_notebook_watcher(self, websocket: WebSocket, notebook_path: str):
        """Set notebook watcher for specific connection"""
        try:
            if websocket in self.notebook_watchers:
                watcher = self.notebook_watchers[websocket]
                if watcher._is_watching:
                    watcher.stop()
                watcher.start(notebook_path, websocket)
                logger.info(f"Started watching notebook {notebook_path} for connection")
        except Exception as e:
            logger.error(f"Error setting notebook watcher: {e}")

manager = ConnectionManager()

@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    """Handle notebook file upload"""
    try:
        if not file.filename.endswith('.ipynb'):
            return JSONResponse(
                status_code=400,
                content={"error": "Only Jupyter notebooks (.ipynb) are allowed"}
            )
        
        filename_base = os.path.splitext(file.filename)[0]
        copy_filename = f"{filename_base}_copy.ipynb"
        file_path = UPLOAD_DIR / copy_filename
        # Export the file path for other scripts to use
        os.environ['CURRENT_NOTEBOOK_PATH'] = str('src/uploads/' + copy_filename)
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        try:
            notebook_content = await manager.process_notebook(str(file_path))
        except Exception as e:
            logger.error(f"Error reading notebook: {e}")
            notebook_content = None
        
        return JSONResponse(content={
            "message": "File uploaded successfully. Working on a copy of the notebook.",
            "filename": copy_filename,
            "notebook_content": notebook_content
        })
    except Exception as e:
        logger.error(f"Upload error: {e}")
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.get("/")
async def get():
    """Serve the HTML page"""
    with open(templates_dir / "index.html", 'r', encoding='utf-8') as f:
        return HTMLResponse(content=f.read())

@app.get("/download/{filename}")
async def download_notebook(filename: str):
    """Handle notebook download"""
    try:
        file_path = UPLOAD_DIR / filename
        if not file_path.exists():
            return JSONResponse(
                status_code=404,
                content={"error": "Notebook file not found"}
            )
        
        return FileResponse(
            path=file_path,
            filename=filename,
            media_type='application/x-ipynb+json'
        )
    except Exception as e:
        logger.error(f"Download error: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": str(e)}
        )

# Create a queue for user input
user_input_queue = asyncio.Queue()

async def get_user_input() -> str:
    # Wait for input from the queue
    return await user_input_queue.get()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """Handle WebSocket connections"""
    await manager.connect(websocket)
    try:
        while True:
            message = await websocket.receive_text()
            data = json.loads(message)
            
            if data.get("type") == "user_input":
                selected_cells_content = data.get("selected_cells_content", "").strip()
                user_message = data.get("user_message", "").strip()
                if user_message.startswith("analyze notebook"):
                    notebook_path = data.get("notebook_path")
                    if notebook_path:
                        await user_input_queue.put({
                            "message": f"Please analyze the notebook at {notebook_path}",
                            "selected_cells": selected_cells_content
                        })
                    else:
                        await manager._send_system_message("No notebook is currently loaded. Please upload one first.", websocket=websocket)
                else:
                    await user_input_queue.put({
                        "message": user_message,
                        "selected_cells": selected_cells_content
                    })
            
            elif data.get("type") == "start_processing":
                filename = data.get("filename")
                if filename:
                    notebook_path = UPLOAD_DIR / filename
                    if notebook_path.exists():
                        manager.set_notebook_watcher(websocket, str(notebook_path))
                        await manager.broadcast_notebook_update(str(notebook_path), websocket)
                    else:
                        await manager._send_system_message(f"Notebook file not found: {filename}", websocket=websocket)

            elif data.get("type") == "save_notebook":
                notebook_path = data.get("notebook_path")
                if not notebook_path:
                    await manager._send_system_message("No notebook path provided.", websocket=websocket)
                    continue

                try:
                    notebook_data = data.get("content")
                    if not notebook_data:
                        raise ValueError("No notebook content provided")

                    nb = nbformat.v4.new_notebook()
                    for cell_data in notebook_data.get("cells", []):
                        cell = (nbformat.v4.new_code_cell if cell_data["cell_type"] == "code" 
                               else nbformat.v4.new_markdown_cell)(
                            source=cell_data["source"],
                            metadata=cell_data.get("metadata", {})
                        )
                        nb.cells.append(cell)

                    with open(notebook_path, "w", encoding="utf-8") as f:
                        nbformat.write(nb, f)

                    await manager._send_system_message("Notebook saved successfully", websocket=websocket)
                    
                    # Ensure watcher is active after save
                    manager.set_notebook_watcher(websocket, notebook_path)
                except Exception as e:
                    logger.error(f"Error saving notebook: {e}")
                    await manager._send_system_message(f"Error saving notebook: {str(e)}", websocket=websocket)
    except WebSocketDisconnect:
        await manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        await manager.disconnect(websocket)

# Function to broadcast messages
async def broadcast_message(agent: str, message: str):
    data = {
        "type": "message",
        "agent": agent,
        "content": message
    }
    await manager.broadcast(data)

async def broadcast_notebook_update(cells: List[Dict]):
    data = {
        "type": "notebook_update",
        "cells": cells
    }
    await manager.broadcast(data)

def start_server(app: FastAPI = app):
    """Start the web server"""
    config = uvicorn.Config(app, host="127.0.0.1", port=8765, log_level="info")
    server = uvicorn.Server(config)
    return server

if __name__ == "__main__":
    server = start_server()
    asyncio.run(server.serve())