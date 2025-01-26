"""Tools configuration and implementation for the agent."""
import json
from typing import Annotated, Optional, Dict, Any, Union, List
from dataclasses import dataclass
from autogen_core.tools import FunctionTool
from nbformat.v4 import new_notebook, new_markdown_cell, new_code_cell
import nbformat
import asyncio
import time
from duckduckgo_search import DDGS
from openai import AsyncOpenAI
from transformers import pipeline
import numpy as np
from search_notebook import (
    get_search_engine,
    format_search_results,
    NotebookCell,
    SearchResult,
    NotebookSearchEngine
)
from search_engine import search_with_retry
from screenshot_utils import take_screenshot, take_screenshot_sync
from web_scraper import process_urls, validate_url

@dataclass
class NotebookEditResult:
    success: bool
    message: str
    cell_content: Optional[str] = None
    
    def __str__(self) -> str:
        """Convert the result to a natural language string."""
        if self.success:
            return self.message + (f"\nContent: {self.cell_content}" if self.cell_content else "")
        else:
            return f"Error: {self.message}"

def load_notebook(notebook_path: str) -> nbformat.NotebookNode:
    """Load a notebook from file or create a new one if it doesn't exist."""
    try:
        with open(notebook_path, 'r', encoding='utf-8') as f:
            return nbformat.read(f, as_version=4)
    except FileNotFoundError:
        return new_notebook()

def get_ten_cells(notebook_path: str, cell_indices: List[int]) -> str:
    """Get the content of ten cells in the notebook in a well-structured format.
    Returns a string with each cell's content prefixed by its index and type.
    """
    notebook = load_notebook(notebook_path)
    formatted_cells = []
    
    for idx, cell in enumerate(notebook.cells):
        #cell_header = f"\n[Cell {idx} - {cell.cell_type}]"
        cell_content = cell.source.strip()
        if cell_content:
            formatted_cells.append(f"<{cell.cell_type}>\n{cell_content}\n</{cell.cell_type}>")
        else:
            formatted_cells.append(f"<empty cell>")
            
    return "\n".join(formatted_cells)

def save_notebook(notebook: nbformat.NotebookNode, notebook_path: str) -> None:
    """Save the notebook to file."""
    with open(notebook_path, 'w', encoding='utf-8') as f:
        nbformat.write(notebook, f)

def clear_notebook_output(notebook_path: str) -> None:
    """Clear all output of the Jupyter Notebook to make it clean."""
    notebook = load_notebook(notebook_path)
    for cell in notebook.cells:
        if cell.cell_type == 'code':
            cell.outputs = []
            cell.execution_count = None
    save_notebook(notebook, notebook_path)

async def propose_notebook_change(notebook_path: str, changes: List[Dict[str, Any]]) -> None:
    """Send proposed changes to the client through WebSocket."""
    from web_server import manager
    
    try:
        data = {
            "type": "propose_changes",
            "changes": changes,
            "notebook_path": notebook_path
        }
        await manager.broadcast(data)
        return NotebookEditResult(
            success=True,
            message="Changes proposed successfully. User will decide if they want to apply them."
        )
    except Exception as e:
        return NotebookEditResult(
            success=False,
            message=f"Failed to propose changes: {str(e)}"
        )

async def update_cell(
    notebook_path: Annotated[str, "Path to the notebook file"],
    cell_index: Annotated[int, "Index of the cell to update"],
    content: Annotated[str, "New content for the cell"],
    cell_type: Annotated[str, "Type of cell ('markdown' or 'code')"] = 'markdown'
) -> str:
    """Propose an update to a cell's content at the specified index."""
    try:
        notebook = load_notebook(notebook_path)
        
        if cell_index >= len(notebook.cells):
            return str(NotebookEditResult(
                success=False,
                message=f"Cell index {cell_index} out of range"
            ))
        
        old_content = notebook.cells[cell_index].source
        
        changes = [{
            "type": "update",
            "index": cell_index,
            "old_content": old_content,
            "new_content": content,
            "cell_type": cell_type
        }]
        
        result = await propose_notebook_change(notebook_path, changes)
        return str(result)
        
    except Exception as e:
        return str(NotebookEditResult(
            success=False,
            message=f"Failed to propose cell update: {str(e)}"
        ))

async def insert_cell_below(
    notebook_path: Annotated[str, "Path to the notebook file"],
    index: Annotated[int, "Index where to insert the cell"],
    content: Annotated[str, "Content for the new cell"],
    cell_type: Annotated[str, "Type of cell ('markdown' or 'code')"] = 'markdown'
) -> str:
    """Propose inserting a new cell below the specified index."""
    try:
        notebook = load_notebook(notebook_path)
        
        changes = [{
            "type": "add",
            "index": index + 1,
            "old_content": None,
            "new_content": content,
            "cell_type": cell_type
        }]
        
        result = await propose_notebook_change(notebook_path, changes)
        return str(result)
        
    except Exception as e:
        return str(NotebookEditResult(
            success=False,
            message=f"Failed to propose cell insertion: {str(e)}"
        ))

async def insert_cell_above(
    notebook_path: Annotated[str, "Path to the notebook file"],
    index: Annotated[int, "Index where to insert the cell"],
    content: Annotated[str, "Content for the new cell"],
    cell_type: Annotated[str, "Type of cell ('markdown' or 'code')"] = 'markdown'
) -> str:
    """Propose inserting a new cell above the specified index."""
    try:
        notebook = load_notebook(notebook_path)
        
        changes = [{
            "type": "add",
            "index": index,
            "old_content": None,
            "new_content": content,
            "cell_type": cell_type
        }]
        
        result = await propose_notebook_change(notebook_path, changes)
        return str(result)
        
    except Exception as e:
        return str(NotebookEditResult(
            success=False,
            message=f"Failed to propose cell insertion: {str(e)}"
        ))

async def delete_cell(
    notebook_path: Annotated[str, "Path to the notebook file"],
    index: Annotated[int, "Index of the cell to delete"]
) -> str:
    """Propose deleting a cell at the specified index."""
    try:
        notebook = load_notebook(notebook_path)
        
        if 0 <= index < len(notebook.cells):
            old_content = notebook.cells[index].source
            cell_type = notebook.cells[index].cell_type
            
            changes = [{
                "type": "delete",
                "index": index,
                "old_content": old_content,
                "new_content": None,
                "cell_type": cell_type
            }]
            
            result = await propose_notebook_change(notebook_path, changes)
            return str(result)
        else:
            return str(NotebookEditResult(
                success=False,
                message=f"Cell index {index} out of range"
            ))
            
    except Exception as e:
        return str(NotebookEditResult(
            success=False,
            message=f"Failed to propose cell deletion: {str(e)}"
        ))

async def get_cell_content(
    notebook_path: Annotated[str, "Path to the notebook file"],
    index: Annotated[int, "Index of the cell to retrieve"]
) -> str:
    """search the content of a cell at the specified index."""
    try:
        notebook = load_notebook(notebook_path)
        if 0 <= index < len(notebook.cells):
            content = notebook.cells[index].source
            result = NotebookEditResult(
                success=True,
                message=f"Successfully retrieved cell content",
                cell_content=content
            )
        else:
            result = NotebookEditResult(
                success=False,
                message=f"Cell index {index} out of range"
            )
    except Exception as e:
        result = NotebookEditResult(
            success=False,
            message=f"Failed to get cell content: {str(e)}"
        )
    return str(result)

def get_weather(location):
    return "Failed to get weather"



async def search_notebook(
    notebook_path: Annotated[str, "Path to the notebook file"],
    query: Annotated[str, "Search query text"],
    keywords: Annotated[Optional[List[str]], "List of keywords for keyword search"],
    top_k: Annotated[int, "Maximum number of results to return"] = 10,
    min_score: Annotated[float, "Minimum similarity score"] = 0.3,
    match_all: Annotated[bool, "For keyword search: whether to require all keywords to match"] = False
) -> str:
    """Search within a Jupyter notebook using semantic search or keyword matching. Return matching cells with their content."""
    try:
        search_engine = get_search_engine()
        search_engine.index_notebook(notebook_path)
        
        results_semantic = search_engine.search(query, top_k, min_score)
        
        results_keywords = search_engine.keyword_search(keywords, match_all)
        

        return await format_search_results(results_semantic + results_keywords )
        
    except Exception as e:
        return f"Error searching notebook: {str(e)}"

async def scrape_websites(
    urls: Annotated[List[str], "List of URLs to scrape"],
    max_concurrent: Annotated[int, "Maximum number of concurrent browser instances"] = 5
) -> str:
    """Scrape content from multiple websites concurrently and return formatted text content."""
    try:
        # Validate URLs
        valid_urls = [url for url in urls if validate_url(url)]
        if not valid_urls:
            return "Error: No valid URLs provided"
            
        # Process URLs and get results
        results = await process_urls(valid_urls, max_concurrent)
        
        # Format output
        formatted_output = []
        for url, text in zip(valid_urls, results):
            formatted_output.append(f"\n=== Content from {url} ===\n{text}\n{'=' * 80}")
            
        return "\n".join(formatted_output)
        
    except Exception as e:
        return f"Error during web scraping: {str(e)}"

async def take_webpage_screenshot(
    url: Annotated[str, "The URL to take a screenshot of"],
    output_path: Annotated[Optional[str], "Path to save the screenshot. If None, saves to a temporary file"] = None,
    width: Annotated[int, "Viewport width"] = 1280,
    height: Annotated[int, "Viewport height"] = 720
) -> str:
    """Take a screenshot of a webpage using Playwright and return the path to the saved image."""
    try:
        result = await take_screenshot(url, output_path, width, height)
        return f"Screenshot saved successfully to: {result}"
    except Exception as e:
        return f"Error taking screenshot: {str(e)}"

def take_webpage_screenshot_sync(
    url: Annotated[str, "The URL to take a screenshot of"],
    output_path: Annotated[Optional[str], "Path to save the screenshot. If None, saves to a temporary file"] = None,
    width: Annotated[int, "Viewport width"] = 1280,
    height: Annotated[int, "Viewport height"] = 720
) -> str:
    """Take a screenshot of a webpage synchronously using Playwright and return the path to the saved image."""
    try:
        result = take_screenshot_sync(url, output_path, width, height)
        return f"Screenshot saved successfully to: {result}"
    except Exception as e:
        return f"Error taking screenshot: {str(e)}"

tools = [{
    "type": "function",
    "function": {
        "name": "update_cell",
        "description": "Update a cell's content at the specified index in a Jupyter notebook.",
        "parameters": {
            "type": "object",
            "properties": {
                "notebook_path": {"type": "string", "description": "Path to the notebook file"},
                "cell_index": {"type": "integer", "description": "Index of the cell to update"},
                "content": {"type": "string", "description": "New content for the cell"},
                "cell_type": {"type": "string", "enum": ["markdown", "code"], "description": "Type of cell ('markdown' or 'code')"}
            },
            "required": ["notebook_path", "cell_index", "content", "cell_type"],
            "additionalProperties": False
        },
        "strict": True
    }
}, {
    "type": "function",
    "function": {
        "name": "insert_cell_below",
        "description": "Insert a new cell below the specified index in a Jupyter notebook.",
        "parameters": {
            "type": "object",
            "properties": {
                "notebook_path": {"type": "string", "description": "Path to the notebook file"},
                "index": {"type": "integer", "description": "Index where to insert a new cell below"},
                "content": {"type": "string", "description": "Content for the new cell"},
                "cell_type": {"type": "string", "enum": ["markdown", "code"], "description": "Type of cell ('markdown' or 'code')"}
            },
            "required": ["notebook_path", "index", "content", "cell_type"],
            "additionalProperties": False
        },
        "strict": True
    }
}, {
    "type": "function",
    "function": {
        "name": "insert_cell_above",
        "description": "Insert a new cell above the specified index in a Jupyter notebook.",
        "parameters": {
            "type": "object",
            "properties": {
                "notebook_path": {"type": "string", "description": "Path to the notebook file"},
                "index": {"type": "integer", "description": "Index where to insert a new cell above"},
                "content": {"type": "string", "description": "Content for the new cell"},
                "cell_type": {"type": "string", "enum": ["markdown", "code"], "description": "Type of cell ('markdown' or 'code')"}
            },
            "required": ["notebook_path", "index", "content", "cell_type"],
            "additionalProperties": False
        },
        "strict": True
    }
}, {
    "type": "function",
    "function": {
        "name": "delete_cell",
        "description": "Delete a cell at the specified index in a Jupyter notebook.",
        "parameters": {
            "type": "object",
            "properties": {
                "notebook_path": {"type": "string", "description": "Path to the notebook file"},
                "index": {"type": "integer", "description": "Index of the cell to delete"}
            },
            "required": ["notebook_path", "index"],
            "additionalProperties": False
        },
        "strict": True
    }
}, {
    "type": "function",
    "function": {
        "name": "get_cell_content",
        "description": "Get the content of a cell at the specified index in a Jupyter notebook.",
        "parameters": {
            "type": "object",
            "properties": {
                "notebook_path": {"type": "string", "description": "Path to the notebook file"},
                "index": {"type": "integer", "description": "Index of the cell to retrieve"}
            },
            "required": ["notebook_path", "index"],
            "additionalProperties": False
        },
        "strict": True
    }
}, {
    "type": "function", 
    "function": {
        "name": "get_ten_cells",
        "description": "Get the content of ten cells in the notebook in a well-structured format.",
        "parameters": {
            "type": "object",
            "properties": {
                "notebook_path": {"type": "string", "description": "Path to the notebook file"},
                "cell_indices": {"type": "array", "items": {"type": "integer"}, "description": "List of cell indices to retrieve"}
            },
            "required": ["notebook_path", "cell_indices"],
            "additionalProperties": False
        },
        "strict": True
    }
}, 
   {
    "type": "function",
    "function": {
        "name": "clear_notebook_output",
        "description": "Clear all output cells in a Jupyter notebook.",
        "parameters": {
            "type": "object",
            "properties": {
                "notebook_path": {"type": "string", "description": "Path to the notebook file"}
            },
            "required": ["notebook_path"],
            "additionalProperties": False
        },
        "strict": True
    }
}, {
    "type": "function",
    "function": {
        "name": "search_with_retry",
        "description": "Search the web using DuckDuckGo and return formatted results with URLs and snippets.",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Search query"
                },
                "max_results": {
                    "type": "integer",
                    "description": "Maximum number of results to return"
                },
                "max_retries": {
                    "type": "integer",
                    "description": "Maximum number of retry attempts"
                }
            },
            "required": ["query", "max_results", "max_retries"],
            "additionalProperties": False
        },
        "strict": True
    }
}, {
    "type": "function",
    "function": {
        "name": "search_notebook",
        "description": "Search within a Jupyter notebook using semantic search or keyword matching",
        "parameters": {
            "type": "object",
            "properties": {
                "notebook_path": {
                    "type": "string",
                    "description": "Path to the notebook file"
                },
                "query": {
                    "type": "string",
                    "description": "Query text used semantic search"
                },
                "keywords": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List of keywords for keyword search"
                }
            },
            "required": [
                "notebook_path",
                "query",
                "keywords"
            ],
            "additionalProperties": False
        },
        "strict": True
    }
}, {
    "type": "function",
    "function": {
        "name": "take_webpage_screenshot",
        "description": "Take a screenshot of a webpage using Playwright and return the path to the saved image",
        "parameters": {
            "type": "object",
            "properties": {
                "url": {
                    "type": "string",
                    "description": "The URL to take a screenshot of"
                },
                "output_path": {
                    "type": "string",
                    "description": "Path to save the screenshot. If None, saves to a temporary file."
                },
                "width": {
                    "type": "integer",
                    "description": "Viewport width. Defaults to 1280."
                },
                "height": {
                    "type": "integer",
                    "description": "Viewport height. Defaults to 720."
                }
            },
            "required": ["url", "output_path", "width", "height"],
            "additionalProperties": False
        },
        "strict": True
    }
}, {
    "type": "function",
    "function": {
        "name": "take_webpage_screenshot_sync",
        "description": "Take a screenshot of a webpage synchronously using Playwright and return the path to the saved image",
        "parameters": {
            "type": "object",
            "properties": {
                "url": {
                    "type": "string",
                    "description": "The URL to take a screenshot of"
                },
                "output_path": {
                    "type": "string",
                    "description": "Path to save the screenshot. If None, saves to a temporary file."
                },
                "width": {
                    "type": "integer",
                    "description": "Viewport width. Defaults to 1280."
                },
                "height": {
                    "type": "integer",
                    "description": "Viewport height. Defaults to 720."
                }
            },
            "required": ["url", "output_path", "width", "height"],
            "additionalProperties": False
        },
        "strict": True
    }
}, {
    "type": "function",
    "function": {
        "name": "scrape_websites",
        "description": "Scrape content from multiple websites concurrently and return formatted text content",
        "parameters": {
            "type": "object",
            "properties": {
                "urls": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List of URLs to scrape"
                },
                "max_concurrent": {
                    "type": "integer",
                    "description": "Maximum number of concurrent browser instances. Defaults to 5."
                }
            },
            "required": ["urls", "max_concurrent"],
            "additionalProperties": False
        },
        "strict": True
    }
}]

async def call_function(name, args):
    """Call a function by name with the given arguments.
    
    Args:
        name (str): Name of the function to call
        args (Union[str, dict]): Arguments for the function, either as JSON string or dict
    
    Returns:
        str: Result of the function call
    """
    # Parse JSON string if args is a string
    if isinstance(args, str):
        try:
            args = json.loads(args)
        except json.JSONDecodeError:
            return f"Error: Invalid JSON arguments - {args}"
    
    try:
        # Map function names to their implementations
        function_map = {
            "update_cell": update_cell,
            "insert_cell_below": insert_cell_below,
            "insert_cell_above": insert_cell_above,
            "delete_cell": delete_cell,
            "get_cell_content": get_cell_content,
            "get_ten_cells": get_ten_cells,
            "clear_notebook_output": clear_notebook_output,
            "search_with_retry": search_with_retry,
            "search_notebook": search_notebook,
            "take_webpage_screenshot": take_webpage_screenshot,
            "take_webpage_screenshot_sync": take_webpage_screenshot_sync,
            "scrape_websites": scrape_websites
        }
        
        if name not in function_map:
            return f"Error: Unknown function {name}"
            
        func = function_map[name]
        
        # Call async functions with await, regular functions directly
        if asyncio.iscoroutinefunction(func):
            result = await func(**args)
        else:
            result = func(**args)
            
        return result
        
    except TypeError as e:
        return f"Error: Invalid arguments for {name} - {str(e)}"
    except Exception as e:
        return f"Error: Function {name} failed - {str(e)}" 