import datetime
import json
from sqlalchemy import (
    Column, Integer, String, Text, Boolean, Float, DateTime, ForeignKey, JSON
)
from sqlalchemy.orm import relationship
from backend.database.engine import Base


class Tenant(Base):
    __tablename__ = "tenants"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    slug = Column(String(128), unique=True, nullable=False)
    description = Column(Text, default="")
    settings_json = Column(JSON, default=dict)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    agents = relationship("Agent", back_populates="tenant", cascade="all, delete-orphan")
    workflows = relationship("Workflow", back_populates="tenant", cascade="all, delete-orphan")
    file_assets = relationship("FileAsset", back_populates="tenant", cascade="all, delete-orphan")
    feed_items = relationship("FeedItem", back_populates="tenant", cascade="all, delete-orphan")
    messages = relationship("Message", back_populates="tenant", cascade="all, delete-orphan")
    memory_events = relationship("MemoryEvent", back_populates="tenant", cascade="all, delete-orphan")
    memory_objects = relationship("MemoryObject", back_populates="tenant", cascade="all, delete-orphan")
    agent_memories = relationship("AgentMemory", back_populates="tenant", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="tenant", cascade="all, delete-orphan")
    data_structures = relationship("DataStructure", back_populates="tenant", cascade="all, delete-orphan")
    skills = relationship("Skill", back_populates="tenant", cascade="all, delete-orphan")
    tasks = relationship("Task", back_populates="tenant", cascade="all, delete-orphan")
    goals = relationship("Goal", back_populates="tenant", cascade="all, delete-orphan")


class AgentTenantAccess(Base):
    __tablename__ = "agent_tenant_access"
    id = Column(Integer, primary_key=True, autoincrement=True)
    agent_id = Column(Integer, ForeignKey("agents.id"), nullable=False)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)

class Agent(Base):
    __tablename__ = "agents"
    id = Column(Integer, primary_key=True, autoincrement=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text, default="")
    agent_type = Column(String(64), default="standard")
    system_prompt = Column(Text, default="")
    llm_model = Column(String(128), default="qwen-large")
    llm_temperature = Column(Float, default=0.7)
    llm_config_json = Column(JSON, default=dict)
    system_tools = Column(JSON, default=list)
    allowed_files = Column(JSON, default=list)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    tenant = relationship("Tenant", back_populates="agents")
    workflow_agents = relationship("WorkflowAgent", back_populates="agent", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="agent")
    memory_events = relationship("MemoryEvent", back_populates="agent")
    memory_objects = relationship("MemoryObject", back_populates="agent")
    agent_skills = relationship("AgentSkill", back_populates="agent", cascade="all, delete-orphan")


class WorkflowTenantAccess(Base):
    __tablename__ = "workflow_tenant_access"
    id = Column(Integer, primary_key=True, autoincrement=True)
    workflow_id = Column(Integer, ForeignKey("workflows.id"), nullable=False)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)

class Workflow(Base):
    __tablename__ = "workflows"
    id = Column(Integer, primary_key=True, autoincrement=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    name = Column(String(255), nullable=False)
    slug = Column(String(128), nullable=False)
    description = Column(Text, default="")
    category = Column(String(64), default="custom")
    config_json = Column(JSON, default=dict)
    is_active = Column(Boolean, default=True)
    is_standard = Column(Boolean, default=False)
    has_menu_entry = Column(Boolean, default=False)
    has_feed = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    tenant = relationship("Tenant", back_populates="workflows")
    workflow_agents = relationship("WorkflowAgent", back_populates="workflow", cascade="all, delete-orphan")
    feed_items = relationship("FeedItem", back_populates="workflow")
    data_structures = relationship("DataStructure", back_populates="workflow")
    tasks = relationship("Task", back_populates="workflow")
    triggers = relationship("WorkflowTrigger", back_populates="workflow", cascade="all, delete-orphan")


class WorkflowTrigger(Base):
    __tablename__ = "workflow_triggers"
    id = Column(Integer, primary_key=True, autoincrement=True)
    workflow_id = Column(Integer, ForeignKey("workflows.id"), nullable=False)
    trigger_type = Column(String(64), nullable=False)  # "interval", "folder_watch"
    config_json = Column(JSON, default=dict)
    is_active = Column(Boolean, default=True)
    last_run = Column(DateTime, nullable=True)
    next_run = Column(DateTime, nullable=True)

    workflow = relationship("Workflow", back_populates="triggers")


class WorkflowAgent(Base):
    __tablename__ = "workflow_agents"
    id = Column(Integer, primary_key=True, autoincrement=True)
    workflow_id = Column(Integer, ForeignKey("workflows.id"), nullable=False)
    agent_id = Column(Integer, ForeignKey("agents.id"), nullable=False)
    role = Column(String(128), default="executor")

    workflow = relationship("Workflow", back_populates="workflow_agents")
    agent = relationship("Agent", back_populates="workflow_agents")


class WorkflowMCPModule(Base):
    __tablename__ = "workflow_mcp_modules"
    id = Column(Integer, primary_key=True, autoincrement=True)
    workflow_id = Column(Integer, ForeignKey("workflows.id"), nullable=False)
    mcp_module_id = Column(Integer, ForeignKey("mcp_modules.id"), nullable=False)

    workflow = relationship("Workflow")
    mcp_module = relationship("MCPModule")


class WorkflowDataStructure(Base):
    __tablename__ = "workflow_data_structures"
    id = Column(Integer, primary_key=True, autoincrement=True)
    workflow_id = Column(Integer, ForeignKey("workflows.id"), nullable=False)
    data_structure_id = Column(Integer, ForeignKey("data_structures.id"), nullable=False)
    permission = Column(String(16), default="R")

    workflow = relationship("Workflow")
    data_structure = relationship("DataStructure")


class DataStructureTenantAccess(Base):
    __tablename__ = "data_structure_tenant_access"
    id = Column(Integer, primary_key=True, autoincrement=True)
    data_structure_id = Column(Integer, ForeignKey("data_structures.id"), nullable=False)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)

class DataStructure(Base):
    __tablename__ = "data_structures"
    id = Column(Integer, primary_key=True, autoincrement=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    workflow_id = Column(Integer, ForeignKey("workflows.id"), nullable=True)
    name = Column(String(255), nullable=False)
    slug = Column(String(128), nullable=False)
    description = Column(Text, default="")
    category = Column(String(64), default="custom")
    schema_json = Column(JSON, default=dict)
    is_standard = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    tenant = relationship("Tenant", back_populates="data_structures")
    workflow = relationship("Workflow", back_populates="data_structures")


class FileAsset(Base):
    __tablename__ = "file_assets"
    id = Column(Integer, primary_key=True, autoincrement=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    filename = Column(String(512), nullable=False)
    filepath = Column(String(1024), nullable=False)
    mime_type = Column(String(128), default="application/octet-stream")
    extracted_text = Column(Text, default="")
    page_count = Column(Integer, default=0)
    metadata_json = Column(JSON, default=dict)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    tenant = relationship("Tenant", back_populates="file_assets")


class AgentMemory(Base):
    __tablename__ = "agent_memories"
    id = Column(Integer, primary_key=True, autoincrement=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    key = Column(String(255), nullable=False)
    value = Column(Text, nullable=False)
    context_json = Column(JSON, default=dict)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    tenant = relationship("Tenant", back_populates="agent_memories")

class MemoryEvent(Base):
    __tablename__ = "memory_events"
    id = Column(Integer, primary_key=True, autoincrement=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    agent_id = Column(Integer, ForeignKey("agents.id"), nullable=True)
    event_type = Column(String(128), nullable=False)
    summary = Column(Text, nullable=False)
    context_json = Column(JSON, default=dict)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

    tenant = relationship("Tenant", back_populates="memory_events")
    agent = relationship("Agent", back_populates="memory_events")


class MemoryObject(Base):
    __tablename__ = "memory_objects"
    id = Column(Integer, primary_key=True, autoincrement=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    agent_id = Column(Integer, ForeignKey("agents.id"), nullable=True)
    object_type = Column(String(128), nullable=False)
    object_id = Column(Integer, nullable=False)
    summary = Column(Text, nullable=False)
    context_json = Column(JSON, default=dict)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    tenant = relationship("Tenant", back_populates="memory_objects")
    agent = relationship("Agent", back_populates="memory_objects")


class FeedItem(Base):
    __tablename__ = "feed_items"
    id = Column(Integer, primary_key=True, autoincrement=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    workflow_id = Column(Integer, ForeignKey("workflows.id"), nullable=True)
    agent_id = Column(Integer, ForeignKey("agents.id"), nullable=True)
    category = Column(String(64), default="general")
    title = Column(String(512), nullable=False)
    description = Column(Text, default="")
    priority = Column(Integer, default=0)
    status = Column(String(64), default="pending")
    action_type = Column(String(128), default="info")
    action_data_json = Column(JSON, default=dict)
    result_json = Column(JSON, default=dict)
    feedback_text = Column(Text, default="")
    parent_id = Column(Integer, ForeignKey("feed_items.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)

    tenant = relationship("Tenant", back_populates="feed_items")
    workflow = relationship("Workflow", back_populates="feed_items")
    trace_steps = relationship("AgentTraceStep", back_populates="feed_item", cascade="all, delete-orphan")


class AgentTraceStep(Base):
    __tablename__ = "agent_trace_steps"
    id = Column(Integer, primary_key=True, autoincrement=True)
    feed_item_id = Column(Integer, ForeignKey("feed_items.id"), nullable=False)
    step_number = Column(Integer, nullable=False)
    action = Column(String(255), nullable=False)
    action_input = Column(Text, default="")
    observation = Column(Text, default="")
    thought = Column(Text, default="")
    next_step = Column(Text, default="")
    llm_log_id = Column(Integer, ForeignKey("llm_logs.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    feed_item = relationship("FeedItem", back_populates="trace_steps")


class Message(Base):
    __tablename__ = "messages"
    id = Column(Integer, primary_key=True, autoincrement=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    title = Column(String(512), nullable=False)
    body = Column(Text, default="")
    priority = Column(Integer, default=0)
    is_read = Column(Boolean, default=False)
    feed_item_id = Column(Integer, ForeignKey("feed_items.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    tenant = relationship("Tenant", back_populates="messages")


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True, autoincrement=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    agent_id = Column(Integer, ForeignKey("agents.id"), nullable=True)
    workflow_id = Column(Integer, ForeignKey("workflows.id"), nullable=True)
    action = Column(String(255), nullable=False)
    entity_type = Column(String(128), default="")
    entity_id = Column(Integer, nullable=True)
    details_json = Column(JSON, default=dict)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

    tenant = relationship("Tenant", back_populates="audit_logs")
    agent = relationship("Agent", back_populates="audit_logs")
    workflow = relationship("Workflow")


class A2AModule(Base):
    __tablename__ = "a2a_modules"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    slug = Column(String(128), unique=True, nullable=False)
    description = Column(Text, default="")
    version = Column(String(32), default="1.0.0")
    author = Column(String(255), default="")
    is_active = Column(Boolean, default=False)
    config_json = Column(JSON, default=dict)
    capabilities_json = Column(JSON, default=dict)
    module_path = Column(String(512), default="")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)


class WorkflowA2AModule(Base):
    __tablename__ = "workflow_a2a_modules"
    id = Column(Integer, primary_key=True, autoincrement=True)
    workflow_id = Column(Integer, ForeignKey("workflows.id"), nullable=False)
    a2a_module_id = Column(Integer, ForeignKey("a2a_modules.id"), nullable=False)

    workflow = relationship("Workflow")
    a2a_module = relationship("A2AModule")


class CockpitModule(Base):
    __tablename__ = "cockpit_modules"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    slug = Column(String(128), unique=True, nullable=False)
    description = Column(Text, default="")
    version = Column(String(32), default="1.0.0")
    author = Column(String(255), default="")
    is_active = Column(Boolean, default=False)
    config_json = Column(JSON, default=dict)
    module_path = Column(String(512), default="")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)


class MCPModule(Base):
    __tablename__ = "mcp_modules"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    slug = Column(String(128), unique=True, nullable=False)
    description = Column(Text, default="")
    version = Column(String(32), default="1.0.0")
    author = Column(String(255), default="")
    is_active = Column(Boolean, default=False)
    config_json = Column(JSON, default=dict)
    capabilities_json = Column(JSON, default=dict)
    module_path = Column(String(512), default="")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)


class AppModule(Base):
    __tablename__ = "app_modules"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    slug = Column(String(128), unique=True, nullable=False)
    description = Column(Text, default="")
    version = Column(String(32), default="1.0.0")
    author = Column(String(255), default="")
    is_active = Column(Boolean, default=False)
    config_json = Column(JSON, default=dict)
    input_schema = Column(JSON, default=dict)
    extraction_prompt = Column(Text, default="")
    views_json = Column(JSON, default=dict)
    module_path = Column(String(512), default="")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)


from sqlalchemy import UniqueConstraint

class Setting(Base):
    __tablename__ = "settings"
    __table_args__ = (UniqueConstraint('tenant_id', 'key', name='_tenant_key_uc'),)
    id = Column(Integer, primary_key=True, autoincrement=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=True)
    key = Column(String(255), nullable=False)
    value_json = Column(JSON, default=dict)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)


class Skill(Base):
    __tablename__ = "skills"
    id = Column(Integer, primary_key=True, autoincrement=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text, default="")
    content = Column(Text, nullable=False, default="")
    category = Column(String(64), default="general")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    tenant = relationship("Tenant", back_populates="skills")
    agent_skills = relationship("AgentSkill", back_populates="skill", cascade="all, delete-orphan")


class AgentSkill(Base):
    __tablename__ = "agent_skills"
    id = Column(Integer, primary_key=True, autoincrement=True)
    agent_id = Column(Integer, ForeignKey("agents.id"), nullable=False)
    skill_id = Column(Integer, ForeignKey("skills.id"), nullable=False)

    agent = relationship("Agent", back_populates="agent_skills")
    skill = relationship("Skill", back_populates="agent_skills")


class LLMLog(Base):
    __tablename__ = "llm_logs"
    id = Column(Integer, primary_key=True, autoincrement=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=True)
    agent_id = Column(Integer, ForeignKey("agents.id"), nullable=True)
    model = Column(String(128))
    prompt_raw = Column(Text)
    response_raw = Column(Text)
    duration_ms = Column(Integer)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class Task(Base):
    __tablename__ = "tasks"
    id = Column(Integer, primary_key=True, autoincrement=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    workflow_id = Column(Integer, ForeignKey("workflows.id"), nullable=True)
    assigned_agent_id = Column(Integer, ForeignKey("agents.id"), nullable=True)
    title = Column(String(512), nullable=False)
    description = Column(Text, default="")
    instruction = Column(Text, default="")
    status = Column(String(64), default="open")
    priority = Column(Integer, default=0)
    due_date = Column(DateTime, nullable=True)
    result_json = Column(JSON, default=dict)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    tenant = relationship("Tenant", back_populates="tasks")
    workflow = relationship("Workflow", back_populates="tasks")

class Goal(Base):
    __tablename__ = "goals"
    id = Column(Integer, primary_key=True, autoincrement=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text, default="")
    strategy_prompt = Column(Text, default="")
    status = Column(String(64), default="active")
    agent_id = Column(Integer, ForeignKey("agents.id"), nullable=True)
    milestones_json = Column(JSON, default=list)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    tenant = relationship("Tenant", back_populates="goals")





