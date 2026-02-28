"""
PDF generation service — replaces pdf-lib usage.
Strategy: build a reportlab overlay per page, merge with pypdf.

Coordinate conversion (same as Node):
  pdf_y = page_height - element_y - element_height + 1
"""
import base64
import io
import re

from PIL import Image
from pypdf import PdfReader, PdfWriter
from reportlab.lib.colors import HexColor, black
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas as rl_canvas


def generate_filled_pdf(original_pdf_bytes: bytes, objects: list[dict]) -> bytes:
    writer = PdfWriter(clone_from=io.BytesIO(original_pdf_bytes))

    for page_num, page in enumerate(writer.pages, start=1):
        page_elements = [o for o in objects if o.get("page", 1) == page_num]
        if not page_elements:
            continue

        page_height = float(page.mediabox.height)
        page_width = float(page.mediabox.width)
        overlay_bytes = _build_overlay(page_elements, page_height, page_width)
        overlay_reader = PdfReader(io.BytesIO(overlay_bytes))
        if overlay_reader.pages:
            page.merge_page(overlay_reader.pages[0])

    output = io.BytesIO()
    writer.write(output)
    return output.getvalue()


def _build_overlay(
    elements: list[dict], page_height: float, page_width: float
) -> bytes:
    buf = io.BytesIO()
    c = rl_canvas.Canvas(buf, pagesize=(page_width, page_height))

    for element in elements:
        try:
            el_type = element.get("type", "")
            x = float(element.get("x") or 0)
            y = float(element.get("y") or 0)
            width = float(element.get("width") or 100)
            height = float(element.get("height") or 20)
            content = element.get("content", "")
            font_size = float(element.get("fontSize") or 11)

            # Hex color — ensure leading #
            color_str = element.get("color") or "#1e3a8a"
            if not color_str.startswith("#"):
                color_str = "#" + color_str

            # Coordinate conversion: top-left origin → bottom-left (PDF) origin
            pdf_y = page_height - y - height + 1

            if el_type in ("text", "date", "timestamp"):
                _draw_text(c, content, x, pdf_y, font_size, color_str)

            elif el_type == "checkbox":
                is_checked = content is True or content == "true" or content == 1
                if is_checked:
                    _draw_text(c, "X", x, pdf_y, font_size, color_str)

            elif el_type == "signature":
                if (
                    content
                    and isinstance(content, str)
                    and content.startswith("data:image/")
                ):
                    _draw_signature(c, content, x, pdf_y, width, height, page_width)

        except Exception as e:
            print(f"[pdf_service] Element render error ({element.get('type')}): {e}")

    c.save()
    buf.seek(0)
    return buf.getvalue()


def _draw_text(
    c: rl_canvas.Canvas,
    content,
    x: float,
    pdf_y: float,
    font_size: float,
    color_str: str,
) -> None:
    if not content or not str(content).strip():
        return
    try:
        color = HexColor(color_str)
    except Exception:
        color = black

    c.setFillColor(color)
    c.setFont("Helvetica", font_size)
    content_str = str(content)
    lines = content_str.split("\n")
    for i, line in enumerate(lines):
        if line.strip():
            c.drawString(x, pdf_y - (i * font_size), line.strip())


def _draw_signature(
    c: rl_canvas.Canvas,
    content: str,
    x: float,
    pdf_y: float,
    width: float,
    height: float,
    page_width: float,
) -> None:
    try:
        base64_data = re.sub(r"^data:image/[a-z]+;base64,", "", content)
        img_bytes = base64.b64decode(base64_data)
        img = Image.open(io.BytesIO(img_bytes))

        # Scale to fit within element bounds (max height 60pt, same as Node)
        img_ratio = img.width / img.height
        draw_width = min(width, page_width - x - 10)
        draw_height = min(height, 60.0)

        if draw_height > 0 and (draw_width / img_ratio) > draw_height:
            draw_width_final = draw_height * img_ratio
            draw_height_final = draw_height
        else:
            draw_width_final = draw_width
            draw_height_final = draw_width / img_ratio if img_ratio > 0 else draw_height

        img_io = io.BytesIO()
        img.save(img_io, format="PNG")
        img_io.seek(0)

        c.drawImage(
            ImageReader(img_io),
            x,
            pdf_y,
            width=draw_width_final,
            height=draw_height_final,
            mask="auto",
        )
    except Exception as e:
        print(f"[pdf_service] Signature render error: {e}")
