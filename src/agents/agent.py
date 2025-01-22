from prompt import SYSTEM_MESSAGE_PLANNER, SYSTEM_MESSAGE_EDITOR, GENERATE_RUBRIC
from tools import tools, call_function
import asyncio
import nbformat
from web_server import app, start_server, broadcast_message, broadcast_notebook_update, get_user_input, manager
import uvicorn
from openai import OpenAI

client = OpenAI()

async def process_query(self, query: str) -> str:
    messages_plan = [
        {"role": "system", "content": SYSTEM_MESSAGE_PLANNER},
        {"role": "user", "content": query}
    ]
    
    # Get initial plan (non-streaming)
    response_plan = client.chat.completions.create(
        model="gpt-4o",
        messages=messages_plan,
        tools=tools,
        tool_choice="none"
    )

    plan_content = response_plan.choices[0].message.content
    await broadcast_message("Assistant", plan_content)

    messages = [
        {"role": "system", "content": SYSTEM_MESSAGE_EDITOR},
        {"role": "user", "content": query},
        {"role": "assistant", "content": plan_content},
        {"role": "user", "content": "Please execute the plan."}
    ]

    # Process tool calls and responses
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=messages,
        tools=tools,
        tool_choice="auto",
    )

    try:
        tool_calls = response.choices[0].message.tool_calls
        # Add assistant's message to conversation before tool responses
        messages.append({
            "role": "assistant",
            "content": response.choices[0].message.content,
            "tool_calls": tool_calls
        })
    except:
        tool_calls = None
        messages.append({
            "role": "assistant",
            "content": response.choices[0].message.content
        })
    
    response_content = response.choices[0].message.content
    await broadcast_message("Assistant", response_content)
    
    counter = 0

    while tool_calls and counter <= 3:
        for tool_call in tool_calls:
            name = tool_call.function.name
            args = tool_call.function.arguments
            try:
                tool_result = call_function(name, args)
                tool_message = f"[Calling tool {name} with args {args}]"
                await broadcast_message("Assistant", tool_message)
                await broadcast_message("Assistant", f"Tool result: {tool_result}")
            except Exception as e:
                error_message = f"Error calling tool {name}: {str(e)}"
                await broadcast_message("Assistant", error_message)
                tool_result = error_message

            messages.append({
                "role": "tool",
                "tool_call_id": tool_call.id,
                "content": str(tool_result)  # Ensure tool result is string
            })

        response_2 = client.chat.completions.create(
            model="gpt-4o",
            messages=messages,
            tools=tools,
            tool_choice="auto"
        )

        tool_calls = response_2.choices[0].message.tool_calls
        response2_content = response_2.choices[0].message.content
        
        # Add assistant's message with tool_calls if present
        if tool_calls:
            messages.append({
                "role": "assistant",
                "content": response2_content,
                "tool_calls": tool_calls
            })
        else:
            messages.append({
                "role": "assistant",
                "content": response2_content
            })
            
        await broadcast_message("Assistant", response2_content)
        counter += 1

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
                            result = await process_query(None, user_input)
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

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nShutting down gracefully...")
    except SystemExit:
        print("\nServer shutdown requested...")
    except Exception as e:
        print(f"Unexpected error: {e}")