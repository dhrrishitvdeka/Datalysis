"""
Datalysis Command-Line Interface (CLI)
Entrypoint for `datalysis launch`, `datalysis audit <file>` and `datalysis clean <file> -o <out>`.
Output is plain ASCII text so it works on Windows consoles that use cp1252.
"""

import os
import sys
import json
import argparse

# File extension -> export format understood by exporter.export_dataframe
FORMAT_BY_EXTENSION = {
    ".csv": "csv",
    ".xlsx": "excel",
    ".xls": "excel",
    ".parquet": "parquet",
    ".db": "sqlite",
    ".sqlite": "sqlite",
    ".sqlite3": "sqlite",
}


def say(message: str = "", error: bool = False) -> None:
    """Prints without ever crashing on characters the console encoding cannot show (e.g. a column named in Hindi)."""
    stream = sys.stderr if error else sys.stdout
    encoding = stream.encoding or "ascii"
    print(message.encode(encoding, errors="replace").decode(encoding), file=stream)


def cmd_launch(args):
    import uvicorn
    host = args.host or "127.0.0.1"
    port = args.port or 8000
    say(f"Launching Datalysis on http://{host}:{port}")
    uvicorn.run("backend.app.main:app", host=host, port=port, reload=args.reload)


def print_repairs(repairs) -> None:
    if not repairs:
        say("Data-quality repairs: none needed")
        return
    say(f"Data-quality repairs: {len(repairs)}")
    for r in repairs:
        say(f"  [{r['rule_id']}] {r['rule_name']} - column '{r['column']}': {r['affected_count']} cell(s)")


def cmd_audit(args):
    if not os.path.exists(args.file):
        say(f"Error: File not found: {args.file}", error=True)
        sys.exit(1)

    say(f"Analyzing dataset: {args.file}")
    with open(args.file, "rb") as f:
        content = f.read()

    from backend.app.parser import load_file_to_dataframe
    from backend.app.expert_system.sanitizer import sanitize_dataframe
    from backend.app.expert_system.fact_extractor import extract_dataset_facts
    from backend.app.expert_system.engine import run_expert_inference

    df, metadata = load_file_to_dataframe(content, os.path.basename(args.file))
    repairs = []
    if not args.no_repair:
        df, repairs = sanitize_dataframe(df)
    facts = extract_dataset_facts(df)
    inference = run_expert_inference(facts, repairs=repairs)

    health = inference["health_score"]
    say(f"Dataset Shape: {facts['dataset_summary']['row_count']} rows x {facts['dataset_summary']['col_count']} cols")
    say(f"Overall Health Score: {health['overall_score']}/100 (Grade: {health['grade']})")
    say(f"Diagnosis: {health['executive_diagnosis']}")
    if args.no_repair:
        say("Data-quality repairs: skipped (--no-repair)")
    else:
        print_repairs(repairs)
    if health["critical_issues"]:
        say("\nCritical Issues:")
        for issue in health["critical_issues"]:
            say(f"  - {issue}")

    if args.output:
        full_report = {
            "metadata": metadata,
            "repairs": repairs,
            "facts": facts,
            "inference": inference
        }
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(full_report, f, indent=2, default=str)
        say(f"\nSaved full audit report to: {args.output}")


def cmd_clean(args):
    """parse -> sanitize -> facts -> inference -> (target analysis) -> preprocess -> export"""
    if not os.path.exists(args.file):
        say(f"Error: File not found: {args.file}", error=True)
        sys.exit(1)

    fmt = args.format or FORMAT_BY_EXTENSION.get(os.path.splitext(args.output)[1].lower())
    if fmt is None:
        say("Error: cannot infer the output format from the extension; pass --format csv|excel|parquet|sqlite.", error=True)
        sys.exit(2)

    from backend.app.parser import load_file_to_dataframe
    from backend.app.expert_system.sanitizer import sanitize_dataframe
    from backend.app.expert_system.fact_extractor import extract_dataset_facts
    from backend.app.expert_system.engine import run_expert_inference
    from backend.app.supervised import analyze_target_variable
    from backend.app.preprocessor import execute_preprocessing_pipeline
    from backend.app.exporter import export_dataframe

    with open(args.file, "rb") as f:
        content = f.read()
    try:
        df, _ = load_file_to_dataframe(content, os.path.basename(args.file))
        if df.empty:
            raise ValueError("Could not extract any rows from the file.")
        before_shape = df.shape

        repairs = []
        if not args.no_repair:
            df, repairs = sanitize_dataframe(df)
        facts = extract_dataset_facts(df)
        inference = run_expert_inference(facts, repairs=repairs)

        task_type = None
        if args.target:
            task_type = analyze_target_variable(df, args.target)["task_type"]

        cleaned, report = execute_preprocessing_pipeline(df, facts, inference, target_col=args.target)
        out_bytes, _, _ = export_dataframe(cleaned, fmt, base_filename=os.path.basename(args.output))
    except ValueError as e:
        say(f"Error: {e}", error=True)
        sys.exit(1)

    with open(args.output, "wb") as f:
        f.write(out_bytes)

    say(f"Shape before: {before_shape[0]} rows x {before_shape[1]} cols")
    say(f"Shape after:  {cleaned.shape[0]} rows x {cleaned.shape[1]} cols")
    if args.target:
        say(f"Target: {args.target} ({task_type}), left untransformed and placed last")
    if args.no_repair:
        say("Data-quality repairs: skipped (--no-repair)")
    else:
        print_repairs(repairs)
    say(f"Steps executed: {len(report['steps_executed'])}")
    for step in report["steps_executed"]:
        say(f"  - {step}")
    say(f"Saved {fmt} to: {args.output}")


def main():
    parser = argparse.ArgumentParser(
        prog="datalysis",
        description="Datalysis: Autonomous Tabular Data Analysis & Expert Preprocessing System without LLMs."
    )
    parser.add_argument("--version", action="version", version="%(prog)s 1.1.0")

    subparsers = parser.add_subparsers(dest="command", help="Available subcommands")

    # `datalysis launch`
    launch_parser = subparsers.add_parser("launch", help="Start the local Datalysis web application")
    launch_parser.add_argument("--host", default="127.0.0.1", help="Bind host (default: 127.0.0.1)")
    launch_parser.add_argument("--port", type=int, default=8000, help="Bind port (default: 8000)")
    launch_parser.add_argument("--reload", action="store_true", help="Enable auto-reload for development")

    # `datalysis audit <file>`
    audit_parser = subparsers.add_parser("audit", help="Run local deterministic audit on a tabular file")
    audit_parser.add_argument("file", help="Path to CSV/Excel/JSON file")
    audit_parser.add_argument("-o", "--output", help="Optional path to output audit JSON report")
    audit_parser.add_argument("--no-repair", action="store_true", help="Skip the automatic data-quality repairs")

    # `datalysis clean <file> -o <out>`
    clean_parser = subparsers.add_parser("clean", help="Repair, preprocess and export a tabular file")
    clean_parser.add_argument("file", help="Path to CSV/Excel/JSON/Parquet file")
    clean_parser.add_argument("-o", "--output", required=True, help="Path of the cleaned output file")
    clean_parser.add_argument("--target", help="Supervised target column (kept untransformed, placed last)")
    clean_parser.add_argument("--format", choices=["csv", "excel", "parquet", "sqlite"],
                              help="Output format (default: inferred from the -o extension)")
    clean_parser.add_argument("--no-repair", action="store_true", help="Skip the automatic data-quality repairs")

    args = parser.parse_args()

    if args.command == "launch":
        cmd_launch(args)
    elif args.command == "audit":
        cmd_audit(args)
    elif args.command == "clean":
        cmd_clean(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
