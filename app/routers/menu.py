from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.auth import get_current_user

router = APIRouter(tags=["menu"])


def _build_tree(items: list, parent_id=None) -> list:
    result = []
    for item in items:
        if item.parent_id == parent_id:
            node = schemas.MenuItemTree.model_validate(item)
            node.children = _build_tree(items, item.id)
            result.append(node)
    result.sort(key=lambda x: x.order)
    return result


@router.get("/api/projects/{project_id}/menu", response_model=List[schemas.MenuItemTree])
def get_menu(project_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    items = db.query(models.MenuItem).filter(models.MenuItem.project_id == project_id).all()
    return _build_tree(items)


@router.post("/api/projects/{project_id}/menu", response_model=schemas.MenuItemOut)
def create_menu_item(
    project_id: int,
    item: schemas.MenuItemCreate,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    m = models.MenuItem(
        project_id=project_id,
        name=item.name,
        slug=item.slug,
        parent_id=item.parent_id,
        order=item.order,
        icon_id=item.icon_id,
    )
    db.add(m)
    db.commit()
    db.refresh(m)
    return m


@router.put("/api/menu/{item_id}", response_model=schemas.MenuItemOut)
def update_menu_item(
    item_id: int,
    item: schemas.MenuItemUpdate,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    m = db.query(models.MenuItem).filter(models.MenuItem.id == item_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Menu item not found")
    for field, value in item.model_dump(exclude_none=True).items():
        setattr(m, field, value)
    db.commit()
    db.refresh(m)
    return m


@router.delete("/api/menu/{item_id}")
def delete_menu_item(
    item_id: int,
    move_articles_to: int = None,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    m = db.query(models.MenuItem).filter(models.MenuItem.id == item_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Menu item not found")

    if move_articles_to is not None:
        db.query(models.Article).filter(models.Article.menu_item_id == item_id).update(
            {"menu_item_id": move_articles_to}
        )
    else:
        db.query(models.Article).filter(models.Article.menu_item_id == item_id).update(
            {"menu_item_id": None}
        )

    db.delete(m)
    db.commit()
    return {"message": "Deleted"}


@router.post("/api/menu/reorder")
def reorder_menu(
    items: List[schemas.MenuReorderItem],
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    for item_data in items:
        m = db.query(models.MenuItem).filter(models.MenuItem.id == item_data.id).first()
        if m:
            m.parent_id = item_data.parent_id
            m.order = item_data.order
    db.commit()
    return {"message": "Reordered"}
