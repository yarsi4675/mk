from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime

from app.database import get_db
from app import models, schemas
from app.auth import get_current_user

router = APIRouter(prefix="/api/projects", tags=["projects"])


def _require_project(project_id: int, db: Session) -> models.Project:
    p = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    return p


@router.get("", response_model=list[schemas.ProjectOut])
def list_projects(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return db.query(models.Project).all()


@router.post("", response_model=schemas.ProjectOut)
def create_project(
    proj: schemas.ProjectCreate,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    if db.query(models.Project).filter(models.Project.slug == proj.slug).first():
        raise HTTPException(status_code=400, detail="Slug already exists")
    p = models.Project(**proj.model_dump())
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


@router.get("/{project_id}", response_model=schemas.ProjectOut)
def get_project(project_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    return _require_project(project_id, db)


@router.put("/{project_id}", response_model=schemas.ProjectOut)
def update_project(
    project_id: int,
    proj: schemas.ProjectUpdate,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    p = _require_project(project_id, db)
    for field, value in proj.model_dump(exclude_none=True).items():
        setattr(p, field, value)
    p.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(p)
    return p


@router.delete("/{project_id}")
def delete_project(project_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    p = _require_project(project_id, db)
    db.delete(p)
    db.commit()
    return {"message": "Deleted"}
