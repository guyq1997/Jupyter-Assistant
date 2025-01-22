"""Tools configuration and implementation for the agent."""
import json
from typing import Annotated, Optional, Dict, Any, Union
from dataclasses import dataclass
from autogen_core.tools import FunctionTool
from nbformat.v4 import new_notebook, new_markdown_cell, new_code_cell
import nbformat
import asyncio

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

def notebook_content(notebook_path: str) -> str:
    """Get the content of the notebook in a well-structured format.
    Returns a string with each cell's content prefixed by its index and type.
    """
    notebook = load_notebook(notebook_path)
    formatted_cells = []
    
    for idx, cell in enumerate(notebook.cells):
        cell_header = f"\n[Cell {idx} - {cell.cell_type}]"
        cell_content = cell.source.strip()
        if cell_content:
            formatted_cells.append(f"{cell_header}\n{cell_content}")
        else:
            formatted_cells.append(f"{cell_header}\n<empty cell>")
            
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

async def update_cell(
    notebook_path: Annotated[str, "Path to the notebook file"],
    cell_index: Annotated[int, "Index of the cell to update"],
    content: Annotated[str, "New content for the cell"],
    cell_type: Annotated[str, "Type of cell ('markdown' or 'code')"] = 'markdown'
) -> str:
    """Update a cell's content at the specified index."""
    try:
        notebook = load_notebook(notebook_path)
        
        if cell_index >= len(notebook.cells):
            # Extend notebook if needed
            while len(notebook.cells) <= cell_index:
                notebook.cells.append(new_markdown_cell(''))
        
        new_cell = new_markdown_cell(content) if cell_type == 'markdown' else new_code_cell(content)
        notebook.cells[cell_index] = new_cell
        save_notebook(notebook, notebook_path)
        
        result = NotebookEditResult(
            success=True,
            message=f"Successfully updated {cell_type} cell at index {cell_index}",
            cell_content=content
        )
    except Exception as e:
        result = NotebookEditResult(
            success=False,
            message=f"Failed to update cell: {str(e)}"
        )
    return str(result)

async def insert_cell(
    notebook_path: Annotated[str, "Path to the notebook file"],
    index: Annotated[int, "Index where to insert the cell"],
    content: Annotated[str, "Content for the new cell"],
    cell_type: Annotated[str, "Type of cell ('markdown' or 'code')"] = 'markdown'
) -> str:
    """Insert a new cell at the specified index."""
    try:
        notebook = load_notebook(notebook_path)
        new_cell = new_markdown_cell(content) if cell_type == 'markdown' else new_code_cell(content)
        notebook.cells.insert(index, new_cell)
        save_notebook(notebook, notebook_path)
        
        result = NotebookEditResult(
            success=True,
            message=f"Successfully inserted {cell_type} cell at index {index}",
            cell_content=content
        )
    except Exception as e:
        result = NotebookEditResult(
            success=False,
            message=f"Failed to insert cell: {str(e)}"
        )
    return str(result)

async def delete_cell(
    notebook_path: Annotated[str, "Path to the notebook file"],
    index: Annotated[int, "Index of the cell to delete"]
) -> str:
    """Delete a cell at the specified index."""
    try:
        notebook = load_notebook(notebook_path)
        if 0 <= index < len(notebook.cells):
            del notebook.cells[index]
            save_notebook(notebook, notebook_path)
            result = NotebookEditResult(
                success=True,
                message=f"Successfully deleted cell at index {index}"
            )
        else:
            result = NotebookEditResult(
                success=False,
                message=f"Cell index {index} out of range"
            )
    except Exception as e:
        result = NotebookEditResult(
            success=False,
            message=f"Failed to delete cell: {str(e)}"
        )
    return str(result)

async def get_cell_content(
    notebook_path: Annotated[str, "Path to the notebook file"],
    index: Annotated[int, "Index of the cell to retrieve"]
) -> str:
    """Get the content of a cell at the specified index."""
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

tools = [{
    "type": "function",
    "function": {
        "name": "get_weather",
        "description": "Get current temperature for provided location in celsius.",
        "parameters": {
            "type": "object",
            "properties": {
                "location": {"type": "string"},
            },
            "required": ["location"],
            "additionalProperties": False
        },
        "strict": True
    }
}, {
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
                "cell_type": {"type": "string", "enum": ["markdown", "code"], "default": "markdown", "description": "Type of cell ('markdown' or 'code')"}
            },
            "required": ["notebook_path", "cell_index", "content"],
            "additionalProperties": False
        },
        "strict": True
    }
}, {
    "type": "function",
    "function": {
        "name": "insert_cell",
        "description": "Insert a new cell at the specified index in a Jupyter notebook.",
        "parameters": {
            "type": "object",
            "properties": {
                "notebook_path": {"type": "string", "description": "Path to the notebook file"},
                "index": {"type": "integer", "description": "Index where to insert the cell"},
                "content": {"type": "string", "description": "Content for the new cell"},
                "cell_type": {"type": "string", "enum": ["markdown", "code"], "default": "markdown", "description": "Type of cell ('markdown' or 'code')"}
            },
            "required": ["notebook_path", "index", "content"],
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
        "name": "notebook_content",
        "description": "Get the content of the entire notebook in a well-structured format.",
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
            "get_weather": get_weather,
            "update_cell": update_cell,
            "insert_cell": insert_cell,
            "delete_cell": delete_cell,
            "get_cell_content": get_cell_content,
            "notebook_content": notebook_content,
            "clear_notebook_output": clear_notebook_output
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