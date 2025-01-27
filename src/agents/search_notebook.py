# notebook_search.py

"""Notebook search functionality implementation."""
import nbformat
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
import json
from pathlib import Path
from sentence_transformers import SentenceTransformer
import numpy as np
from datetime import datetime
import logging 
from state import get_manager

logger = logging.getLogger(__name__)

@dataclass
class NotebookCell:
    """Represents a single cell in a Jupyter notebook."""
    cell_type: str
    content: str
    metadata: Dict[str, Any]
    execution_count: Optional[int]
    outputs: List[Dict[str, Any]]

@dataclass(frozen=True)
class SearchResult:
    """Represents a single search result with its relevance score."""
    cell_index: int
    cell: NotebookCell
    score: float

class NotebookSearchEngine:
    """Handles semantic and keyword search functionality for Jupyter notebooks.
    
    The semantic search is truly multilingual and supports 50+ languages including English, German,
    Chinese, Spanish, Italian, Dutch, Polish and many others through the use of the 
    paraphrase-multilingual-MiniLM-L12-v2 model. Both queries and notebook content can be 
    in any of these languages, and cross-lingual search is supported (e.g., querying in 
    German to find content in English).
    """
    
    def __init__(self, connection_manager, embedding_model: str = "paraphrase-multilingual-MiniLM-L12-v2"):
        """Initialize the search engine.
        
        Args:
            embedding_model: Name of the sentence-transformers model to use. Default is
                           paraphrase-multilingual-MiniLM-L12-v2 which provides powerful 
                           multilingual embeddings supporting 50+ languages.
            connection_manager: Instance of ConnectionManager for temporary file handling
        """
        self.model = SentenceTransformer(embedding_model)
        self.notebook_cells: List[NotebookCell] = []
        self.cell_embeddings: List[np.ndarray] = []
        self.manager = connection_manager

    def _create_cell(self, cell: Dict[str, Any]) -> NotebookCell:
        """Create a NotebookCell instance from a notebook cell dict."""
        return NotebookCell(
            cell_type=cell.get("cell_type", "code"),
            content="".join(cell.get("source", [])) if isinstance(cell.get("source"), list) else str(cell.get("source", "")),
            metadata=cell.get("metadata", {}),
            execution_count=cell.get("execution_count"),
            outputs=cell.get("outputs", [])
        )
    
    def index_notebook(self, notebook: Optional[Dict[str, Any]] = None) -> None:
        """Index a notebook for searching using batched processing.
        
        Args:
            notebook: Optional notebook dict. If not provided, will get from manager.
        """
        if notebook is None:
            notebook = self.manager.get_notebook_content()
            if not notebook:
                logger.error("No notebook content available in manager")
                return
        
        if not isinstance(notebook, dict) or "cells" not in notebook:
            logger.error("Invalid notebook format")
            return
            
        # Convert cells to NotebookCell objects
        self.notebook_cells = [self._create_cell(cell) for cell in notebook["cells"]]
        
        # Get all cell contents at once
        contents = [cell.content for cell in self.notebook_cells]
        # Compute embeddings in one go
        self.cell_embeddings = self.model.encode(contents, show_progress_bar=False)
    
    def search(self, query: str, top_k: int = 5, min_score: float = 0.5) -> List[SearchResult]:
        """Perform semantic search within the current notebook.
        
        The search is language-agnostic and works with queries in any language supported
        by the model (including English, German, Chinese, etc.).
        
        Args:
            query: The search query in any supported language
            top_k: Maximum number of results to return
            min_score: Minimum similarity score (0-1) for results
            
        Returns:
            List of SearchResult objects sorted by relevance
        """
        if not self.notebook_cells:
            raise ValueError("No notebook loaded. Call index_notebook() first.")
        query_embedding = self.model.encode(query, show_progress_bar=False)
        
        # Vectorized similarity computation
        similarities = np.dot(self.cell_embeddings, query_embedding)
        
        # Create results
        results = []
        for i, (score, cell) in enumerate(zip(similarities, self.notebook_cells)):
            if score >= min_score:
                results.append(SearchResult(cell_index=i, cell=cell, score=float(score)))
        results.sort(key=lambda x: x.score, reverse=True)
        return results[:top_k]
    
    def keyword_search(self, keywords: List[str], match_all: bool = False) -> List[SearchResult]:
        """Perform keyword-based search within the current notebook."""
        if not self.notebook_cells:
            raise ValueError("No notebook loaded. Call index_notebook() first.")
        # Pre-process keywords
        keywords_lower = [kw.lower() for kw in keywords]
        
        results = []
        for i, cell in enumerate(self.notebook_cells):
            content = cell.content.lower()
            # Use any/all with generator expression for better memory efficiency
            matches = (kw in content for kw in keywords_lower)
            
            if match_all:
                if all(matches):
                    results.append(SearchResult(cell_index=i, cell=cell, score=1.0))
            else:
                # Count matches for scoring
                match_count = sum(1 for kw in keywords_lower if kw in content)
                if match_count > 0:
                    score = match_count / len(keywords)
                    results.append(SearchResult(cell_index=i, cell=cell, score=score))
        results.sort(key=lambda x: x.score, reverse=True)
        return results

_search_engine: Optional[NotebookSearchEngine] = None  # 初始化全局搜索引擎变量

def get_search_engine() -> NotebookSearchEngine:
    """Get or create the global search engine instance."""
    global _search_engine
    if _search_engine is None:
        manager = get_manager()
        if manager is None:
            raise RuntimeError("Manager not initialized")
        _search_engine = NotebookSearchEngine(manager)
    return _search_engine

async def format_search_results(results: List[SearchResult]) -> str:
    """Format search results into a readable string."""
    if not results:
        return "No matching cells found."
    # Deduplicate results based on cell_index, keeping the highest scoring result
    seen_indices = {}
    for result in results:
        if result.cell_index not in seen_indices or result.score > seen_indices[result.cell_index].score:
            seen_indices[result.cell_index] = result
    
    # Convert back to list and sort by score
    unique_results = sorted(seen_indices.values(), key=lambda x: x.score, reverse=True)
    # Pre-allocate list with known size for better memory efficiency
    formatted_results = []
    for i, result in enumerate(unique_results, 1):
        cell = result.cell
        formatted_results.extend([
            f"\n=== Result {i} ===",
            f"Cell Index: {result.cell_index}",
            f"Cell Type: {cell.cell_type}",
            f"Content:\n{cell.content}"
        ])
    return "\n".join(formatted_results)