# Jupyter-Assistant
A web editor inspired by Cursor that uses large language models (LLM) to enhance Jupyter Notebook assignments.

## Demo Video

[![Jupyter-Assistant Demo](https://img.youtube.com/vi/WVLLtWDX8tE/0.jpg)](https://www.youtube.com/watch?v=WVLLtWDX8tE)

Click the image above to watch a demonstration of Jupyter-Assistant in action.

## Challenges with Editing Jupyter Notebooks
Developing projects like web applications requires managing numerous scripts, typically using IDEs for efficiency. While Cursor leverages LLMs for code generation, it struggles with Jupyter Notebooks because they are long JSON files, making AI-driven editing error-prone and inefficient.

In educational and research settings, step-by-step code comprehension and real-time feedback are crucial, making Jupyter Notebooks the preferred tool. To overcome Cursor's limitations, Jupyter-Assistant is designed to facilitate easy cell-by-cell modifications using LLMs, allowing for seamless content generation and copy-pasting without manual repetition.

## Jupyter Editor Introduction

- **Text Editor Interface**:
  - Similar to editors like Atom
  - Edits local Jupyter Notebook content without executing code
  - Code execution available via Jupyter Lab

- **Cell Selection and Context**:
  - Directly select Jupyter Notebook cells as context for the model
  - Input requirements for the large language model to generate content

- **User-Friendly Modifications**:
  - Apply changes with a single click
  - Facilitates prompt-oriented programming, akin to Cursor's chat mode

- **Enhanced Capabilities**:
  - Integrates an agent instead of a standard LLM
  - Utilizes tools for:
    - Searching notebook content
    - Editing cells
    - Performing web searches and web scraping

- **Intelligent Task Management**:
  - Features a scheduling mechanism that operates in a loop
  - Handles user requests by using appropriate tools
  - Progresses step-by-step, continuing based on current context until the task is completed or cannot proceed
  
## Docker Deployment

### Prerequisites
- Docker installed on your system
- Git to clone the repository

### Quick Start
1. Clone the repository:
   ```bash
   git clone https://github.com/guyq1997/Jupyter-Assistant.git
   cd Jupyter-Assistant
   ```

2. Build the Docker image:
   ```bash
   docker build -t notebook-assistant .
   ```

3. Run the container:
   ```bash
   docker run -p 8765:8765 notebook-assistant --OPENAI_API_KEY=<your-api-key>
   ```

4. Access the application:
   - Open your web browser and navigate to `http://localhost:8765`
   - The WebSocket endpoint will be available at `ws://localhost:8765/ws`

## License

This project is licensed under the MIT License - see the LICENSE file for details.

