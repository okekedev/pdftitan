"""
pytest configuration — loads .env before any tests run.
"""
from pathlib import Path

from dotenv import load_dotenv


def pytest_configure(config):
    env_path = Path(__file__).parent.parent.parent / ".env"
    load_dotenv(env_path)
