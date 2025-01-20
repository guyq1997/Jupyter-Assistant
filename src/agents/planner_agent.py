from typing import List, Optional, Dict, Any
from .base_agent import BaseAgent, AgentConfig
from ..utils.notebook_utils import NotebookManager, NotebookSection

class PlannerAgent(BaseAgent):
    """Agent responsible for planning and orchestrating the notebook improvement process."""
    
    DEFAULT_SYSTEM_MESSAGE = """You are a Planner Agent responsible for analyzing and planning improvements to Jupyter Notebook assignments.
Your role is to:
1. Analyze the structure of notebooks and identify sections that need improvement
2. Create a plan for improving each section while maintaining a clear hierarchy (main questions and sub-questions)
3. Ensure all sections have clear requirements, points allocation, and proper formatting
4. Coordinate with the Editor Agent to implement improvements
5. Work with the Critic Agent to verify changes meet the requirements

Remember:
- Each question should have clear instructions and point allocations
- Maintain a maximum of two levels of hierarchy (main questions and sub-questions)
- Ensure proper spacing between sections
- Keep track of total points and their distribution"""

    def __init__(self, llm_config: Dict[str, Any]):
        """Initialize the Planner Agent."""
        config = AgentConfig(
            name="Planner",
            system_message=self.DEFAULT_SYSTEM_MESSAGE,
            llm_config=llm_config
        )
        super().__init__(config)
        self.notebook_manager = None
    
    def set_notebook(self, notebook_path: str) -> None:
        """Set the notebook to work with."""
        self.notebook_manager = NotebookManager(notebook_path)
    
    def analyze_notebook(self) -> List[Dict[str, Any]]:
        """Analyze the notebook and create a plan for improvements."""
        if not self.notebook_manager:
            raise ValueError("No notebook set. Call set_notebook first.")
        
        sections = self.notebook_manager.get_sections()
        improvements = []
        
        total_points = sum(points for _, _, points in sections)
        current_section = None
        
        for i, (index, title, points) in enumerate(sections):
            section_info = {
                "index": index,
                "title": title,
                "points": points,
                "needs_improvement": False,
                "improvements_needed": []
            }
            
            # Check for common issues
            if points == 0:
                section_info["needs_improvement"] = True
                section_info["improvements_needed"].append("Missing point allocation")
            
            # Check header level and hierarchy
            if title.startswith("# "):
                current_section = section_info
            elif title.startswith("## "):
                if not current_section:
                    section_info["needs_improvement"] = True
                    section_info["improvements_needed"].append("Subsection without parent section")
            
            # Check for clear instructions
            if i + 1 < len(sections):
                next_index = sections[i + 1][0]
                content_cells = next_index - index - 1
                if content_cells < 1:
                    section_info["needs_improvement"] = True
                    section_info["improvements_needed"].append("Missing or unclear instructions")
            
            improvements.append(section_info)
        
        return improvements
    
    def create_improvement_plan(self, improvements: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Create a detailed plan for implementing improvements."""
        plan = []
        
        for section in improvements:
            if section["needs_improvement"]:
                improvement_task = {
                    "section_index": section["index"],
                    "title": section["title"],
                    "current_points": section["points"],
                    "issues": section["improvements_needed"],
                    "priority": "high" if "Missing point allocation" in section["improvements_needed"] else "medium",
                    "suggested_actions": []
                }
                
                # Add suggested actions based on issues
                for issue in section["improvements_needed"]:
                    if issue == "Missing point allocation":
                        improvement_task["suggested_actions"].append({
                            "action": "add_points",
                            "details": "Add appropriate point allocation based on question complexity"
                        })
                    elif issue == "Missing or unclear instructions":
                        improvement_task["suggested_actions"].append({
                            "action": "improve_instructions",
                            "details": "Add clear instructions and requirements for the question"
                        })
                    elif issue == "Subsection without parent section":
                        improvement_task["suggested_actions"].append({
                            "action": "fix_hierarchy",
                            "details": "Create proper parent section or adjust heading level"
                        })
                
                plan.append(improvement_task)
        
        return plan
    
    def generate_response(self, message: str) -> str:
        """Generate a response to a message using the underlying AutoGen agent."""
        # This method would be used for direct communication with the agent
        # Implementation would depend on how we want to handle direct messages
        return f"Planner Agent received: {message}" 