import os
import shutil
import tempfile
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import models
from app.auth import get_current_user
from app.utils.git_export import export_and_push, pull_from_git, get_git_status, get_git_history

router = APIRouter(tags=["git"])


@router.post("/api/projects/{project_id}/git/push")
def git_push(project_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    result = export_and_push(project, db)
    project.last_status = result.get("status", "")
    project.last_commit = result.get("commit", "")
    db.commit()
    return result


@router.post("/api/projects/{project_id}/git/pull")
def git_pull(project_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return pull_from_git(project)


@router.get("/api/projects/{project_id}/git/status")
def git_status(project_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return get_git_status(project)


@router.get("/api/projects/{project_id}/git/history")
def git_history(project_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return get_git_history(project)
