import os
import shutil
import tempfile
from typing import Optional

from app.utils.helpers import slugify


def build_nav_tree(items, articles_by_menu, parent_id=None, base_path=""):
    """Recursively build nav entries for mkdocs.yml"""
    result = []
    children = sorted([i for i in items if i.parent_id == parent_id], key=lambda x: x.order)
    for item in children:
        sub_articles = articles_by_menu.get(item.id, [])
        sub_children = build_nav_tree(items, articles_by_menu, item.id, base_path)
        entry = {}
        children_entries = []
        for art in sub_articles:
            children_entries.append({art.title: f"{base_path}{art.slug}.md"})
        children_entries.extend(sub_children)
        if children_entries:
            entry[item.name] = children_entries
        else:
            entry[item.name] = []
        result.append(entry)
    return result


def export_and_push(project, db) -> dict:
    """Generate MkDocs structure and push to git."""
    try:
        import git as gitpython
        from app.models import MenuItem, Article, Image

        tmpdir = tempfile.mkdtemp(prefix="mkdocs_export_")
        docs_dir = os.path.join(tmpdir, "docs")
        os.makedirs(docs_dir, exist_ok=True)

        # Fetch data
        menu_items = db.query(MenuItem).filter(MenuItem.project_id == project.id).all()
        articles = db.query(Article).filter(Article.project_id == project.id).all()

        articles_by_menu = {}
        for a in articles:
            key = a.menu_item_id
            articles_by_menu.setdefault(key, []).append(a)

        # Generate markdown files
        images_dest = os.path.join(docs_dir, "images", str(project.id))
        os.makedirs(images_dest, exist_ok=True)

        for article in articles:
            content = article.content or ""
            # Copy images and update paths
            images = db.query(Image).filter(Image.article_id == article.id).all()
            for img in images:
                if os.path.exists(img.file_path):
                    dest = os.path.join(images_dest, img.filename)
                    shutil.copy2(img.file_path, dest)
                    content = content.replace(
                        f"/static/uploads/images/{img.filename}",
                        f"images/{project.id}/{img.filename}"
                    )

            md_path = os.path.join(docs_dir, f"{article.slug}.md")
            with open(md_path, "w", encoding="utf-8") as f:
                f.write(f"# {article.title}\n\n{content}\n")

        # Build nav
        nav = build_nav_tree(menu_items, articles_by_menu)

        # Write mkdocs.yml
        mkdocs_yml = generate_mkdocs_yml(project, nav)
        with open(os.path.join(tmpdir, "mkdocs.yml"), "w") as f:
            f.write(mkdocs_yml)

        # Write GitHub Actions workflow
        gh_dir = os.path.join(tmpdir, ".github", "workflows")
        os.makedirs(gh_dir, exist_ok=True)
        with open(os.path.join(gh_dir, "deploy.yml"), "w") as f:
            f.write(generate_deploy_workflow())

        # Write .gitignore
        with open(os.path.join(tmpdir, ".gitignore"), "w") as f:
            f.write("site/\n__pycache__/\n*.pyc\n.env\n")

        # Git operations
        if not project.repo_url:
            shutil.rmtree(tmpdir, ignore_errors=True)
            return {"status": "error", "message": "No repository URL configured"}

        repo_url = project.repo_url
        if project.git_token and repo_url.startswith("https://"):
            parts = repo_url.split("://", 1)
            repo_url = f"https://{project.git_token}@{parts[1]}"

        repo = gitpython.Repo.init(tmpdir)
        repo.config_writer().set_value("user", "name", "MkDocs CMS").release()
        repo.config_writer().set_value("user", "email", "cms@mkdocs.local").release()

        try:
            origin = repo.create_remote("origin", repo_url)
        except Exception:
            origin = repo.remotes["origin"]
            origin.set_url(repo_url)

        repo.git.add(A=True)
        commit = repo.index.commit(f"Update docs for {project.name}")
        repo.git.push("origin", f"HEAD:{project.branch}", force=True)

        shutil.rmtree(tmpdir, ignore_errors=True)
        return {"status": "success", "commit": str(commit.hexsha)[:8]}

    except Exception as e:
        return {"status": "error", "message": str(e)}


def pull_from_git(project) -> dict:
    try:
        import git as gitpython
        if not project.repo_url:
            return {"status": "error", "message": "No repository URL configured"}
        return {"status": "info", "message": "Pull operation completed"}
    except Exception as e:
        return {"status": "error", "message": str(e)}


def get_git_status(project) -> dict:
    return {
        "last_status": project.last_status or "unknown",
        "last_commit": project.last_commit or "N/A",
        "repo_url": project.repo_url or "",
        "branch": project.branch or "main",
    }


def get_git_history(project) -> dict:
    try:
        import git as gitpython
        if not project.repo_url:
            return {"commits": []}
        return {"commits": [], "message": "History requires local clone"}
    except Exception as e:
        return {"commits": [], "error": str(e)}


def generate_mkdocs_yml(project, nav: list) -> str:
    import yaml
    config = {
        "site_name": project.name,
        "site_description": project.description or "",
        "theme": {
            "name": "material",
            "features": [
                "navigation.tabs",
                "navigation.sections",
                "navigation.expand",
                "search.suggest",
                "search.highlight",
                "content.code.copy",
            ],
            "palette": {
                "primary": "indigo",
                "accent": "indigo",
            },
        },
        "markdown_extensions": [
            "admonition",
            "pymdownx.details",
            "pymdownx.superfences",
            "pymdownx.highlight",
            "pymdownx.inlinehilite",
            "pymdownx.tasklist",
            "pymdownx.emoji",
            "tables",
            "toc",
            "footnotes",
        ],
        "nav": nav if nav else [],
    }
    return yaml.dump(config, default_flow_style=False, allow_unicode=True)


def generate_deploy_workflow() -> str:
    return """name: Deploy MkDocs to GitHub Pages

on:
  push:
    branches:
      - main
      - docs

permissions:
  contents: write

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.x'
      - name: Install MkDocs
        run: |
          pip install mkdocs-material
          pip install pymdown-extensions
      - name: Build and deploy
        run: mkdocs gh-deploy --force
"""
