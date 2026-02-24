from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, EmailStr


# ---- AUTH / USER ----
class UserBase(BaseModel):
    username: str
    email: str
    role: str = "reader"


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    username: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None


class UserOut(UserBase):
    id: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str


class LoginForm(BaseModel):
    username: str
    password: str


# ---- PROJECT ----
class ProjectBase(BaseModel):
    name: str
    slug: str
    description: Optional[str] = ""
    repo_url: Optional[str] = ""
    branch: Optional[str] = "main"
    git_token: Optional[str] = ""
    ssh_key: Optional[str] = ""


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    description: Optional[str] = None
    repo_url: Optional[str] = None
    branch: Optional[str] = None
    git_token: Optional[str] = None
    ssh_key: Optional[str] = None


class ProjectOut(ProjectBase):
    id: int
    last_status: Optional[str] = ""
    last_commit: Optional[str] = ""
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ---- MENU ITEM ----
class MenuItemBase(BaseModel):
    name: str
    slug: str
    parent_id: Optional[int] = None
    order: Optional[int] = 0
    icon_id: Optional[int] = None


class MenuItemCreate(MenuItemBase):
    project_id: int


class MenuItemUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    parent_id: Optional[int] = None
    order: Optional[int] = None
    icon_id: Optional[int] = None


class MenuItemOut(MenuItemBase):
    id: int
    project_id: int

    class Config:
        from_attributes = True


class MenuItemTree(MenuItemOut):
    children: List["MenuItemTree"] = []

    class Config:
        from_attributes = True


MenuItemTree.model_rebuild()


class MenuReorderItem(BaseModel):
    id: int
    parent_id: Optional[int] = None
    order: int


# ---- TAG ----
class TagBase(BaseModel):
    name: str
    color: Optional[str] = "#667eea"


class TagCreate(TagBase):
    project_id: int


class TagOut(TagBase):
    id: int
    project_id: int
    created_at: datetime

    class Config:
        from_attributes = True


# ---- PREFIX ----
class PrefixBase(BaseModel):
    value: str


class PrefixCreate(PrefixBase):
    project_id: int


class PrefixOut(PrefixBase):
    id: int
    project_id: int
    created_at: datetime

    class Config:
        from_attributes = True


# ---- SUFFIX ----
class SuffixBase(BaseModel):
    value: str


class SuffixCreate(SuffixBase):
    project_id: int


class SuffixOut(SuffixBase):
    id: int
    project_id: int
    created_at: datetime

    class Config:
        from_attributes = True


# ---- ICON ----
class IconOut(BaseModel):
    id: int
    project_id: int
    name: str
    filename: str
    file_path: str
    mime_type: str
    created_at: datetime

    class Config:
        from_attributes = True


# ---- IMAGE ----
class ImageOut(BaseModel):
    id: int
    project_id: int
    article_id: Optional[int] = None
    filename: str
    original_filename: str
    file_path: str
    mime_type: str
    size: int
    alt_text: Optional[str] = ""
    created_at: datetime

    class Config:
        from_attributes = True


# ---- ARTICLE ----
class ArticleBase(BaseModel):
    title: str
    slug: str
    content: Optional[str] = ""
    menu_item_id: Optional[int] = None
    prefix_id: Optional[int] = None
    suffix_id: Optional[int] = None
    icon_id: Optional[int] = None


class ArticleCreate(ArticleBase):
    project_id: int


class ArticleUpdate(BaseModel):
    title: Optional[str] = None
    slug: Optional[str] = None
    content: Optional[str] = None
    menu_item_id: Optional[int] = None
    prefix_id: Optional[int] = None
    suffix_id: Optional[int] = None
    icon_id: Optional[int] = None
    tag_ids: Optional[List[int]] = None


class ArticleOut(ArticleBase):
    id: int
    project_id: int
    created_at: datetime
    updated_at: datetime
    tags: List[TagOut] = []
    prefix: Optional[PrefixOut] = None
    suffix: Optional[SuffixOut] = None
    icon: Optional[IconOut] = None

    class Config:
        from_attributes = True


class ArticleTagUpdate(BaseModel):
    tag_ids: List[int]


# ---- PREVIEW ----
class PreviewRequest(BaseModel):
    content: str
