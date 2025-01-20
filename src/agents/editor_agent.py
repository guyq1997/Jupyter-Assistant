from typing import Dict, Any, Optional
from .base_agent import BaseAgent, AgentConfig
from ..utils.notebook_utils import NotebookManager, NotebookSection

class EditorAgent(BaseAgent):
    """Agent responsible for editing and improving notebook sections."""
    
    DEFAULT_SYSTEM_MESSAGE = """You are an Editor Agent responsible for improving Jupyter Notebook assignments.
Your role is to:
1. Implement improvements to notebook sections as directed by the Planner Agent
2. Ensure clear and concise writing in instructions and requirements
3. Add appropriate point allocations based on question complexity
4. Maintain consistent formatting and structure
5. Create clear code templates when needed

Remember:
- Write clear, unambiguous instructions
- Include specific requirements for each question
- Provide appropriate scaffolding in code cells
- Maintain consistent formatting throughout the notebook
- Follow the two-level hierarchy rule (main questions and sub-questions only)"""

    def __init__(self, llm_config: Dict[str, Any]):
        """Initialize the Editor Agent."""
        config = AgentConfig(
            name="Editor",
            system_message=self.DEFAULT_SYSTEM_MESSAGE,
            llm_config=llm_config
        )
        super().__init__(config)
        self.notebook_manager = None
    
    def set_notebook(self, notebook_path: str) -> None:
        """Set the notebook to work with."""
        self.notebook_manager = NotebookManager(notebook_path)
    
    def improve_section(self, section_index: int, improvements: Dict[str, Any]) -> NotebookSection:
        """Improve a specific section based on the provided improvements."""
        if not self.notebook_manager:
            raise ValueError("No notebook set. Call set_notebook first.")
        
        # Create a new section with improvements
        section = NotebookSection(
            title=improvements.get("title", ""),
            points=improvements.get("suggested_points", 0.0),
            description="",
            code_template=None
        )
        
        # Apply improvements based on suggested actions
        for action in improvements.get("suggested_actions", []):
            if action["action"] == "add_points":
                section.points = self._suggest_points(improvements)
            elif action["action"] == "improve_instructions":
                section.description = self._generate_instructions(improvements)
            elif action["action"] == "fix_hierarchy":
                if "parent_section" in improvements:
                    section.parent_section = improvements["parent_section"]
        
        # Update the notebook
        self.notebook_manager.update_section(section_index, {
            "source": self._format_section(section)
        })
        
        return section
    
    def _suggest_points(self, improvements: Dict[str, Any]) -> float:
        """Suggest appropriate points for a section based on complexity."""
        # This would typically involve LLM interaction to analyze complexity
        # For now, using a simple heuristic
        base_points = 5.0
        if "complexity" in improvements:
            if improvements["complexity"] == "high":
                base_points = 10.0
            elif improvements["complexity"] == "low":
                base_points = 3.0
        return base_points
    
    def _generate_instructions(self, improvements: Dict[str, Any]) -> str:
        """Generate clear instructions for a section."""
        # This would typically involve LLM interaction to generate instructions
        # For now, returning a template
        template = f"""# Task
{improvements.get('task_description', 'Complete the following task:')}

## Requirements
- Requirement 1
- Requirement 2

## Evaluation Criteria
- Criterion 1 (X points)
- Criterion 2 (Y points)

## Tips
- Tip 1
- Tip 2"""
        return template
    
    def _format_section(self, section: NotebookSection) -> str:
        """Format a section into markdown content."""
        content = [f"# {section.title}"]
        if section.points:
            content[0] += f" ({section.points} points)"
        
        if section.description:
            content.append("\n" + section.description)
        
        return "\n".join(content)
    
    def generate_response(self, message: str) -> str:
        """Generate a response to a message using the underlying AutoGen agent."""
        # This method would be used for direct communication with the agent
        return f"Editor Agent received: {message}" 