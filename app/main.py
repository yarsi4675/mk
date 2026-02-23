import os
from fastapi import FastAPI, Request, Depends, HTTPException
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session

from app.database import engine, get_db
from app import models
from app.auth import create_default_admin, get_current_user_optional
from app.routers import auth, projects, menu, articles, tags, prefixes, suffixes, icons, images, git, preview

# Create all tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="MkDocs CMS", version="1.0.0")

# Static files
app.mount("/static", StaticFiles(directory="app/static"), name="static")

# Templates
templates = Jinja2Templates(directory="app/templates")

# Include routers
app.include_router(auth.router)
app.include_router(projects.router)
app.include_router(menu.router)
app.include_router(articles.router)
app.include_router(tags.router)
app.include_router(prefixes.router)
app.include_router(suffixes.router)
app.include_router(icons.router)
app.include_router(images.router)
app.include_router(git.router)
app.include_router(preview.router)


@app.on_event("startup")
def startup_event():
    db = next(get_db())
    try:
        create_default_admin(db)
    finally:
        db.close()


@app.get("/", response_class=RedirectResponse)
def root():
    return RedirectResponse(url="/dashboard")


@app.get("/login", response_class=HTMLResponse)
def login_page(request: Request):
    return templates.TemplateResponse("login.html", {"request": request})


@app.get("/dashboard", response_class=HTMLResponse)
def dashboard(request: Request, db: Session = Depends(get_db)):
    user = get_current_user_optional(request, db)
    if not user:
        return RedirectResponse(url="/login")
    return templates.TemplateResponse("dashboard.html", {"request": request, "user": user})


@app.get("/projects/{project_id}/settings", response_class=HTMLResponse)
def project_settings(project_id: int, request: Request, db: Session = Depends(get_db)):
    user = get_current_user_optional(request, db)
    if not user:
        return RedirectResponse(url="/login")
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404)
    return templates.TemplateResponse("project_settings.html", {"request": request, "user": user, "project": project})


@app.get("/projects/{project_id}/articles/{article_id}/edit", response_class=HTMLResponse)
def article_edit(project_id: int, article_id: int, request: Request, db: Session = Depends(get_db)):
    user = get_current_user_optional(request, db)
    if not user:
        return RedirectResponse(url="/login")
    article = db.query(models.Article).filter(models.Article.id == article_id).first()
    if not article:
        raise HTTPException(status_code=404)
    return templates.TemplateResponse("article_edit.html", {"request": request, "user": user, "article": article})
