import os
import networkx as nx
from scanner.semgrep_runner import run_semgrep

def normalize_filepath(filepath):
    """
    Return a normalized version of the filepath.
    Here we use the basename. You could extend this to a relative path.
    """
    return os.path.basename(filepath)

def find_matching_node_id(G, short_name):
    """
    Look for a node in G whose ID ends with ":" + short_name,
    or whose basename of the function name matches.
    Returns the full node ID if found, otherwise None.
    """
    for node in G.nodes():
        # Check if the node ID ends with ":" + short_name or equals it.
        if node == short_name or node.endswith(":" + short_name):
            return node
    return None

def build_attack_graph(semgrep_results, ast_data):
    G = nx.DiGraph()

    # 1. Create function nodes from AST analysis.
    for func in ast_data.get("functions", []):
        node_id = func.full_name()  # e.g. "clones/dvpwa/sqli/services/db.py:setup_database"
        G.add_node(node_id, 
                   type="function",
                   label=func.name,
                   filepath=func.filepath,
                   normalized_filepath=os.path.basename(func.filepath),
                   lineno=func.lineno,
                   end_lineno=func.end_lineno,
                   class_name=func.class_name,
                   vulnerabilities=[],   # List for vulnerability details
                   vulnerable=False)     # Flag indicating vulnerability

    # 2. Add call edges from AST analysis.
    for caller, callee in ast_data.get("calls", []):
        # Normalize caller and callee using our heuristic (matching by ending substring)
        norm_caller = caller
        for node in G.nodes():
            if node.endswith(":" + caller):
                norm_caller = node
                break

        norm_callee = callee
        for node in G.nodes():
            if node.endswith(":" + callee):
                norm_callee = node
                break

        # If the normalized caller is not in the graph, add it as an external node.
        if norm_caller not in G:
            G.add_node(norm_caller, type="external_function", label=norm_caller)
        # If the normalized callee is not in the graph, add it as an external node.
        if norm_callee not in G:
            G.add_node(norm_callee, type="external_function", label=norm_callee)

        G.add_edge(norm_caller, norm_callee, type="calls")

    # 3. Integrate vulnerability information from Semgrep.
    vulnerabilities = semgrep_results.get("results", [])
    for i, vuln in enumerate(vulnerabilities):
        vuln_path = vuln.get("path", "")
        if not vuln_path:
            continue
        ext = os.path.splitext(vuln_path)[1].lower()
        normalized_vuln_path = os.path.basename(vuln_path)
        extra = vuln.get("extra", {})
        vuln_data = {
            "check_id": vuln.get("check_id"),
            "message": extra.get("message", "vulnerability"),
            "severity": extra.get("severity"),
            "likelihood": extra.get("metadata", {}).get("likelihood"),
            "impact": extra.get("metadata", {}).get("impact"),
            "confidence": extra.get("metadata", {}).get("confidence"),
            "vulnerability_class": extra.get("metadata", {}).get("vulnerability_class")
        }
        
        # For vulnerabilities in Python files, attach them directly to function nodes whose
        # normalized file matches AND the vulnerability’s reported line numbers fall within the function's boundaries.
        if ext == ".py":
            vuln_start = vuln.get("start", {}).get("line")
            vuln_end = vuln.get("end", {}).get("line")
            for node, data in G.nodes(data=True):
                if data.get("type") == "function" and data.get("normalized_filepath") == normalized_vuln_path:
                    if vuln_start and vuln_end:
                        # Attach if the vulnerability falls within the function's range.
                        if data.get("lineno") <= vuln_start and data.get("end_lineno") >= vuln_end:
                            data["vulnerabilities"].append(vuln_data)
                            data["vulnerable"] = True
                    else:
                        # If line numbers aren't available, attach it anyway.
                        data["vulnerabilities"].append(vuln_data)
                        data["vulnerable"] = True
        else:
            # For non-code files, create a separate vulnerability node.
            vuln_node_id = f"vuln::{normalized_vuln_path}::{i}"
            G.add_node(vuln_node_id, 
                       type="vulnerability",
                       label=normalized_vuln_path,
                       filepath=vuln_path,
                       vulnerability_data=vuln_data)
            # Link this vulnerability node to function nodes in the same directory.
            vuln_dir = os.path.dirname(vuln_path)
            for node, data in G.nodes(data=True):
                if data.get("type") == "function":
                    func_dir = os.path.dirname(data.get("filepath"))
                    if os.path.normpath(func_dir) == os.path.normpath(vuln_dir):
                        G.add_edge(node, vuln_node_id, type="has_vulnerability")
    
    return nx.node_link_data(G)





if __name__ == "__main__":
    # Dummy data for testing: Replace with real semgrep and AST output.
    # For example, use your Semgrep module to get vulnerability results,
    # and your updated ast_analyzer to get function definitions and call relationships.
    dummy_semgrep_results = run_semgrep("clones/dvpwa")
    # Assume ast_data is the output from your updated analyze_code() that provides FunctionInfo objects and calls.
    from ast_analyzer import analyze_code
    ast_data = analyze_code("clones/dvpwa")
    
    graph = build_attack_graph(dummy_semgrep_results, ast_data)
    
    # Write the attack graph to a file.
    import json
    with open("attack_graph.json", "w") as f:
        json.dump(graph, f, indent=2)
    
    print("Attack graph written to attack_graph.json")

