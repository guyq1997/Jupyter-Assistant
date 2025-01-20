import os
import sys
import argparse
from pathlib import Path

# Add the parent directory to the Python path
sys.path.append(str(Path(__file__).parent.parent))

from src.rubric_agent import RubricAgent

def main():
    """Example script demonstrating how to use RubricAgent."""
    parser = argparse.ArgumentParser(description="Improve a Jupyter Notebook assignment")
    parser.add_argument("notebook_path", help="Path to the input Jupyter Notebook")
    parser.add_argument("--config", help="Path to configuration file (optional)")
    args = parser.parse_args()
    
    # Initialize RubricAgent
    agent = RubricAgent(config_path=args.config)
    
    # Example requirements (optional)
    requirements = {
        "total_points": 100,
        "max_sections": 5,
        "style": {
            "clear_instructions": True,
            "code_templates": True
        }
    }
    
    try:
        # Improve the notebook
        improved_path = agent.improve_notebook(args.notebook_path, requirements)
        print(f"\nNotebook improved successfully!")
        print(f"Improved notebook saved to: {improved_path}")
        
        # Get and print improvement summary
        summary = agent.get_improvement_summary()
        print("\nImprovement Summary:")
        print(f"Total sections: {summary['total_sections']}")
        print(f"Total points: {summary['total_points']}")
        print("\nSections:")
        for section in summary['sections']:
            print(f"- {section['title']} ({section['points']} points)")
            
    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main() 