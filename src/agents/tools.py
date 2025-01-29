"""Tools configuration and implementation for the agent."""
import json
from typing import Annotated, Optional, Dict, Any, Union, List
from dataclasses import dataclass
import nbformat
import asyncio
import ast
from src.agents.screenshot_utils import take_screenshot, take_screenshot_sync
from src.agents.web_scraper import process_urls, validate_url
from src.agents.state import get_manager  # Replace web_server import with state import
import logging
from sumy.parsers.plaintext import PlaintextParser
from sumy.nlp.tokenizers import Tokenizer
from sumy.summarizers.lsa import LsaSummarizer
from sumy.nlp.stemmers import Stemmer
from sumy.utils import get_stop_words
from langdetect import detect
import re
import nltk  # Import nltk here for downloading resources
from duckduckgo_search import DDGS
import time

logger = logging.getLogger(__name__)


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

def get_notebook() -> Dict[str, Any]:
    """Get direct reference to the notebook content in memory."""
    manager = get_manager()
    logger.info(f"Got manager: {manager}")
    if manager is None:
        logger.error("Manager is None!")
        raise RuntimeError("Manager not initialized")
    content = manager.get_notebook_content()
    logger.info(f"Got notebook content: {bool(content)}")
    return content  # Use the manager's getter method
import nltk
from sumy.parsers.plaintext import PlaintextParser
from sumy.nlp.tokenizers import Tokenizer
from sumy.summarizers.lsa import LsaSummarizer
from sumy.nlp.stemmers import Stemmer
from sumy.utils import get_stop_words
from langdetect import detect
import re
import logging

logger = logging.getLogger(__name__)
import ast

import ast

def summarize_code(code: str) -> str:
    """
    Summarize Python code using an Abstract Syntax Tree (AST), including
    imports, functions, classes, and top-level statements.
    """
    try:
        # Parse the code into an AST object
        tree = ast.parse(code)
        
        summaries = []

        # Extract summaries for imports, functions, classes, and module-level statements
        for node in tree.body:
            if isinstance(node, ast.Import):  # Standard imports
                for alias in node.names:
                    summaries.append(f"Import: {alias.name} {f'as {alias.asname}' if alias.asname else ''}")
            elif isinstance(node, ast.ImportFrom):  # Relative or absolute imports
                module = node.module or "(current directory)"
                for alias in node.names:
                    summaries.append(f"From {module} import {alias.name} {f'as {alias.asname}' if alias.asname else ''}")
            elif isinstance(node, ast.FunctionDef):  # Function definitions
                summaries.append(f"Function `{node.name}`: {ast.get_docstring(node) or 'No docstring provided'}")
            elif isinstance(node, ast.ClassDef):  # Class definitions
                summaries.append(f"Class `{node.name}`: {ast.get_docstring(node) or 'No docstring provided'}")
            elif isinstance(node, ast.Assign):  # Assignments
                targets = [ast.unparse(target) for target in node.targets]  # Variable(s) being assigned
                summaries.append(f"Assignment: {' = '.join(targets)}")
            elif isinstance(node, ast.Expr):  # Top-level expressions
                expr = ast.unparse(node.value)  # The standalone expression
                summaries.append(f"Expression: {expr}")

        return "\n".join(summaries) if summaries else "No functions, classes, imports, or significant statements found."
    except Exception as e:
        return f"Error summarizing code: {str(e)}"
    
def get_summary(text: str, word_count: int = 10) -> str:
    """Generate summary with language-specific handling."""
    try:
        nltk.data.find('tokenizers/punkt')
    except LookupError:
        nltk.download('punkt')  # 下载必要的 `punkt` 资源

    try:
        nltk.data.find('tokenizers/punkt_tab')
    except LookupError:
        print("found punkt_tab")
        nltk.download('punkt_tab')  # 下载必要的 `punkt` 资源
    
    if not text.strip():
        return "<empty>"
    
    try:
        # Detect language
        lang_code = detect(text)
        logger.info(f"Detected language code: {lang_code}")
        print(f"Detected language code: {lang_code}")
        # Map language code to sumy supported language names
        lang_map = {
            'ca': 'catalan',
            'en': 'english',
            'zh-cn': 'chinese',
            'zh-tw': 'chinese',
            'es': 'spanish',
            'fr': 'french',
            'de': 'german',
            'it': 'italian',
            'nl': 'dutch',
            'pt': 'portuguese',
            # 根据需要添加更多语言映射
        }
        lang = lang_map.get(lang_code, 'english')  # 默认使用英文
        logger.info(f"Mapped language: {lang}")
        
        # For Chinese text
        if lang == 'chinese':
            sentences = re.split(r'[。！？]', text)
            sentences = [s.strip() for s in sentences if s.strip()]
            if not sentences:
                return text[:50] + "..."
            processed_text = '\n'.join(sentences)
            logger.info(f"Processed Chinese text with {len(sentences)} sentences.")
        else:
            processed_text = text
            logger.info(f"Processed non-Chinese text.")
            
        # Generate summary using sumy
        try:
            parser = PlaintextParser.from_string(processed_text, Tokenizer(lang))
            stemmer = Stemmer(lang)
            summarizer = LsaSummarizer(stemmer)
            summarizer.stop_words = get_stop_words(lang)
            logger.info(f"Initialized Sumy summarizer for language: {lang}")
            
            # Get sentences and join them
            summary_sentences = summarizer(parser.document, 1)
            summary = ' '.join([str(s) for s in summary_sentences])
            logger.info(f"Generated summary with {len(summary_sentences)} sentences.")
            print(summary)
            return summary
            
        except ValueError as ve:
            logger.error(f"Sumy processing error: {ve}")
            words = text.split()
            return ' '.join(words[:word_count]) + "..."
            
    except Exception as e:
        logger.error(f"Summarization error: {str(e)}")
        logger.error(f"NLTK data paths: {nltk.data.path}")
        return text[:50] + "..."
    
def list_notebook_cells() -> str:
    """List index, cell type and summary of each notebook cell. Supports multiple languages."""
    try:
        notebook = get_notebook()
        if not notebook or "cells" not in notebook:
            return "No notebook loaded in memory"

        toc = []
        for idx, cell in enumerate(notebook["cells"]):
            cell_type = cell["cell_type"]
            # Join the source list into a single string
            source = "".join(cell["source"]).strip()

            # Generate summary if cell has content
            if source:
                try:
                    # For code cells, use AST to summarize
                    if cell_type == "code":
                        summary = summarize_code(source)  # Use summarize_code function
                    else:
                        summary = get_summary(source, word_count=10)
                except Exception as e:
                    logger.error(f"Error generating summary for cell {idx}: {str(e)}")
                    summary = "<error generating summary>"
            else:
                summary = "<empty cell>"

            toc.append(f"[cell {idx}] {cell_type}: {summary}")

        return "\n".join(toc)

    except Exception as e:
        logger.error(f"Error generating table of contents: {str(e)}")
        return f"Error generating table of contents: {str(e)}"

def get_multiple_cells(cell_indices: List[int]) -> str:
    """Get the content of multiple cells in the notebook in a well-structured format."""
    try:
        if len(cell_indices) > 10:
            return "This is too much, please get less then 10 cell content at once."
        notebook = get_notebook()
        
        if not notebook or "cells" not in notebook:
            return "No notebook loaded in memory"
            
        formatted_cells = []
        
        for idx in cell_indices:
            if 0 <= idx < len(notebook["cells"]):
                cell = notebook["cells"][idx]
                # Handle both string and list source formats
                cell_content = cell["source"]
                if isinstance(cell_content, list):
                    cell_content = "".join(cell_content)
                cell_content = cell_content.strip()
                
                if cell_content:
                    formatted_cells.append(f"<{cell['cell_type']}>\n{cell_content}\n</{cell['cell_type']}>")
                else:
                    formatted_cells.append(f"<empty cell>")
            else:
                formatted_cells.append(f"[Cell {idx} - out of range]")
                
        return "\n".join(formatted_cells)
        
    except Exception as e:
        return f"Error getting cells: {str(e)}"

def save_notebook(notebook: nbformat.NotebookNode, notebook_path: str) -> None:
    """Save the notebook to file."""
    with open(notebook_path, 'w', encoding='utf-8') as f:
        nbformat.write(notebook, f)

async def update_cell(
    cell_index: Annotated[int, "Index of the cell to update"],
    content: Annotated[str, "New content for the cell"],
    cell_type: Annotated[str, "Type of cell ('markdown' or 'code')"] = 'markdown'
) -> str:
    """Propose an update to a cell's content at the specified index."""
    try:
        notebook = get_notebook()
        manager = get_manager()
        if manager is None:
            return str(NotebookEditResult(
                success=False,
                message="Manager not initialized"
            ))
        
        if not notebook or "cells" not in notebook:
            return str(NotebookEditResult(
                success=False,
                message="No notebook loaded in memory"
            ))
        
        if cell_index >= len(notebook["cells"]):
            return str(NotebookEditResult(
                success=False,
                message=f"Cell index {cell_index} out of range"
            ))
        
        old_content = notebook["cells"][cell_index]["source"]
        
        changes = [{
            "type": "update",
            "index": cell_index,
            "old_content": old_content,
            "new_content": content,
            "cell_type": cell_type
        }]
        
        data = {
            "type": "propose_changes",
            "changes": changes
        }
        await manager.broadcast(data)
        
        return str(NotebookEditResult(
            success=True,
            message="Changes proposed successfully"
        ))
        
    except Exception as e:
        return str(NotebookEditResult(
            success=False,
            message=f"Failed to propose cell update: {str(e)}"
        ))

async def get_cell_content(
    index: Annotated[int, "Index of the cell to retrieve"]
) -> str:
    """Get the content of a cell at the specified index."""
    try:
        notebook = get_notebook()
        
        if not notebook or "cells" not in notebook:
            return str(NotebookEditResult(
                success=False,
                message="No notebook loaded in memory"
            ))
        
        if 0 <= index < len(notebook["cells"]):
            content = notebook["cells"][index]["source"]
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
    query: Annotated[str, "Search query text"],
    keywords: Annotated[Optional[List[str]], "List of keywords for keyword search"],
    top_k: Annotated[int, "Maximum number of results to return"] = 10,
    min_score: Annotated[float, "Minimum similarity score"] = 0.3,
    match_all: Annotated[bool, "For keyword search: whether to require all keywords to match"] = False
) -> str:
    """Search within a Jupyter notebook using semantic search or keyword matching. Return matching cells with their content."""
    try:
        # 延迟导入
        from search_notebook import get_search_engine, format_search_results, NotebookSearchEngine
        
        manager = get_manager()
        if manager is None:
            return "Error: Manager not initialized"
            
        notebook = get_notebook()
        if not notebook:
            return "Error: No notebook loaded in memory"
            
        search_engine = get_search_engine()
        if not isinstance(search_engine, NotebookSearchEngine):
            search_engine = NotebookSearchEngine(manager)
            
        # 直接传入 notebook dict
        search_engine.index_notebook(notebook)
        
        results_semantic = search_engine.search(query, top_k, min_score)
        results_keywords = search_engine.keyword_search(keywords, match_all)
        
        return await format_search_results(results_semantic + results_keywords)
        
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
    
def search_with_retry(query, max_results=10, max_retries=3):
    """
    Search using DuckDuckGo and return results with URLs and text snippets.
    """
    for attempt in range(max_retries):

        try:
            with DDGS() as ddgs:
                results = list(ddgs.text(query, max_results=max_results))
                
            if not results:
                return "No results found"
            
            # Format results into a readable string
            formatted_results = []
            for i, r in enumerate(results, 1):
                formatted_results.append(f"\n=== Result {i} ===")
                formatted_results.append(f"URL: {r.get('href', 'N/A')}")
                formatted_results.append(f"Title: {r.get('title', 'N/A')}")
                formatted_results.append(f"Snippet: {r.get('body', 'N/A')}")
            
            return "\n".join(formatted_results)
                
        except Exception as e:
            if attempt == max_retries - 1:  # If last attempt
                return f"Search failed after {max_retries} attempts: {str(e)}"
            time.sleep(1)  # Wait 1 second before retry
tools = [{
    "type": "function",
    "function": {
        "name": "update_cell",
        "description": "Update a cell's content at the specified index in the notebook.",
        "parameters": {
            "type": "object",
            "properties": {
                "cell_index": {"type": "integer", "description": "Index of the cell to update"},
                "content": {"type": "string", "description": "New content for the cell"},
                "cell_type": {"type": "string", "enum": ["markdown", "code"], "description": "Type of cell ('markdown' or 'code')"}
            },
            "required": ["cell_index", "content", "cell_type"],
            "additionalProperties": False
        },
        "strict": True
    }
}, {
    "type": "function",
    "function": {
        "name": "get_cell_content",
        "description": "Get the content of a cell at the specified index in the notebook.",
        "parameters": {
            "type": "object",
            "properties": {
                "index": {"type": "integer", "description": "Index of the cell to retrieve"}
            },
            "required": ["index"],
            "additionalProperties": False
        },
        "strict": True
    }
}, {
    "type": "function", 
    "function": {
        "name": "get_multiple_cells",
        "description": "Get the content of multiple cells in the notebook in a well-structured format.",
        "parameters": {
            "type": "object",
            "properties": {
                "cell_indices": {"type": "array", "items": {"type": "integer"}, "description": "List of cell indices to retrieve"}
            },
            "required": ["cell_indices"],
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
}, {
    "type": "function",
    "function": {
        "name": "list_notebook_cells",
        "description": "List index, cell type and summery of each notebook cell.",
        "parameters": {
            "type": "object",
            "properties": {},
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
            "get_multiple_cells": get_multiple_cells,
            "get_cell_content": get_cell_content,
            "search_with_retry": search_with_retry,
            "search_notebook": search_notebook,
            "take_webpage_screenshot": take_webpage_screenshot,
            "take_webpage_screenshot_sync": take_webpage_screenshot_sync,
            "scrape_websites": scrape_websites,
            "list_notebook_cells": list_notebook_cells,
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