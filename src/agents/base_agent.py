from typing import Any, Dict, List, Optional
from pydantic import BaseModel
import autogen
from dotenv import load_dotenv

load_dotenv()

class AgentConfig(BaseModel):
    """Configuration for an agent."""
    name: str
    system_message: str
    llm_config: Dict[str, Any]
    human_input_mode: str = "NEVER"
    max_consecutive_auto_reply: int = 10

class BaseAgent:
    """Base class for all agents in the system."""
    
    def __init__(self, config: AgentConfig):
        """Initialize the base agent with configuration."""
        self.config = config
        self.agent = autogen.AssistantAgent(
            name=config.name,
            system_message=config.system_message,
            llm_config=config.llm_config,
            human_input_mode=config.human_input_mode,
            max_consecutive_auto_reply=config.max_consecutive_auto_reply,
            # New parameters for the latest version
            is_termination_msg=lambda x: x.get("content", "").rstrip().endswith("TERMINATE"),
            code_execution_config={"work_dir": "workspace", "use_docker": False},
        )
        
    def get_agent(self) -> autogen.AssistantAgent:
        """Get the underlying AutoGen agent."""
        return self.agent
    
    def update_system_message(self, new_message: str) -> None:
        """Update the agent's system message."""
        self.agent.update_system_message(new_message)
    
    def reset(self) -> None:
        """Reset the agent's state."""
        self.agent.reset()
    
    def generate_response(self, message: str) -> str:
        """Generate a response to a message."""
        raise NotImplementedError("Subclasses must implement generate_response") 