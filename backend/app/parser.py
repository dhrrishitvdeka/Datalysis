import io
import csv
import os
import json
from typing import Tuple, Dict, Any
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

def load_file_to_dataframe(file_bytes: bytes, filename: str) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """
    Parses incoming raw file bytes into a clean pandas DataFrame.
    Supports CSV, TSV, TXT, Excel (XLSX, XLS), JSON (records/split/lines), Parquet, Feather.
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
        excel_file = pd.ExcelFile(io.BytesIO(file_bytes))
        sheet_name = excel_file.sheet_names[0]
        metadata["sheet_name"] = sheet_name
        metadata["all_sheets"] = excel_file.sheet_names
        df = excel_file.parse(sheet_name)

    elif ext in ['.json', '.jsonl', '.ndjson']:
        metadata["format"] = "json"
        encoding = detect_encoding(file_bytes)
        metadata["detected_encoding"] = encoding
        text = file_bytes.decode(encoding, errors='ignore')
        
        try:
            # Try reading as JSON records or standard json
            data = json.loads(text)
            if isinstance(data, list):
                df = pd.DataFrame(data)
            elif isinstance(data, dict):
                # Try records, data, or items if present
                for key in ['data', 'records', 'items', 'rows']:
                    if key in data and isinstance(data[key], list):
                        df = pd.DataFrame(data[key])
                        break
                else:
                    df = pd.DataFrame([data])
            else:
                df = pd.read_json(io.StringIO(text))
        except Exception:
            # Fallback to json lines
            df = pd.read_json(io.StringIO(text), lines=True)

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
