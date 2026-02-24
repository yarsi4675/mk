# MkDocs CMS

A complete Content Management System for MkDocs documentation, built with FastAPI.

## Features

- 🔐 JWT Authentication with roles (admin/editor/reader)
- 📁 Project management with Git integration
- 🗂️ Hierarchical menu system with drag-and-drop
- 📄 Rich article editor with live preview
- 🏷️ Tag system with color-coded chips
- 🖼️ Image gallery with lightbox
- 💻 Code blocks with syntax highlighting
- 📤 Export to MkDocs format and push to GitHub

## Quick Start

```bash
# Install dependencies
pip install -r requirements.txt

# Copy environment file
cp .env.example .env

# Run the application
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Open http://localhost:8000 in your browser.

Default credentials: **admin** / **admin123**

## Structure

```
app/
  main.py          - FastAPI application entry point
  models.py        - SQLAlchemy database models
  schemas.py       - Pydantic schemas
  auth.py          - JWT authentication
  routers/         - API endpoint routers
  templates/       - Jinja2 HTML templates
  static/          - CSS, JavaScript, uploaded files
  utils/           - Markdown rendering, Git export helpers
```

## API Documentation

Visit http://localhost:8000/docs for interactive API documentation.