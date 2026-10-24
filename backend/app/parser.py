import io
import csv
import os
import json
import zipfile
from typing import Tuple, Dict, Any, List, Optional
import pandas as pd

def sniff_delimiter(sample_text: str) -> str:
    """Sniffs the delimiter of a text file (comma, tab, semicolon, pipe)."""
    try:
        sniffer = csv.Sniffer()
        dialect = sniffer.sniff(sample_text[:4096])
        if dialect.delimiter in [',', '\t', ';', '|']:
            return dialect.delimiter
    except Exception:
        pass

    # Heuristic fallback based on frequency in first few lines
    lines = sample_text.splitlines()[:10]
    candidates = [',', '\t', ';', '|']
    scores = {c: 0 for c in candidates}
    for line in lines:
        for c in candidates:
            scores[c] += line.count(c)
    best = max(scores, key=scores.get)
    return best if scores[best] > 0 else ','

def detect_encoding(raw_bytes: bytes) -> str:
    """Detects encoding by trying standard encodings."""
    # latin-1 / iso-8859-1 never raise, so they must be last
    for enc in ['utf-8', 'utf-8-sig', 'cp1252', 'iso-8859-1', 'latin1']:
        try:
            raw_bytes[:8192].decode(enc)
            return enc
        except UnicodeDecodeError:
            continue
    return 'utf-8'

def json_records_to_dataframe(records: List[Any]) -> pd.DataFrame:
    """
    Builds a DataFrame from a list of JSON records. Nested objects become flat columns
    ({"b": {"x": 1}} -> column "b.x"); any list/dict left in a cell is stored as a JSON string
    so every cell is hashable (needed for duplicate detection and value counts).
    """
    if records and all(isinstance(r, dict) for r in records):
        df = pd.json_normalize(records, sep=".")
    else:
        df = pd.DataFrame(records)
    for col in df.columns:
        if df[col].dtype == object:
            df[col] = df[col].map(
                lambda v: json.dumps(v, ensure_ascii=False) if isinstance(v, (list, dict)) else v
            )
    return df


def parse_json_text(text: str, filename: str) -> pd.DataFrame:
    """Parses a JSON document (list of records, or an object wrapping one) or JSON Lines."""
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        # Not one JSON document: try JSON Lines (one record per line)
        try:
            records = [json.loads(line) for line in text.splitlines() if line.strip()]
        except json.JSONDecodeError as e:
            raise ValueError(f"File '{filename}' is not valid JSON or JSON Lines ({e.msg} at line {e.lineno}).") from e
        return json_records_to_dataframe(records)

    if isinstance(data, list):
        return json_records_to_dataframe(data)
    if isinstance(data, dict):
        # Try records, data, or items if present
        for key in ['data', 'records', 'items', 'rows']:
            if key in data and isinstance(data[key], list):
                return json_records_to_dataframe(data[key])
        return json_records_to_dataframe([data])
    raise ValueError(f"File '{filename}' must contain a JSON list of records or an object, not a single value.")


def load_file_to_dataframe(file_bytes: bytes, filename: str, sheet: Optional[str] = None) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """
    Parses incoming raw file bytes into a clean pandas DataFrame.
    Supports CSV, TSV, TXT, Excel (XLSX, XLS), JSON (records/split/lines), Parquet, Feather.
    `sheet` picks an Excel sheet by name (default: the first sheet).
    """
    ext = os.path.splitext(filename)[1].lower()
    file_size_kb = round(len(file_bytes) / 1024, 2)
    metadata: Dict[str, Any] = {
        "filename": filename,
        "extension": ext,
        "file_size_kb": file_size_kb,
        "detected_encoding": "unknown",
        "detected_delimiter": None,
        "format": ext.replace(".", "")
    }

    df: pd.DataFrame

    if ext in ['.csv', '.tsv', '.txt', '.tab']:
        encoding = detect_encoding(file_bytes)
        metadata["detected_encoding"] = encoding
        sample_text = file_bytes[:10000].decode(encoding, errors='ignore')
        
        if ext in ['.tsv', '.tab']:
            delimiter = '\t'
        else:
            delimiter = sniff_delimiter(sample_text)
            
        metadata["detected_delimiter"] = delimiter
        metadata["format"] = "tsv" if delimiter == '\t' else "csv"

        df = pd.read_csv(
            io.BytesIO(file_bytes),
            delimiter=delimiter,
            encoding=encoding,
            on_bad_lines='skip',
            low_memory=False
        )

    elif ext in ['.xlsx', '.xls']:
        metadata["format"] = "excel"
        try:
            excel_file = pd.ExcelFile(io.BytesIO(file_bytes))
        except (ValueError, zipfile.BadZipFile) as e:
            raise ValueError(f"File '{filename}' is not a valid Excel workbook.") from e
        if sheet is not None and sheet not in excel_file.sheet_names:
            raise ValueError(f"Sheet '{sheet}' not found. Available sheets: {', '.join(excel_file.sheet_names)}")
        sheet_name = sheet if sheet is not None else excel_file.sheet_names[0]
        metadata["sheet_name"] = sheet_name
        metadata["all_sheets"] = excel_file.sheet_names
        df = pd.read_excel(excel_file, sheet_name=sheet_name)

    elif ext in ['.json', '.jsonl', '.ndjson']:
        metadata["format"] = "json"
        encoding = detect_encoding(file_bytes)
        metadata["detected_encoding"] = encoding
        text = file_bytes.decode(encoding, errors='ignore')
        df = parse_json_text(text, filename)

    elif ext in ['.parquet', '.pqt']:
        metadata["format"] = "parquet"
        df = pd.read_parquet(io.BytesIO(file_bytes))

    elif ext in ['.feather', '.arrow']:
        metadata["format"] = "feather"
        df = pd.read_feather(io.BytesIO(file_bytes))

    else:
        # Fallback: attempt CSV parsing
        encoding = detect_encoding(file_bytes)
        metadata["detected_encoding"] = encoding
        sample_text = file_bytes[:10000].decode(encoding, errors='ignore')
        delimiter = sniff_delimiter(sample_text)
        metadata["detected_delimiter"] = delimiter
        metadata["format"] = "csv"
        df = pd.read_csv(
            io.BytesIO(file_bytes),
            delimiter=delimiter,
            encoding=encoding,
            on_bad_lines='skip',
            low_memory=False
        )

    # Standardize column headers: stringify, strip whitespace, ensure uniqueness
    cleaned_columns = []
    seen = {}
    for idx, col in enumerate(df.columns):
        col_str = str(col).strip() if col is not None else f"feature_{idx}"
        if not col_str:
            col_str = f"feature_{idx}"
        if col_str in seen:
            seen[col_str] += 1
            col_str = f"{col_str}_{seen[col_str]}"
        else:
            seen[col_str] = 0
        cleaned_columns.append(col_str)

    df.columns = cleaned_columns

    metadata["rows"] = int(len(df))
    metadata["columns"] = int(len(df.columns))

    return df, metadata
