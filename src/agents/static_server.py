from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

def setup_static_files(app: FastAPI):
    # Get the static files directory from environment variable or use default
    static_dir = os.getenv('STATIC_FILES_DIR', 'frontend/build')
    
    # Ensure the directory exists
    if not os.path.exists(static_dir):
        os.makedirs(static_dir, exist_ok=True)
    
    # Mount the entire build directory at root
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")
    
    # Serve index.html for client-side routing paths
    @app.get("/{full_path:path}")
    async def serve_spa(request: Request, full_path: str):
        # Don't handle WebSocket connections
        if request.scope["type"] == "websocket":
            return None
            
        # Don't handle API routes
        if full_path.startswith("api/"):
            return None
            
        # Try to serve the exact file if it exists
        static_file = os.path.join(static_dir, full_path)
        if os.path.exists(static_file) and os.path.isfile(static_file):
            return FileResponse(static_file)
            
        # For all other routes, serve index.html
        index_file = os.path.join(static_dir, 'index.html')
        if os.path.exists(index_file):
            return FileResponse(index_file)
        else:
            raise FileNotFoundError(f"index.html not found in {static_dir}") 