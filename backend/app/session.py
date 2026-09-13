"""
Session Manager for Datalysis
Provides thread-safe, multi-user session isolation with LRU eviction and TTL expiration.
"""

import time
import uuid
import threading
from dataclasses import dataclass, field
from typing import Dict, Any, Optional
import pandas as pd


@dataclass
class DatasetSession:
    session_id: str
    raw_df: Optional[pd.DataFrame] = None
    cleaned_df: Optional[pd.DataFrame] = None
    metadata: Optional[Dict[str, Any]] = None
    facts: Optional[Dict[str, Any]] = None
    inference: Optional[Dict[str, Any]] = None
    pipeline_code: Optional[str] = None
    cleaning_report: Optional[Dict[str, Any]] = None
    custom_recipe: Optional[Dict[str, Any]] = None
    target_variable: Optional[str] = None
    target_analysis: Optional[Dict[str, Any]] = None
    created_at: float = field(default_factory=time.time)
    last_accessed: float = field(default_factory=time.time)

    def touch(self) -> None:
        self.last_accessed = time.time()

    def is_expired(self, ttl_seconds: float) -> bool:
        return (time.time() - self.last_accessed) > ttl_seconds


class SessionStore:
    """Thread-safe in-memory session manager with TTL expiration and LRU eviction."""

    def __init__(self, ttl_seconds: float = 7200.0, max_sessions: int = 150):
        self.ttl_seconds = ttl_seconds
        self.max_sessions = max_sessions
        self._sessions: Dict[str, DatasetSession] = {}
        self._lock = threading.RLock()

    def get_or_create(self, session_id: Optional[str] = None) -> DatasetSession:
        with self._lock:
            self._cleanup_expired_locked()
            if session_id and session_id in self._sessions:
                sess = self._sessions[session_id]
                sess.touch()
                return sess
            
            sid = session_id if (session_id and len(session_id.strip()) > 0) else str(uuid.uuid4())
            if len(self._sessions) >= self.max_sessions:
                self._evict_lru_locked()

            new_sess = DatasetSession(session_id=sid)
            self._sessions[sid] = new_sess
            return new_sess

    def get(self, session_id: str) -> Optional[DatasetSession]:
        with self._lock:
            sess = self._sessions.get(session_id)
            if sess:
                if sess.is_expired(self.ttl_seconds):
                    del self._sessions[session_id]
                    return None
                sess.touch()
            return sess

    def create(self, session_id: Optional[str] = None) -> DatasetSession:
        with self._lock:
            self._cleanup_expired_locked()
            sid = session_id if (session_id and len(session_id.strip()) > 0) else str(uuid.uuid4())
            if len(self._sessions) >= self.max_sessions:
                self._evict_lru_locked()
            sess = DatasetSession(session_id=sid)
            self._sessions[sid] = sess
            return sess

    def delete(self, session_id: str) -> bool:
        with self._lock:
            if session_id in self._sessions:
                del self._sessions[session_id]
                return True
            return False

    def count(self) -> int:
        with self._lock:
            return len(self._sessions)

    def clear(self) -> None:
        with self._lock:
            self._sessions.clear()

    def _cleanup_expired_locked(self) -> None:
        now = time.time()
        expired = [sid for sid, sess in self._sessions.items() if (now - sess.last_accessed) > self.ttl_seconds]
        for sid in expired:
            del self._sessions[sid]

    def _evict_lru_locked(self) -> None:
        if not self._sessions:
            return
        oldest_sid = min(self._sessions.keys(), key=lambda sid: self._sessions[sid].last_accessed)
        del self._sessions[oldest_sid]


# Global session manager instance
session_manager = SessionStore(ttl_seconds=7200.0, max_sessions=150)
