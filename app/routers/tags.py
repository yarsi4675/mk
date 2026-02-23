from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas
from app.auth import get_current_user

router = APIRouter(tags=["tags"])


@router.get("/api/projects/{project_id}/tags", response_model=list[schemas.TagOut])
def list_tags(project_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    return db.query(models.Tag).filter(models.Tag.project_id == project_id).all()


@router.post("/api/projects/{project_id}/tags", response_model=schemas.TagOut)
def create_tag(
    project_id: int,
    tag: schemas.TagBase,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    t = models.Tag(project_id=project_id, name=tag.name, color=tag.color)
    db.add(t)
    db.commit()
    db.refresh(t)
    return t


@router.put("/api/tags/{tag_id}", response_model=schemas.TagOut)
def update_tag(
    tag_id: int,
    tag: schemas.TagBase,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    t = db.query(models.Tag).filter(models.Tag.id == tag_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Tag not found")
    t.name = tag.name
    t.color = tag.color
    db.commit()
    db.refresh(t)
    return t


@router.delete("/api/tags/{tag_id}")
def delete_tag(tag_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    t = db.query(models.Tag).filter(models.Tag.id == tag_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Tag not found")
    db.delete(t)
    db.commit()
    return {"message": "Deleted"}
