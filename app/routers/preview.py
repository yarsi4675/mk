from fastapi import APIRouter, Depends
from app import schemas
from app.auth import get_current_user
from app.utils.markdown import render_markdown

router = APIRouter(tags=["preview"])


@router.post("/api/preview")
def preview_markdown(req: schemas.PreviewRequest, _=Depends(get_current_user)):
    return {"html": render_markdown(req.content)}
