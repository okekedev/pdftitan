"""
Excel parser stub — reads TCEQ city/PWS data from the Excel template if present,
otherwise returns empty data. The Excel templates live at backend-py/forms/.
"""
import os
from pathlib import Path

_TEMPLATE_DIR = Path(__file__).parent.parent / "forms"


def _load_cities() -> dict:
    """Load city data from Excel template, returning {} if template is missing."""
    template_path = _TEMPLATE_DIR / "TCEQ_Cities.xlsx"
    if not template_path.exists():
        return {}

    try:
        import openpyxl  # noqa: PLC0415

        wb = openpyxl.load_workbook(template_path, read_only=True, data_only=True)
        ws = wb.active
        cities = {}
        headers = None
        for row in ws.iter_rows(values_only=True):
            if headers is None:
                headers = [str(h).strip() if h else "" for h in row]
                continue
            if not row or not row[0]:
                continue
            city_row = dict(zip(headers, row))
            city_name = str(city_row.get("City", "") or "").strip()
            if city_name:
                cities[city_name.lower()] = {
                    "cityCode": city_name,
                    "pwsName": str(city_row.get("PWS Name", "") or ""),
                    "pwsId": str(city_row.get("PWS ID", "") or ""),
                    "pwsAddress": str(city_row.get("PWS Address", "") or ""),
                    "pwsContact": str(city_row.get("PWS Contact", "") or ""),
                }
        wb.close()
        return cities
    except Exception as e:
        print(f"[excel_parser] Failed to load cities: {e}")
        return {}


_cities: dict | None = None


def _get_cities() -> dict:
    global _cities
    if _cities is None:
        _cities = _load_cities()
    return _cities


def get_all_cities() -> list:
    return list(_get_cities().values())


def get_city_info(city_code: str) -> dict | None:
    if not city_code:
        return None
    return _get_cities().get(city_code.lower())


def parse_form_fields() -> list:
    """Return TCEQ form field definitions. Stubbed — extend if template is available."""
    return [
        {"name": "Text Field", "label": "PWS Name", "type": "text"},
        {"name": "Text Field_1", "label": "PWS ID", "type": "text"},
        {"name": "Text Field_2", "label": "PWS Address", "type": "text"},
        {"name": "Text Field_3", "label": "PWS Contact", "type": "text"},
        {"name": "Text Field_4", "label": "Service Address", "type": "text"},
        {"name": "Text Field_5", "label": "Manufacturer", "type": "text"},
        {"name": "Text Field_6", "label": "Model", "type": "text"},
        {"name": "Text Field_7", "label": "Serial Number", "type": "text"},
        {"name": "Text Field_8", "label": "Size", "type": "text"},
        {"name": "Text Field_9", "label": "Test Date", "type": "text"},
        {"name": "Text Field_10", "label": "Test Time", "type": "text"},
        {"name": "Check Box", "label": "DC", "type": "checkbox"},
        {"name": "Check Box_1", "label": "RPZ", "type": "checkbox"},
    ]
