# Jupyter-Assistant
A web editor inspired by Cursor that uses large language models (LLM) to enhance Jupyter Notebook assignments.

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

## Deployment

1. Clone the repository:
```bash
git clone https://github.com/guyq1997/Jupyter-Assistant
cd Jupyter-Assistant
```

2. Create and activate a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Set up environment variables:
Create a `.env` file in the project root with:
```
OPENAI_API_KEY=your_api_key_here
```
5. Set up nltk packages
```bash
python -m nltk.downloader all
```
or
```bash
sudo python -m nltk.downloader -d /usr/share/nltk_data all
```

6. Start the FastAPI backend:
Run the following command to start the backend server:
```bash
python src/agents/agent.py
```

7. Navigate to the frontend directory and install frontend dependencies:
```bash
cd frontend
npm install
```

8. Start the React frontend:
Run the following command to start the frontend development server:
```bash
npm start
```

9. Access the application:
Open your web browser and go to [http://localhost:3000](http://localhost:3000) to view the application.

Now you should have the Jupyter-Assistant application running on your local machine!

## License

This project is licensed under the MIT License - see the LICENSE file for details.
