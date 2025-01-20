from typing import Dict, List, Optional, Tuple, Union
import nbformat
from nbformat.v4 import new_notebook, new_markdown_cell, new_code_cell
from pydantic import BaseModel

class NotebookSection(BaseModel):
    """Represents a section of a Jupyter notebook."""
    title: str
    description: Optional[str]
    points: float
    parent_section: Optional[str] = None
    subsections: List['NotebookSection'] = []
    code_template: Optional[str] = None
    
class NotebookManager:
    """Manages Jupyter notebook operations."""
    
    def __init__(self, notebook_path: Optional[str] = None):
        """Initialize the notebook manager."""
        self.notebook = None
        if notebook_path:
            self.load_notebook(notebook_path)
    
    def load_notebook(self, path: str) -> None:
        """Load a notebook from a file."""
        with open(path, 'r', encoding='utf-8') as f:
            self.notebook = nbformat.read(f, as_version=4)
    
    def save_notebook(self, path: str) -> None:
        """Save the notebook to a file."""
        if not self.notebook:
            raise ValueError("No notebook loaded")
        with open(path, 'w', encoding='utf-8') as f:
            nbformat.write(self.notebook, f)
    
    def create_new_notebook(self) -> None:
        """Create a new empty notebook."""
        self.notebook = new_notebook()
    
    def add_section(self, section: NotebookSection) -> None:
        """Add a section to the notebook."""
        if not self.notebook:
            self.create_new_notebook()
        
        # Add section title and description
        cells = []
        header = f"# {section.title}"
        if section.points:
            header += f" ({section.points} points)"
        cells.append(new_markdown_cell(header))
        
        if section.description:
            cells.append(new_markdown_cell(section.description))
        
        # Add code template if provided
        if section.code_template:
            cells.append(new_code_cell(section.code_template))
        else:
            cells.append(new_code_cell("# Your code here"))
        
        # Add subsections recursively
        for subsection in section.subsections:
            self._add_subsection(subsection, cells)
        
        self.notebook.cells.extend(cells)
    
    def _add_subsection(self, section: NotebookSection, cells: List[Dict]) -> None:
        """Add a subsection to the notebook (helper method)."""
        # Add subsection title and description
        header = f"## {section.title}"
        if section.points:
            header += f" ({section.points} points)"
        cells.append(new_markdown_cell(header))
        
        if section.description:
            cells.append(new_markdown_cell(section.description))
        
        # Add code template if provided
        if section.code_template:
            cells.append(new_code_cell(section.code_template))
        else:
            cells.append(new_code_cell("# Your code here"))
    
    def get_sections(self) -> List[Tuple[int, str, float]]:
        """Get all sections in the notebook with their cell indices and points."""
        if not self.notebook:
            return []
        
        sections = []
        for i, cell in enumerate(self.notebook.cells):
            if cell.cell_type == 'markdown':
                # Check for section headers (# or ##)
                lines = cell.source.split('\n')
                if lines and (lines[0].startswith('# ') or lines[0].startswith('## ')):
                    # Extract points if available
                    points = 0.0
                    if '(' in lines[0] and ')' in lines[0]:
                        try:
                            points = float(lines[0].split('(')[1].split(')')[0].replace('points', '').strip())
                        except ValueError:
                            pass
                    sections.append((i, lines[0].lstrip('#').strip(), points))
        
        return sections
    
    def update_section(self, section_index: int, new_content: Union[str, Dict]) -> None:
        """Update a section's content."""
        if not self.notebook or section_index >= len(self.notebook.cells):
            raise ValueError("Invalid section index")
        
        if isinstance(new_content, str):
            self.notebook.cells[section_index].source = new_content
        else:
            self.notebook.cells[section_index].update(new_content) 