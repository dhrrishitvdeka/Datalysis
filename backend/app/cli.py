"""
Datalysis Command-Line Interface (CLI)
Entrypoint for `datalysis launch` and `datalysis audit <file>`.
"""

import os
import sys
import json
import argparse


def cmd_launch(args):
    import uvicorn
    host = args.host or "127.0.0.1"
    port = args.port or 8000
    print(f"🚀 Launching Datalysis on http://{host}:{port}")
    uvicorn.run("backend.app.main:app", host=host, port=port, reload=args.reload)


def cmd_audit(args):
    if not os.path.exists(args.file):
        print(f"❌ Error: File not found: {args.file}", file=sys.stderr)
        sys.exit(1)

    print(f"🔍 Analyzing dataset: {args.file}")
    with open(args.file, "rb") as f:
        content = f.read()

    from backend.app.parser import load_file_to_dataframe
    from backend.app.expert_system.fact_extractor import extract_dataset_facts
    from backend.app.expert_system.engine import run_expert_inference

    df, metadata = load_file_to_dataframe(content, os.path.basename(args.file))
    facts = extract_dataset_facts(df)
    inference = run_expert_inference(facts)

    health = inference["health_score"]
    print(f"📊 Dataset Shape: {facts['dataset_summary']['row_count']} rows x {facts['dataset_summary']['col_count']} cols")
    print(f"🩺 Overall Health Score: {health['overall_score']}/100 (Grade: {health['grade']})")
    print(f"💡 Diagnosis: {health['executive_diagnosis']}")
    if health["critical_issues"]:
        print("\n⚠️ Critical Issues:")
        for issue in health["critical_issues"]:
            print(f"  • {issue}")

    if args.output:
        full_report = {
            "metadata": metadata,
            "facts": facts,
            "inference": inference
        }
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(full_report, f, indent=2, default=str)
        print(f"\n💾 Saved full audit report to: {args.output}")


def main():
    parser = argparse.ArgumentParser(
        prog="datalysis",
        description="Datalysis: Autonomous Tabular Data Analysis & Expert Preprocessing System without LLMs."
    )
    parser.add_argument("--version", action="version", version="%(prog)s 1.0.0")

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

    args = parser.parse_args()

    if args.command == "launch":
        cmd_launch(args)
    elif args.command == "audit":
        cmd_audit(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
