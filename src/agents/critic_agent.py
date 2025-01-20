from typing import Dict, Any, List, Tuple
from .base_agent import BaseAgent, AgentConfig
from ..utils.notebook_utils import NotebookManager, NotebookSection

class CriticAgent(BaseAgent):
    """Agent responsible for reviewing and validating notebook improvements."""
    
    DEFAULT_SYSTEM_MESSAGE = """You are a Critic Agent responsible for reviewing improvements to Jupyter Notebook assignments.
Your role is to:
1. Review changes made by the Editor Agent
2. Ensure all requirements are met
3. Validate point allocations and distribution
4. Check for clarity and consistency
5. Provide specific feedback for improvements

Remember:
- Verify that instructions are clear and unambiguous
- Check that point allocations are fair and justified
- Ensure proper formatting and structure
- Validate that all sections follow the two-level hierarchy rule
- Look for potential issues or areas of confusion for students"""

    def __init__(self, llm_config: Dict[str, Any]):
        """Initialize the Critic Agent."""
        config = AgentConfig(
            name="Critic",
            system_message=self.DEFAULT_SYSTEM_MESSAGE,
            llm_config=llm_config
        )
        super().__init__(config)
        self.notebook_manager = None
    
    def set_notebook(self, notebook_path: str) -> None:
        """Set the notebook to work with."""
        self.notebook_manager = NotebookManager(notebook_path)
    
    def review_section(self, section_index: int) -> Dict[str, Any]:
        """Review a specific section and provide feedback."""
        if not self.notebook_manager:
            raise ValueError("No notebook set. Call set_notebook first.")
        
        sections = self.notebook_manager.get_sections()
        section_info = None
        
        # Find the section to review
        for i, (idx, title, points) in enumerate(sections):
            if idx == section_index:
                section_info = {
                    "index": idx,
                    "title": title,
                    "points": points,
                    "position": i
                }
                break
        
        if not section_info:
            raise ValueError(f"Section with index {section_index} not found")
        
        # Perform the review
        review = {
            "section": section_info,
            "issues": [],
            "suggestions": [],
            "approved": True
        }
        
        # Check points allocation
        if section_info["points"] == 0:
            review["issues"].append("Missing point allocation")
            review["approved"] = False
        
        # Check title format
        if not (title.startswith("# ") or title.startswith("## ")):
            review["issues"].append("Incorrect heading format")
            review["approved"] = False
        
        # Check content
        self._review_content(section_index, review)
        
        return review
    
    def _review_content(self, section_index: int, review: Dict[str, Any]) -> None:
        """Review the content of a section."""
        sections = self.notebook_manager.get_sections()
        
        # Find the current section's position
        current_pos = None
        for i, (idx, _, _) in enumerate(sections):
            if idx == section_index:
                current_pos = i
                break
        
        if current_pos is None:
            return
        
        # Check for clear instructions
        if current_pos + 1 < len(sections):
            next_index = sections[current_pos + 1][0]
            content_cells = next_index - section_index - 1
            if content_cells < 1:
                review["issues"].append("Missing or unclear instructions")
                review["suggestions"].append({
                    "type": "content",
                    "message": "Add clear instructions and requirements"
                })
                review["approved"] = False
    
    def validate_notebook(self) -> Dict[str, Any]:
        """Validate the entire notebook."""
        if not self.notebook_manager:
            raise ValueError("No notebook set. Call set_notebook first.")
        
        sections = self.notebook_manager.get_sections()
        validation = {
            "total_points": sum(points for _, _, points in sections),
            "section_count": len(sections),
            "issues": [],
            "approved": True
        }
        
        # Check total points
        if validation["total_points"] == 0:
            validation["issues"].append("No points allocated in the notebook")
            validation["approved"] = False
        
        # Check hierarchy
        current_main_section = None
        for _, title, _ in sections:
            if title.startswith("# "):
                current_main_section = title
            elif title.startswith("## "):
                if not current_main_section:
                    validation["issues"].append("Subsection without main section")
                    validation["approved"] = False
            else:
                validation["issues"].append("Invalid section header format")
                validation["approved"] = False
        
        return validation
    
    def generate_response(self, message: str) -> str:
        """Generate a response to a message using the underlying AutoGen agent."""
        # This method would be used for direct communication with the agent
        return f"Critic Agent received: {message}" 