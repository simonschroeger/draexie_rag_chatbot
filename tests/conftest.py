import sys
import os
import pytest

# Make the project root importable so `from rag import RAGPipeline` works
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from rag import RAGPipeline


@pytest.fixture(scope="session")
def pipeline():
    """Single RAGPipeline instance shared across all tests in the session."""
    return RAGPipeline()
