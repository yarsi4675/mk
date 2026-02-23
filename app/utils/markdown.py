import markdown
from pygments.formatters import HtmlFormatter

EXTENSIONS = [
    "markdown.extensions.fenced_code",
    "markdown.extensions.tables",
    "markdown.extensions.toc",
    "markdown.extensions.nl2br",
    "markdown.extensions.attr_list",
    "markdown.extensions.def_list",
    "markdown.extensions.footnotes",
    "markdown.extensions.admonition",
    "markdown.extensions.codehilite",
    "pymdownx.details",
    "pymdownx.tasklist",
    "pymdownx.superfences",
    "pymdownx.highlight",
    "pymdownx.inlinehilite",
    "pymdownx.emoji",
]

EXTENSION_CONFIGS = {
    "pymdownx.highlight": {
        "use_pygments": True,
        "noclasses": False,
        "pygments_lang_class": True,
    },
    "markdown.extensions.codehilite": {
        "guess_lang": False,
        "use_pygments": True,
    },
    "pymdownx.superfences": {
        "custom_fences": [],
    },
}


def render_markdown(text: str) -> str:
    try:
        md = markdown.Markdown(
            extensions=EXTENSIONS,
            extension_configs=EXTENSION_CONFIGS,
        )
        return md.convert(text)
    except Exception:
        # Fallback with minimal extensions
        md = markdown.Markdown(extensions=["markdown.extensions.fenced_code", "markdown.extensions.tables"])
        return md.convert(text)


def get_pygments_css() -> str:
    formatter = HtmlFormatter(style="monokai")
    return formatter.get_style_defs(".codehilite")
