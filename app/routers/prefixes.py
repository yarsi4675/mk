from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas
from app.auth import get_current_user

router = APIRouter(tags=["prefixes"])


@router.get("/api/projects/{project_id}/prefixes", response_model=list[schemas.PrefixOut])
def list_prefixes(project_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    return db.query(models.Prefix).filter(models.Prefix.project_id == project_id).all()


@router.post("/api/projects/{project_id}/prefixes", response_model=schemas.PrefixOut)
def create_prefix(
    project_id: int,
    prefix: schemas.PrefixBase,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    p = models.Prefix(project_id=project_id, value=prefix.value)
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


@router.delete("/api/prefixes/{prefix_id}")
def delete_prefix(prefix_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    p = db.query(models.Prefix).filter(models.Prefix.id == prefix_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Prefix not found")
    db.delete(p)
    db.commit()
    return {"message": "Deleted"}
