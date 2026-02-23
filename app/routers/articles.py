from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.auth import get_current_user

router = APIRouter(tags=["articles"])


@router.get("/api/projects/{project_id}/articles", response_model=List[schemas.ArticleOut])
def list_articles(
    project_id: int,
    menu_item_id: Optional[int] = Query(None),
    search: Optional[str] = Query(None),
    tag_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    q = db.query(models.Article).filter(models.Article.project_id == project_id)
    if menu_item_id is not None:
        q = q.filter(models.Article.menu_item_id == menu_item_id)
    if search:
        q = q.filter(
            (models.Article.title.ilike(f"%{search}%")) |
            (models.Article.content.ilike(f"%{search}%"))
        )
    if tag_id:
        q = q.filter(models.Article.tags.any(models.Tag.id == tag_id))
    return q.all()


@router.post("/api/projects/{project_id}/articles", response_model=schemas.ArticleOut)
def create_article(
    project_id: int,
    article: schemas.ArticleCreate,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    a = models.Article(
        project_id=project_id,
        title=article.title,
        slug=article.slug,
        content=article.content or "",
        menu_item_id=article.menu_item_id,
        prefix_id=article.prefix_id,
        suffix_id=article.suffix_id,
        icon_id=article.icon_id,
    )
    db.add(a)
    db.commit()
    db.refresh(a)
    return a


@router.get("/api/articles/{article_id}", response_model=schemas.ArticleOut)
def get_article(article_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    a = db.query(models.Article).filter(models.Article.id == article_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Article not found")
    return a


@router.put("/api/articles/{article_id}", response_model=schemas.ArticleOut)
def update_article(
    article_id: int,
    article: schemas.ArticleUpdate,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    a = db.query(models.Article).filter(models.Article.id == article_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Article not found")

    update_data = article.model_dump(exclude_none=True)
    tag_ids = update_data.pop("tag_ids", None)

    for field, value in update_data.items():
        setattr(a, field, value)

    if tag_ids is not None:
        tags = db.query(models.Tag).filter(models.Tag.id.in_(tag_ids)).all()
        a.tags = tags

    a.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(a)
    return a


@router.delete("/api/articles/{article_id}")
def delete_article(
    article_id: int,
    delete_images: bool = Query(False),
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    import os
    a = db.query(models.Article).filter(models.Article.id == article_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Article not found")

    images = db.query(models.Image).filter(models.Image.article_id == article_id).all()
    if delete_images:
        for img in images:
            try:
                if os.path.exists(img.file_path):
                    os.remove(img.file_path)
            except OSError:
                pass
            db.delete(img)
    else:
        for img in images:
            img.article_id = None

    db.delete(a)
    db.commit()
    return {"message": "Deleted"}


@router.post("/api/articles/{article_id}/tags", response_model=schemas.ArticleOut)
def set_article_tags(
    article_id: int,
    tag_update: schemas.ArticleTagUpdate,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    a = db.query(models.Article).filter(models.Article.id == article_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Article not found")
    tags = db.query(models.Tag).filter(models.Tag.id.in_(tag_update.tag_ids)).all()
    a.tags = tags
    db.commit()
    db.refresh(a)
    return a


@router.delete("/api/articles/{article_id}/tags/{tag_id}", response_model=schemas.ArticleOut)
def remove_article_tag(
    article_id: int,
    tag_id: int,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    a = db.query(models.Article).filter(models.Article.id == article_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Article not found")
    a.tags = [t for t in a.tags if t.id != tag_id]
    db.commit()
    db.refresh(a)
    return a


@router.get("/api/search", response_model=List[schemas.ArticleOut])
def search_articles(
    q: str = Query(""),
    project_id: Optional[int] = Query(None),
    tag_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    query = db.query(models.Article)
    if project_id:
        query = query.filter(models.Article.project_id == project_id)
    if q:
        query = query.filter(
            (models.Article.title.ilike(f"%{q}%")) |
            (models.Article.content.ilike(f"%{q}%"))
        )
    if tag_id:
        query = query.filter(models.Article.tags.any(models.Tag.id == tag_id))
    return query.limit(50).all()
