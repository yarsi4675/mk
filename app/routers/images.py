import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas
from app.auth import get_current_user
from app.config import UPLOAD_DIR

router = APIRouter(tags=["images"])

IMAGES_DIR = os.path.join(UPLOAD_DIR, "images")


@router.get("/api/projects/{project_id}/images", response_model=list[schemas.ImageOut])
def list_images(
    project_id: int,
    article_id: int = Query(None),
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    q = db.query(models.Image).filter(models.Image.project_id == project_id)
    if article_id is not None:
        q = q.filter(models.Image.article_id == article_id)
    return q.all()


@router.post("/api/projects/{project_id}/images", response_model=schemas.ImageOut)
async def upload_image(
    project_id: int,
    article_id: int = Form(None),
    alt_text: str = Form(""),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    os.makedirs(IMAGES_DIR, exist_ok=True)
    ext = os.path.splitext(file.filename)[1]
    filename = f"{uuid.uuid4()}{ext}"
    file_path = os.path.join(IMAGES_DIR, filename)
    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    image = models.Image(
        project_id=project_id,
        article_id=article_id,
        filename=filename,
        original_filename=file.filename,
        file_path=file_path,
        mime_type=file.content_type or "image/jpeg",
        size=len(content),
        alt_text=alt_text or file.filename,
    )
    db.add(image)
    db.commit()
    db.refresh(image)
    return image


@router.delete("/api/images/{image_id}")
def delete_image(image_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    img = db.query(models.Image).filter(models.Image.id == image_id).first()
    if not img:
        raise HTTPException(status_code=404, detail="Image not found")
    try:
        if os.path.exists(img.file_path):
            os.remove(img.file_path)
    except OSError:
        pass
    db.delete(img)
    db.commit()
    return {"message": "Deleted"}


@router.post("/api/images/{image_id}/assign", response_model=schemas.ImageOut)
def assign_image(
    image_id: int,
    article_id: int = Query(...),
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    img = db.query(models.Image).filter(models.Image.id == image_id).first()
    if not img:
        raise HTTPException(status_code=404, detail="Image not found")
    img.article_id = article_id
    db.commit()
    db.refresh(img)
    return img
