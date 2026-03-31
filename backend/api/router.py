from fastapi import APIRouter
from backend.api import tenants
from backend.api import agents
from backend.api import workflows
from backend.api import files
from backend.api import feed
from backend.api import messages
from backend.api import memory
from backend.api import audit
from backend.api import data_structures
from backend.api import mcp_api
from backend.api import a2a_api
from backend.api import cockpit_api
from backend.api import settings_api
from backend.api import tasks
from backend.api import skills
from backend.api import llm_logs
from backend.api import tools
from backend.api import goals
from backend.api import app_modules_api
from backend.api import wizard_api

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(tenants.router, prefix="/tenants", tags=["Mandanten"])
api_router.include_router(agents.router, prefix="/agents", tags=["Agenten"])
api_router.include_router(workflows.router, prefix="/workflows", tags=["Workflows"])
api_router.include_router(files.router, prefix="/files", tags=["Dateien"])
api_router.include_router(feed.router, prefix="/feed", tags=["Feed"])
api_router.include_router(messages.router, prefix="/messages", tags=["Nachrichten"])
api_router.include_router(memory.router, prefix="/memory", tags=["Memory"])
api_router.include_router(audit.router, prefix="/audit", tags=["Audit"])
api_router.include_router(data_structures.router, prefix="/data-structures", tags=["Datenstrukturen"])
api_router.include_router(mcp_api.router, prefix="/mcp-modules", tags=["MCP-Module"])
api_router.include_router(a2a_api.router, prefix="/a2a-modules", tags=["A2A-Module"])
api_router.include_router(cockpit_api.router, prefix="/cockpit-modules", tags=["Cockpit-Module"])
api_router.include_router(app_modules_api.router, prefix="/app-modules", tags=["App-Module"])
api_router.include_router(settings_api.router, prefix="/settings", tags=["Einstellungen"])
api_router.include_router(skills.router, prefix="/skills", tags=["Skills"])
api_router.include_router(tasks.router, prefix="/tasks", tags=["Aufgaben"])
api_router.include_router(llm_logs.router, prefix="/llm-logs", tags=["System-Logs"])
api_router.include_router(tools.router, prefix="/tools", tags=["Tools"])
api_router.include_router(goals.router, prefix="/goals", tags=["Ziele"])
api_router.include_router(wizard_api.router, prefix="/wizard", tags=["Workflow-Wizard"])




