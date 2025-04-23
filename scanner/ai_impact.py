# ai_assessment.py
from __future__ import annotations

import json
import os
import time
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from openai import OpenAI
import tiktoken

# ────────────────────────────────────────────────────────────────────────────────
# Configuration & client
# ────────────────────────────────────────────────────────────────────────────────
load_dotenv()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Tokeniser for o4-mini / GPT-4-class models
_ENCODING = tiktoken.get_encoding("cl100k_base")

# Leave ~8 k tokens head-room for the model’s own output
MAX_INPUT_TOKENS = 100000

# Optional on-disk log for every assistant response (append mode)
LOG_PATH = Path(__file__).with_suffix(".log")


# ────────────────────────────────────────────────────────────────────────────────
# Helper functions (internal)
# ────────────────────────────────────────────────────────────────────────────────
def _count_tokens(txt: str) -> int:
    return len(_ENCODING.encode(txt))


def _chunk_text(txt: str, max_tokens: int) -> list[str]:
    """Split `txt` into UTF-8 chunks that decode to ≤ max_tokens each."""
    toks = _ENCODING.encode(txt)
    chunks: list[str] = []
    for start in range(0, len(toks), max_tokens):
        chunk = _ENCODING.decode(toks[start : start + max_tokens])
        chunks.append(chunk)
    return chunks


def _clean_json_fences(text: str) -> str:
    """Strip ``` and ```json fences (if any)."""
    text = text.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        # drop opening ```
        if lines[0].lstrip().startswith("```"):
            lines = lines[1:]
        # drop closing ```
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        text = "\n".join(lines).strip()
    return text


def _compact_graph(graph: dict[str, Any]) -> dict[str, Any]:
    """
    Return a copy of the attack-graph with:
      • any `children`, `has_child`, or `hasChildren`-style keys removed
      • empty objects stripped out (to save tokens)
    """
    graph = json.loads(json.dumps(graph))  # deep-copy via json round-trip
    ignore_keys = {"children", "has_child", "hasChildren"}

    for node in graph.get("nodes", []):
        for k in list(node):
            if k in ignore_keys:
                node.pop(k, None)

    # prune empty dicts (rare, but worth it for < 100 k nodes)
    def _prune(obj: Any) -> Any:
        if isinstance(obj, dict):
            return {k: _prune(v) for k, v in obj.items() if v not in (None, {}, [], "")}
        if isinstance(obj, list):
            return [_prune(v) for v in obj if v not in (None, {}, [], "")]
        return obj

    return _prune(graph)


def _log_assistant(text: str) -> None:
    try:
        LOG_PATH.write_text(
            f"{time.strftime('%Y-%m-%d %H:%M:%S')} ─ assistant\n{text}\n\n",
            encoding="utf-8",
            errors="ignore",
            append=True,  # type: ignore[arg-type]
        )
    except Exception:
        # Logging failure must never break the pipeline
        pass


# ────────────────────────────────────────────────────────────────────────────────
# Public entry point
# ────────────────────────────────────────────────────────────────────────────────
def generate_ai_assessment(attack_graph: dict[str, Any]) -> dict[str, Any] | str:
    """
    Chunk-stream the attack-graph to the model and retrieve the final JSON analysis.
    """
    graph_compact = _compact_graph(attack_graph)
    graph_json = json.dumps(graph_compact, separators=(",", ":"))

    base_instructions = (
        "You are a senior application-security analyst.\n\n"
    "▸ The attack-graph JSON will arrive in multiple chunks. **Buffer every chunk**.\n"
    "▸ Perform **no analysis** until the final chunk, which ends with the literal text:\n"
    "      END_OF_GRAPH\n"
    "▸ For every non-final chunk reply with the single word **ACK** (case-sensitive).\n\n"
    "When the final part arrives **use the entire reconstructed graph** to perform the "
    "tasks below:\n\n"
    "1️⃣  *Per-function analysis* — for **every** function node output `function_id`, "
    "`risk_rating`, `impact_rating`, full `vulnerabilities`, and a `recommendation`.\n\n"
    "2️⃣  *Overall assessment* — summarise systemic risk and key concerns (one paragraph).\n\n"
    "3️⃣  *Multi-node attack paths* —\n"
    "    • Discover **all call-chains with length ≥ 2** that start at an entry-point "
    "      (no in-edges or tagged as user-input) and terminate at a function that has "
    "      at least one vulnerability.\n"
    "    • **Ignore paths of length 1**.\n"
    "    • Score each path by **summing node-scores**, where a node-score is the sum for "
    "      that node of *(severity_score × likelihood_score × impact_score)* for every "
    "      vulnerability.  Use the mapping  "
    "        severity Low=1 Medium=3 High=5; "
    "        likelihood Low=0.1 Medium=0.5 High=1.0; "
    "        impact Low=0.1 Medium=0.5 High=1.0.\n"
    "    • Sort paths by descending total score and include at least the top 10, or all "
    "      if fewer than 10 exist.\n\n"
    "➡️  **Return only valid JSON** exactly in this schema:\n"
    "{\n"
    '  "functions_analysis": [ {...}, ... ],\n'
    '  "overall_risk": "string",\n'
    '  "critical_attack_paths": [ ["funcA","funcB",...], ... ]\n'
    "}\n"
    )

    # Split the payload
    chunks = _chunk_text(graph_json, MAX_INPUT_TOKENS)
    assistant_reply: str | None = None

    for i, chunk in enumerate(chunks):
        is_last = i == len(chunks) - 1
        payload = chunk + ("\nEND_OF_GRAPH" if is_last else "")

        try:
            res = client.responses.create(
                model="o4-mini",
                instructions=base_instructions,
                input=payload,
            )
        except Exception as exc:
            return {"error": f"OpenAI API error on chunk {i+1}/{len(chunks)} — {exc}"}

        # Save every assistant utterance to disk
        if hasattr(res, "output"):
            for part in res.output:
                if getattr(part, "role", None) == "assistant":
                    txt = "".join(c.text for c in part.content if hasattr(c, "text")).strip()
                    _log_assistant(txt)
                    if is_last:
                        assistant_reply = txt

    if assistant_reply is None:
        return {"error": "No assistant reply on final chunk."}

    assistant_reply = _clean_json_fences(assistant_reply)

    try:
        parsed = json.loads(assistant_reply)
        return {"impact_assessment": parsed}
    except Exception:
        # fall-back to raw text for debugging
        return {"impact_assessment": assistant_reply}


# ──────────────────────────────────────────
# Simple CLI test
# ──────────────────────────────────────────
if __name__ == "__main__":
    tiny_graph = {
        "directed": True,
        "nodes": [
            {
                "id": "foo.py:f1",
                "type": "function",
                "vulnerabilities": [{"severity": "High", "likelihood": "High", "impact": "High"}],
            },
            {"id": "foo.py:f2", "type": "function", "vulnerabilities": []},
        ],
        "links": [{"source": "foo.py:f1", "target": "foo.py:f2", "type": "call"}],
    }

    out = generate_ai_assessment(tiny_graph)
    print(json.dumps(out, indent=2))
