from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas
from app.auth import get_current_user

router = APIRouter(tags=["suffixes"])


@router.get("/api/projects/{project_id}/suffixes", response_model=list[schemas.SuffixOut])
def list_suffixes(project_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    return db.query(models.Suffix).filter(models.Suffix.project_id == project_id).all()


@router.post("/api/projects/{project_id}/suffixes", response_model=schemas.SuffixOut)
def create_suffix(
    project_id: int,
    suffix: schemas.SuffixBase,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    s = models.Suffix(project_id=project_id, value=suffix.value)
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


@router.delete("/api/suffixes/{suffix_id}")
def delete_suffix(suffix_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    s = db.query(models.Suffix).filter(models.Suffix.id == suffix_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Suffix not found")
    db.delete(s)
    db.commit()
    return {"message": "Deleted"}
