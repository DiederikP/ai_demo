"""
Workflow Progress Tracker - Stores real-time progress during debate execution
"""
from typing import Dict, List, Optional
import time
from datetime import datetime

# In-memory store for progress (in production, use Redis or similar)
_progress_store: Dict[str, Dict] = {}

def create_progress_session(session_id: str) -> None:
    """Create a new progress session"""
    _progress_store[session_id] = {
        'start_time': time.time(),
        'steps': [],
        'current_step': None,
        'status': 'running',
        'message': 'Initializing...'
    }

def update_progress(session_id: str, step: str, agent: str, duration: float, message: str = None):
    """Update progress for a specific step"""
    if session_id not in _progress_store:
        create_progress_session(session_id)
    
    step_data = {
        'step': step,
        'agent': agent,
        'duration': duration,
        'timestamp': time.time(),
        'message': message or f"{agent} executing {step}"
    }
    
    _progress_store[session_id]['steps'].append(step_data)
    _progress_store[session_id]['current_step'] = step
    _progress_store[session_id]['message'] = message or f"{agent} executing {step}"

def get_progress(session_id: str) -> Optional[Dict]:
    """Get current progress for a session"""
    return _progress_store.get(session_id)

def complete_progress(session_id: str, total_duration: float):
    """Mark progress as complete"""
    if session_id in _progress_store:
        _progress_store[session_id]['status'] = 'completed'
        _progress_store[session_id]['total'] = total_duration
        _progress_store[session_id]['end_time'] = time.time()

def clear_progress(session_id: str):
    """Clear progress for a session (cleanup)"""
    if session_id in _progress_store:
        del _progress_store[session_id]

