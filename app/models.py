from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Text, Boolean, DateTime,
    ForeignKey, Table, BigInteger
)
from sqlalchemy.orm import relationship
from app.database import Base

# Many-to-many: articles <-> tags
article_tags = Table(
    "article_tags",
    Base.metadata,
    Column("article_id", Integer, ForeignKey("articles.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", Integer, ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(100), unique=True, index=True, nullable=False)
    email = Column(String(200), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(20), default="reader")  # admin, editor, reader
    created_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    slug = Column(String(200), unique=True, index=True, nullable=False)
    description = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Git settings
    repo_url = Column(String(500), default="")
    branch = Column(String(100), default="main")
    git_token = Column(String(500), default="")
    ssh_key = Column(Text, default="")
    last_status = Column(String(50), default="")
    last_commit = Column(String(500), default="")

    menu_items = relationship("MenuItem", back_populates="project", cascade="all, delete-orphan")
    articles = relationship("Article", back_populates="project", cascade="all, delete-orphan")
    tags = relationship("Tag", back_populates="project", cascade="all, delete-orphan")
    images = relationship("Image", back_populates="project", cascade="all, delete-orphan")
    prefixes = relationship("Prefix", back_populates="project", cascade="all, delete-orphan")
    suffixes = relationship("Suffix", back_populates="project", cascade="all, delete-orphan")
    icons = relationship("Icon", back_populates="project", cascade="all, delete-orphan")


class MenuItem(Base):
    __tablename__ = "menu_items"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    parent_id = Column(Integer, ForeignKey("menu_items.id", ondelete="SET NULL"), nullable=True)
    name = Column(String(200), nullable=False)
    slug = Column(String(200), nullable=False)
    order = Column(Integer, default=0)
    icon_id = Column(Integer, ForeignKey("icons.id", ondelete="SET NULL"), nullable=True)

    project = relationship("Project", back_populates="menu_items")
    parent = relationship("MenuItem", remote_side="MenuItem.id", back_populates="children")
    children = relationship("MenuItem", back_populates="parent", cascade="all, delete-orphan")
    articles = relationship("Article", back_populates="menu_item")
    icon = relationship("Icon", foreign_keys=[icon_id])


class Article(Base):
    __tablename__ = "articles"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    menu_item_id = Column(Integer, ForeignKey("menu_items.id", ondelete="SET NULL"), nullable=True)
    title = Column(String(500), nullable=False)
    slug = Column(String(500), nullable=False)
    content = Column(Text, default="")
    prefix_id = Column(Integer, ForeignKey("prefixes.id", ondelete="SET NULL"), nullable=True)
    suffix_id = Column(Integer, ForeignKey("suffixes.id", ondelete="SET NULL"), nullable=True)
    icon_id = Column(Integer, ForeignKey("icons.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    project = relationship("Project", back_populates="articles")
    menu_item = relationship("MenuItem", back_populates="articles")
    prefix = relationship("Prefix", back_populates="articles")
    suffix = relationship("Suffix", back_populates="articles")
    icon = relationship("Icon", foreign_keys=[icon_id])
    tags = relationship("Tag", secondary=article_tags, back_populates="articles")
    images = relationship("Image", back_populates="article")


class Tag(Base):
    __tablename__ = "tags"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)
    color = Column(String(7), default="#667eea")
    created_at = Column(DateTime, default=datetime.utcnow)

    project = relationship("Project", back_populates="tags")
    articles = relationship("Article", secondary=article_tags, back_populates="tags")


class Prefix(Base):
    __tablename__ = "prefixes"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    value = Column(String(100), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    project = relationship("Project", back_populates="prefixes")
    articles = relationship("Article", back_populates="prefix")


class Suffix(Base):
    __tablename__ = "suffixes"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    value = Column(String(100), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    project = relationship("Project", back_populates="suffixes")
    articles = relationship("Article", back_populates="suffix")


class Icon(Base):
    __tablename__ = "icons"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(200), nullable=False)
    filename = Column(String(300), nullable=False)
    file_path = Column(String(500), nullable=False)
    mime_type = Column(String(100), default="image/png")
    created_at = Column(DateTime, default=datetime.utcnow)

    project = relationship("Project", back_populates="icons")


class Image(Base):
    __tablename__ = "images"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    article_id = Column(Integer, ForeignKey("articles.id", ondelete="SET NULL"), nullable=True)
    filename = Column(String(300), nullable=False)
    original_filename = Column(String(300), nullable=False)
    file_path = Column(String(500), nullable=False)
    mime_type = Column(String(100), default="image/jpeg")
    size = Column(BigInteger, default=0)
    alt_text = Column(String(500), default="")
    created_at = Column(DateTime, default=datetime.utcnow)

    project = relationship("Project", back_populates="images")
    article = relationship("Article", back_populates="images")
