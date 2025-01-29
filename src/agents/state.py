"""Global state management for the application."""

# This will hold the global manager instance
_manager = None

def get_manager():
    """Get the global manager instance."""
    global _manager
    return _manager

def set_manager(manager):
    """Set the global manager instance."""
    global _manager
    _manager = manager 