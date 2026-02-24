import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas
from app.auth import get_current_user
from app.config import UPLOAD_DIR

router = APIRouter(tags=["icons"])

ICONS_DIR = os.path.join(UPLOAD_DIR, "icons")


@router.get("/api/projects/{project_id}/icons", response_model=list[schemas.IconOut])
def list_icons(project_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    return db.query(models.Icon).filter(models.Icon.project_id == project_id).all()


@router.post("/api/projects/{project_id}/icons", response_model=schemas.IconOut)
async def upload_icon(
    project_id: int,
    name: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    os.makedirs(ICONS_DIR, exist_ok=True)
    ext = os.path.splitext(file.filename)[1]
    filename = f"{uuid.uuid4()}{ext}"
    file_path = os.path.join(ICONS_DIR, filename)
    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    icon = models.Icon(
        project_id=project_id,
        name=name,
        filename=filename,
        file_path=file_path,
        mime_type=file.content_type or "image/png",
    )
    db.add(icon)
    db.commit()
    db.refresh(icon)
    return icon


@router.delete("/api/icons/{icon_id}")
def delete_icon(icon_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    icon = db.query(models.Icon).filter(models.Icon.id == icon_id).first()
    if not icon:
        raise HTTPException(status_code=404, detail="Icon not found")
    try:
        if os.path.exists(icon.file_path):
            os.remove(icon.file_path)
    except OSError:
        pass
    db.delete(icon)
    db.commit()
    return {"message": "Deleted"}
