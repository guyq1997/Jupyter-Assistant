from src.agents.prompt import SYSTEM_MESSAGE_PLANNER, SYSTEM_MESSAGE_EDITOR, GENERATE_RUBRIC
from src.agents.tools import tools, call_function
import asyncio
from src.agents.utils import broadcast_message
from openai import OpenAI
import json
from typing import List, Dict, Any
import logging

client = OpenAI()

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class Agent:
    def __init__(self):
        self.message_history = []

    def clear_history(self):
        """Clear the message history and reset to initial state"""
        self.message_history = []
        return "Message history cleared."

    async def process_query(self, query: Dict[str, Any]) -> str:
        # Handle special commands
        if query.get("message", "").strip().lower() == "clear_history":
            result = self.clear_history()
            print("Cleared history")
            return result

        if not hasattr(self, 'message_history'):
            self.message_history = []

        selected_cells_content = query.get("selected_cells", "")

        query = query.get("message", "")
        if selected_cells_content:
            file_context = "# Inputs\n\n# Current Cells\n Here are the cells i am looking at\n"
            
            if len(self.message_history) > 0:
                messages = self.message_history.copy()
                messages.append({"role": "user", "content": file_context + selected_cells_content, "name":"potential_context"})
                messages.append({"role": "user", "content": "\n\n" + query})
            else:
                messages = [
                    {"role": "system", "content": SYSTEM_MESSAGE_EDITOR},
                    {"role": "user", "content": file_context + selected_cells_content},
                    {"role": "user", "content": "\n\n" + query}
                ]
                self.message_history = messages.copy()

        else:
            if len(self.message_history) > 0:
                messages = self.message_history.copy()
                messages.append({"role": "user", "content": "\n\n" + query})
            else:
                messages = [
                    {"role": "system", "content": SYSTEM_MESSAGE_EDITOR},
                    {"role": "user", "content": "\n\n" + query}
                ]
                self.message_history = messages.copy()
                
        

        logger.info(f"Whole Messages: %s", json.dumps(messages, indent=2))

        response = client.chat.completions.create(
            model="gpt-4o",
            messages=messages,
            tools=tools,
            tool_choice="auto",
            stream=True
        )

        assistant_message = {"role": "assistant", "content": ""}
        
        # Process the streaming response
        for chunk in response:
            delta = chunk.choices[0].delta
            
            # Handle content chunks
            if delta.content:
                content = delta.content
                assistant_message["content"] += content
                await broadcast_message("Assistant", content)
                await asyncio.sleep(0)
                
            # Handle tool calls
            elif hasattr(delta, 'tool_calls') and delta.tool_calls:
                if "tool_calls" not in assistant_message:
                    assistant_message["tool_calls"] = []
                
                for tool_call in delta.tool_calls:
                    tool_call_index = tool_call.index
                    
                    # Initialize or update tool call
                    while len(assistant_message["tool_calls"]) <= tool_call_index:
                        assistant_message["tool_calls"].append({
                            "id": "",
                            "type": "function",
                            "function": {"name": "", "arguments": ""}
                        })
                    
                    current_call = assistant_message["tool_calls"][tool_call_index]
                    
                    # Update ID if present
                    if hasattr(tool_call, 'id') and tool_call.id is not None:
                        current_call["id"] = tool_call.id
                    
                    # Update function information if present
                    if hasattr(tool_call, 'function'):
                        if hasattr(tool_call.function, 'name') and tool_call.function.name is not None:
                            current_call["function"]["name"] = tool_call.function.name
                        if hasattr(tool_call.function, 'arguments') and tool_call.function.arguments is not None:
                            current_call["function"]["arguments"] += tool_call.function.arguments

        # Clean up any remaining null values before appending
        if "tool_calls" in assistant_message:
            for call in assistant_message["tool_calls"]:
                if not call["id"]:
                    call["id"] = ""
                if not call["function"]["name"]:
                    call["function"]["name"] = ""
                if not call["function"]["arguments"]:
                    call["function"]["arguments"] = "{}"

        # Log the message structure before appending
        logger.info("Debug - Assistant response: %s", json.dumps(assistant_message, indent=2))
        messages.append(assistant_message)
        
        tool_calls = assistant_message.get("tool_calls", [])
        counter = 0

        while tool_calls and counter < 10:
            for tool_call in tool_calls:
                try:
                    name = tool_call["function"]["name"] or ""
                    args = tool_call["function"]["arguments"] or "{}"
                    
                    tool_message = f"{counter}. round: Calling *tool {name}*"
                    await broadcast_message("Assistant", f"\n\n🔧 {tool_message}\n\n")
                    
                    tool_result = await call_function(name, args)
                    await asyncio.sleep(0)
                except Exception as e:
                    error_message = f"Error calling tool {name}: {str(e)}"
                    await broadcast_message("Assistant", f"\n\nError message: {error_message}\n\n")
                    
                    await asyncio.sleep(0)
                    tool_result = error_message

                toolresult = {
                    "role": "tool",
                    "tool_call_id": tool_call["id"] or "",
                    "name": name or "",
                    "content": str(tool_result)
                }
                messages.append(toolresult)

                # Log messages before creating next completion
                logger.info("Debug - Tool call Result: %s", json.dumps(toolresult, indent=2))


            if counter >= 10:
                response_2 = client.chat.completions.create(
                    model="gpt-4o",
                    messages=messages,
                    tools=tools,
                    tool_choice="auto" if counter < 9 else "none",
                    stream=True
                )

                await broadcast_message("Assistant", "\n\nThis is the last response from the assistant. The user has reached the maximum number of responses.\n\n")
                logger.info("Reached maximum number of responses")
            else:
                response_2 = client.chat.completions.create(
                    model="gpt-4o",
                    messages=messages,
                    tools=tools,
                    tool_choice="auto",
                    parallel_tool_calls=False,
                    stream=True
                )

            # Process the streaming response
            assistant_message = {"role": "assistant", "content": ""}
            
            for chunk in response_2:
                delta = chunk.choices[0].delta
                
                if delta.content:
                    content = delta.content
                    assistant_message["content"] += content
                    await broadcast_message("Assistant", content)
                    await asyncio.sleep(0)
                    
                elif hasattr(delta, 'tool_calls') and delta.tool_calls:
                    if "tool_calls" not in assistant_message:
                        assistant_message["tool_calls"] = []
                    
                    for tool_call in delta.tool_calls:
                        tool_call_index = tool_call.index
                        
                        while len(assistant_message["tool_calls"]) <= tool_call_index:
                            assistant_message["tool_calls"].append({
                                "id": "",
                                "type": "function",
                                "function": {"name": "", "arguments": ""}
                            })
                        
                        current_call = assistant_message["tool_calls"][tool_call_index]
                        
                        if hasattr(tool_call, 'id') and tool_call.id is not None:
                            current_call["id"] = tool_call.id
                        
                        if hasattr(tool_call, 'function'):
                            if hasattr(tool_call.function, 'name') and tool_call.function.name is not None:
                                current_call["function"]["name"] = tool_call.function.name
                            if hasattr(tool_call.function, 'arguments') and tool_call.function.arguments is not None:
                                current_call["function"]["arguments"] += tool_call.function.arguments

            if "tool_calls" in assistant_message:
                for call in assistant_message["tool_calls"]:
                    if not call["id"]:
                        call["id"] = ""
                    if not call["function"]["name"]:
                        call["function"]["name"] = ""
                    if not call["function"]["arguments"]:
                        call["function"]["arguments"] = "{}"

            # Log the message structure before appending
            logger.info("Debug - Assistant response: %s", json.dumps(assistant_message, indent=2))
            messages.append(assistant_message)
            tool_calls = assistant_message.get("tool_calls", [])
            counter += 1

        # After processing all tool calls and getting final response
        # Update message history with the complete conversation
        self.message_history = messages.copy()
        #await broadcast_message("System", "process_query_complete")
        logger.info("Agent: Completion message sent")
        return
