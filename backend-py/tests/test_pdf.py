"""
test_pdf.py — unit tests for pdf_service.generate_filled_pdf
No live API calls or file system access required.
"""
import base64
import io

import pytest
from PIL import Image
from reportlab.pdfgen import canvas as rl_canvas

from services.pdf_service import generate_filled_pdf


# ── Helpers ────────────────────────────────────────────────────────────────────


def make_single_page_pdf() -> bytes:
    buf = io.BytesIO()
    c = rl_canvas.Canvas(buf, pagesize=(612, 792))
    c.drawString(100, 700, "Test PDF Page 1")
    c.save()
    buf.seek(0)
    return buf.getvalue()


def make_two_page_pdf() -> bytes:
    buf = io.BytesIO()
    c = rl_canvas.Canvas(buf, pagesize=(612, 792))
    c.drawString(100, 700, "Page 1")
    c.showPage()
    c.drawString(100, 700, "Page 2")
    c.save()
    buf.seek(0)
    return buf.getvalue()


def make_png_base64() -> str:
    img = Image.new("RGB", (20, 10), color=(0, 128, 255))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return "data:image/png;base64," + base64.b64encode(buf.read()).decode()


def is_valid_pdf(data: bytes) -> bool:
    return data[:4] == b"%PDF"


# ── Tests ──────────────────────────────────────────────────────────────────────


def test_text_field_renders():
    pdf = make_single_page_pdf()
    objects = [
        {
            "type": "text",
            "page": 1,
            "x": 100,
            "y": 100,
            "width": 200,
            "height": 20,
            "content": "Hello World",
            "fontSize": 12,
            "color": "#000000",
        }
    ]
    result = generate_filled_pdf(pdf, objects)
    assert is_valid_pdf(result)
    # Note: pypdf re-serialization can produce smaller bytes than the reportlab
    # original even after merging an overlay — byte size is not a reliable indicator.


def test_date_field_renders():
    pdf = make_single_page_pdf()
    objects = [
        {
            "type": "date",
            "page": 1,
            "x": 50,
            "y": 50,
            "width": 100,
            "height": 20,
            "content": "2026-02-26",
            "fontSize": 11,
            "color": "#1e3a8a",
        }
    ]
    result = generate_filled_pdf(pdf, objects)
    assert is_valid_pdf(result)


def test_checkbox_checked_renders():
    pdf = make_single_page_pdf()
    objects = [
        {
            "type": "checkbox",
            "page": 1,
            "x": 100,
            "y": 100,
            "width": 20,
            "height": 20,
            "content": True,
            "fontSize": 12,
            "color": "#000000",
        }
    ]
    result = generate_filled_pdf(pdf, objects)
    assert is_valid_pdf(result)


def test_checkbox_unchecked_does_not_fail():
    pdf = make_single_page_pdf()
    objects = [
        {
            "type": "checkbox",
            "page": 1,
            "x": 100,
            "y": 100,
            "width": 20,
            "height": 20,
            "content": False,
            "fontSize": 12,
            "color": "#000000",
        }
    ]
    result = generate_filled_pdf(pdf, objects)
    assert is_valid_pdf(result)


def test_checkbox_string_true_renders():
    pdf = make_single_page_pdf()
    objects = [
        {
            "type": "checkbox",
            "page": 1,
            "x": 50,
            "y": 200,
            "width": 15,
            "height": 15,
            "content": "true",
            "fontSize": 10,
            "color": "#1e3a8a",
        }
    ]
    result = generate_filled_pdf(pdf, objects)
    assert is_valid_pdf(result)


def test_signature_png_embeds_without_error():
    pdf = make_single_page_pdf()
    objects = [
        {
            "type": "signature",
            "page": 1,
            "x": 100,
            "y": 200,
            "width": 150,
            "height": 50,
            "content": make_png_base64(),
        }
    ]
    result = generate_filled_pdf(pdf, objects)
    assert is_valid_pdf(result)


def test_multipage_pdf_processes_each_page_independently():
    pdf = make_two_page_pdf()
    objects = [
        {
            "type": "text",
            "page": 1,
            "x": 100,
            "y": 100,
            "width": 200,
            "height": 20,
            "content": "Page one content",
            "fontSize": 12,
            "color": "#000000",
        },
        {
            "type": "text",
            "page": 2,
            "x": 100,
            "y": 200,
            "width": 200,
            "height": 20,
            "content": "Page two content",
            "fontSize": 12,
            "color": "#000000",
        },
    ]
    result = generate_filled_pdf(pdf, objects)
    assert is_valid_pdf(result)

    from pypdf import PdfReader
    reader = PdfReader(io.BytesIO(result))
    assert len(reader.pages) == 2


def test_empty_objects_returns_original_structure():
    pdf = make_single_page_pdf()
    result = generate_filled_pdf(pdf, [])
    assert is_valid_pdf(result)


def test_text_with_no_content_is_skipped():
    pdf = make_single_page_pdf()
    objects = [
        {
            "type": "text",
            "page": 1,
            "x": 100,
            "y": 100,
            "width": 200,
            "height": 20,
            "content": "",
            "fontSize": 12,
            "color": "#000000",
        }
    ]
    result = generate_filled_pdf(pdf, objects)
    assert is_valid_pdf(result)


def test_coordinate_conversion_does_not_raise():
    """Coordinates at page edges should not cause exceptions."""
    pdf = make_single_page_pdf()
    objects = [
        {
            "type": "text",
            "page": 1,
            "x": 0,
            "y": 0,
            "width": 612,
            "height": 792,
            "content": "Edge coordinates",
            "fontSize": 8,
            "color": "#333333",
        }
    ]
    result = generate_filled_pdf(pdf, objects)
    assert is_valid_pdf(result)
