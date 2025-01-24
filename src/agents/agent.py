from prompt import SYSTEM_MESSAGE_PLANNER, SYSTEM_MESSAGE_EDITOR, GENERATE_RUBRIC
from tools import tools, call_function
import asyncio
import nbformat
from web_server import app, start_server, broadcast_message, broadcast_notebook_update, get_user_input, manager
import uvicorn
from openai import OpenAI
import os
import datetime
import json
from typing import List, Dict, Any

client = OpenAI()

class Agent:
    def __init__(self):
        self.message_history = []

    def clear_history(self):
        """Clear the message history and reset to initial state"""
        self.message_history = []
        return "Message history cleared."

    async def process_query(self, query: str) -> str:

        # Handle special commands
        if query.get("message", "").strip().lower() == "clear_history":
            result = self.clear_history()
            print("Cleared history")
            return result

        if not hasattr(self, 'message_history'):
            self.message_history = []

        selected_cells_content = query.get("selected_cells", "") + f"\n\n<path_to_notebook>{os.environ['CURRENT_NOTEBOOK_PATH']}</path_to_notebook>"
        query = query.get("message", "")

        if len(self.message_history) > 0:
            messages = self.message_history.copy()
            messages.append({"role": "user", "content": selected_cells_content})
            messages.append({"role": "user", "content": query})
        else:
            messages = [
                {"role": "system", "content": SYSTEM_MESSAGE_EDITOR},
                {"role": "user", "content": selected_cells_content, "name": "potential_context"},
                {"role": "user", "content": query}
            ]
            self.message_history = messages.copy()
        
        # Process tool calls and responses with streaming
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=messages,
            tools=tools,
            tool_choice="auto",
            parallel_tool_calls=False,
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
                # Broadcast each content chunk immediately and flush
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
        print("Debug - Assistant message structure:", json.dumps(assistant_message, indent=2))
        messages.append(assistant_message)
        
        tool_calls = assistant_message.get("tool_calls", [])
        counter = 0

        while tool_calls:
            # Process all tool calls
            for tool_call in tool_calls:
                try:
                    name = tool_call["function"]["name"] or ""
                    args = tool_call["function"]["arguments"] or "{}"
                    tool_result = await call_function(name, args)
                    tool_message = f"Calling tool {name} with arguments {args}"
                    await broadcast_message("Assistant", f"\n\n🔧 {tool_message}\n\n")
                    await asyncio.sleep(0)
                except Exception as e:
                    error_message = f"Error calling tool {name}: {str(e)}"
                    await broadcast_message("Assistant", f"\n\nError message: {error_message}\n\n")
                    await asyncio.sleep(0)
                    tool_result = error_message

                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call["id"] or "",
                    "name": name or "",
                    "content": str(tool_result)
                })

            # Log messages before creating next completion
            print("Debug - Messages before next completion:", json.dumps(messages, indent=2))
            if counter == 5:
                # Get the next assistant response with streaming
                response_2 = client.chat.completions.create(
                    model="gpt-4o",
                    messages=messages,
                    tools=tools,
                    tool_choice="none",
                    stream=True
                )

                await broadcast_message("Assistant", "\n\nThis is the last response from the assistant. The user has reached the maximum number of responses.\n\n")

            else:
                # Get the next assistant response with streaming
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
            print("Debug - Assistant message structure (after tool calls):", json.dumps(assistant_message, indent=2))
            messages.append(assistant_message)
            
            #if assistant_message.get("tool_calls"):
            #    await broadcast_message("Assistant", f"\n\nThis is the {counter + 1}. loop\n\n")
            #    await asyncio.sleep(0)
            
            tool_calls = assistant_message.get("tool_calls", [])
            counter += 1

        # After processing all tool calls and getting final response
        # Update message history with the complete conversation
        self.message_history = messages.copy()
        return

# Function to update notebook display
async def update_notebook_display(notebook_path: str):
    try:
        # Read the notebook
        with open(notebook_path, 'r', encoding='utf-8') as f:
            nb = nbformat.read(f, as_version=4)
        
        # Convert cells to a format suitable for display
        cells = []
        for cell in nb.cells:
            cells.append({
                'cell_type': cell.cell_type,
                'source': cell.source,
                'metadata': cell.metadata
            })
        
        # Broadcast the update
        await broadcast_notebook_update(cells)
    except Exception as e:
        print(f"Error updating notebook display: {e}")
        await broadcast_message("System", f"Error updating notebook: {e}")


# Run the conversation and stream to the console and web interface
async def main():
    # Try different ports if the default one is in use
    port = 8765
    max_retries = 5
    server = None
    agent = Agent()  # Create an instance of Agent
    
    for attempt in range(max_retries):
        try:
            config = uvicorn.Config(app, host="127.0.0.1", port=port, log_level="error")
            server = uvicorn.Server(config)
            
            # Start the server in a separate task
            server_task = asyncio.create_task(server.serve())
            
            print(f"Server starting on http://localhost:{port}")
            
            # Give the server a moment to start
            await asyncio.sleep(1)
            
            if not server_task.done():  # If server started successfully
                print("Waiting for client connection...")
                
                # Wait for client connection
                connection_timeout = 30  # seconds
                start_time = asyncio.get_event_loop().time()
                
                while not manager.active_connections:
                    if asyncio.get_event_loop().time() - start_time > connection_timeout:
                        print("Timeout waiting for client connection")
                        await server.shutdown()
                        return
                    await asyncio.sleep(0.1)
                
                print("Client connected.")
                await broadcast_message("System", "Ready to process queries.")
                
                try:
                    while True:
                        try:
                            user_input = await get_user_input()
                            print(f"Processing input: {user_input}")
                            await broadcast_message("System", "Processing your request...")
                            result = await agent.process_query(user_input)  # Pass the agent instance
                            await broadcast_message("System", "Query processing complete")
                        except Exception as e:
                            print(f"Error during conversation: {e}")
                            await broadcast_message("System", f"Error: {e}")
                            continue
                finally:
                    # Cleanup
                    if server:
                        await server.shutdown()
                
                break  # Exit the retry loop if everything worked
            
        except Exception as e:
            if "address already in use" in str(e).lower():
                print(f"Port {port} is in use, trying next port...")
                port += 1
                if attempt == max_retries - 1:
                    print("Could not find an available port")
                    return
            else:
                print(f"Unexpected error: {e}")
                raise

async def broadcast_message(agent: str, message: str):
    data = {
        "type": "message",
        "agent": agent,
        "content": message,
        "timestamp": datetime.datetime.now().isoformat()
    }
    await manager.broadcast(data)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nShutting down gracefully...")
    except SystemExit:
        print("\nServer shutdown requested...")
    except Exception as e:
        print(f"Unexpected error: {e}")