from duckduckgo_search import DDGS
import time

def search_with_retry(query, max_results=10, max_retries=3):
    """
    Search using DuckDuckGo and return results with URLs and text snippets.
    """
    for attempt in range(max_retries):

        try:
            with DDGS() as ddgs:
                results = list(ddgs.text(query, max_results=max_results))
                
            if not results:
                return "No results found"
            
            # Format results into a readable string
            formatted_results = []
            for i, r in enumerate(results, 1):
                formatted_results.append(f"\n=== Result {i} ===")
                formatted_results.append(f"URL: {r.get('href', 'N/A')}")
                formatted_results.append(f"Title: {r.get('title', 'N/A')}")
                formatted_results.append(f"Snippet: {r.get('body', 'N/A')}")
            
            return "\n".join(formatted_results)
                
        except Exception as e:
            if attempt == max_retries - 1:  # If last attempt
                return f"Search failed after {max_retries} attempts: {str(e)}"
            time.sleep(1)  # Wait 1 second before retry