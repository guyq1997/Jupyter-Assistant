from typing import Dict, Any, Optional, List
import os
import autogen
from dotenv import load_dotenv

from .agents.planner_agent import PlannerAgent
from .agents.editor_agent import EditorAgent
from .agents.critic_agent import CriticAgent
from .utils.notebook_utils import NotebookManager

load_dotenv()

class RubricAgent:
    """Main class that orchestrates the multi-agent system for improving Jupyter Notebook assignments."""
    
    def __init__(self, config_path: Optional[str] = None):
        """Initialize the RubricAgent system."""
        # Load configuration
        self.config = self._load_config(config_path)
        
        # Initialize agents
        self.planner = PlannerAgent(self.config["llm"])
        self.editor = EditorAgent(self.config["llm"])
        self.critic = CriticAgent(self.config["llm"])
        
        # Initialize group chat
        self.group_chat = autogen.GroupChat(
            agents=[
                self.planner.get_agent(),
                self.editor.get_agent(),
                self.critic.get_agent()
            ],
            messages=[],
            max_round=50,
            speaker_selection_method="round_robin",
            allow_repeat_speaker=False,
        )
        
        self.manager = autogen.GroupChatManager(
            groupchat=self.group_chat,
            llm_config=self.config["llm"],
            system_message="""You are a group chat manager responsible for coordinating the improvement of Jupyter Notebook assignments.
Your role is to:
1. Ensure the conversation stays focused on improving the notebook
2. Coordinate between the Planner, Editor, and Critic agents
3. Summarize progress and decisions
4. Terminate the conversation when improvements are complete

Use 'TERMINATE' to end the conversation when the notebook meets all requirements."""
        )
    
    def _load_config(self, config_path: Optional[str]) -> Dict[str, Any]:
        """Load configuration from file or use defaults."""
        config = {
            "llm": {
                "config_list": [{
                    "model": "gpt-4",
                    "api_key": os.getenv("OPENAI_API_KEY"),
                    "base_url": os.getenv("OPENAI_API_BASE", "https://api.openai.com/v1"),
                    "api_type": "openai",
                    "api_version": None
                }],
                "temperature": 0.7,
                "request_timeout": 120,
                "seed": 42,
                "config_list_timeout": 120,
                "use_cache": True,
            }
        }
        
        if config_path and os.path.exists(config_path):
            # Load config from file if provided
            pass
        
        return config
    
    def improve_notebook(self, notebook_path: str, requirements: Optional[Dict[str, Any]] = None) -> str:
        """Improve a Jupyter Notebook assignment."""
        # Set the notebook for all agents
        self.planner.set_notebook(notebook_path)
        self.editor.set_notebook(notebook_path)
        self.critic.set_notebook(notebook_path)
        
        # Start the improvement process
        improvements = self.planner.analyze_notebook()
        improvement_plan = self.planner.create_improvement_plan(improvements)
        
        # Process each improvement task
        for task in improvement_plan:
            # Editor makes improvements
            section = self.editor.improve_section(task["section_index"], task)
            
            # Critic reviews changes
            review = self.critic.review_section(task["section_index"])
            
            # If not approved, have editor make suggested changes
            while not review["approved"] and review["suggestions"]:
                section = self.editor.improve_section(task["section_index"], {
                    **task,
                    "suggestions": review["suggestions"]
                })
                review = self.critic.review_section(task["section_index"])
        
        # Final validation
        validation = self.critic.validate_notebook()
        if not validation["approved"]:
            # Handle validation issues
            pass
        
        # Save the improved notebook with a new name
        output_path = self._generate_output_path(notebook_path)
        self.planner.notebook_manager.save_notebook(output_path)
        
        return output_path
    
    def _generate_output_path(self, original_path: str) -> str:
        """Generate a path for the improved notebook."""
        base, ext = os.path.splitext(original_path)
        return f"{base}_improved{ext}"
    
    def get_improvement_summary(self) -> Dict[str, Any]:
        """Get a summary of improvements made to the notebook."""
        if not self.planner.notebook_manager:
            raise ValueError("No notebook has been improved yet")
        
        sections = self.planner.notebook_manager.get_sections()
        return {
            "total_sections": len(sections),
            "total_points": sum(points for _, _, points in sections),
            "sections": [
                {
                    "title": title,
                    "points": points
                }
                for _, title, points in sections
            ]
        } 