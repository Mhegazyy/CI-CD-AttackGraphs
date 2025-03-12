import os
import networkx as nx
from semgrep_runner import run_semgrep

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
        node_id = func.full_name()
        G.add_node(node_id, 
                   type="function",
                   label=func.name,
                   filepath=func.filepath,
                   normalized_filepath=os.path.basename(func.filepath),
                   lineno=func.lineno,
                   end_lineno=func.end_lineno,   # record end line
                   class_name=func.class_name,
                   vulnerabilities=[],   
                   vulnerable=False)

    # 2. Add call edges from AST analysis.
    for caller, callee in ast_data.get("calls", []):
        # Normalize caller and callee similar to before.
        if caller not in G:
            for node in G.nodes():
                if node.endswith(":" + caller):
                    caller = node
                    break
        if callee not in G:
            for node in G.nodes():
                if node.endswith(":" + callee):
                    callee = node
                    break
        if caller not in G:
            G.add_node(caller, type="external_function", label=caller)
        if callee not in G:
            G.add_node(callee, type="external_function", label=callee)
        G.add_edge(caller, callee, type="calls")
    
    # 3. Integrate vulnerability information using line numbers.
    vulnerabilities = semgrep_results.get("results", [])
    for i, vuln in enumerate(vulnerabilities):
        vuln_path = vuln.get("path", "")
        if not vuln_path:
            continue
        ext = os.path.splitext(vuln_path)[1].lower()
        normalized_vuln_path = os.path.basename(vuln_path)
        message = vuln.get("extra", {}).get("message", "vulnerability")
        vuln_start_line = vuln.get("start", {}).get("line")
        vuln_end_line = vuln.get("end", {}).get("line")

        # For vulnerabilities in code files (e.g., .py), check if they fall within a function's range.
        if ext == ".py" and vuln_start_line and vuln_end_line:
            for node, data in G.nodes(data=True):
                if data.get("type") == "function" and data.get("normalized_filepath") == normalized_vuln_path:
                    # Check if the vulnerability's lines fall within the function's boundaries.
                    if data.get("lineno") <= vuln_start_line and data.get("end_lineno") >= vuln_end_line:
                        data["vulnerabilities"].append({
                            "message": message,
                            "start": vuln.get("start"),
                            "end": vuln.get("end"),
                            "severity": vuln.get("extra", {}).get("severity"),
                            "likelihood": vuln.get("extra", {}).get("metadata", {}).get("likelihood"),
                            "impact": vuln.get("extra", {}).get("metadata", {}).get("impact"),
                            "confidence": vuln.get("extra", {}).get("metadata", {}).get("confidence"),
                            "vulnerability_class": vuln.get("extra", {}).get("metadata", {}).get("vulnerability_class")
                        })
                        data["vulnerable"] = True
        else:
            # For vulnerabilities in non-code files, create a separate node.
            vuln_node_id = f"vuln::{normalized_vuln_path}::{i}"
            G.add_node(vuln_node_id, 
                       type="vulnerability",
                       label=normalized_vuln_path,
                       filepath=vuln_path,
                       vulnerability_data={
                           "message": message,
                           "start": vuln.get("start"),
                           "end": vuln.get("end"),
                           "severity": vuln.get("extra", {}).get("severity"),
                           "likelihood": vuln.get("extra", {}).get("metadata", {}).get("likelihood"),
                           "impact": vuln.get("extra", {}).get("metadata", {}).get("impact"),
                           "confidence": vuln.get("extra", {}).get("metadata", {}).get("confidence"),
                           "vulnerability_class": vuln.get("extra", {}).get("metadata", {}).get("vulnerability_class")
                       })
            # Link this vulnerability node to function nodes in the same directory.
            vuln_dir = os.path.dirname(vuln_path)
            for node, data in G.nodes(data=True):
                if data.get("type") == "function":
                    func_dir = os.path.dirname(data.get("filepath"))
                    if os.path.normpath(func_dir) == os.path.normpath(vuln_dir):
                        G.add_edge(node, vuln_node_id, type="has_vulnerability")
    
    return nx.node_link_data(G)




if __name__ == "__main__":
    # Dummy data for testing: Replace with real semgrep and ast output.
    # For example, use your Semgrep module to get vulnerability results,
    # and your updated ast_analyzer to get function definitions and call relationships.
    dummy_semgrep_results = run_semgrep("clones/dvpwa")
    # Assume ast_data is the output from your updated analyze_code() that provides FunctionInfo objects and calls.
    from ast_analyzer import analyze_code
    ast_data = analyze_code("clones/dvpwa")
    
    graph = build_attack_graph(dummy_semgrep_results, ast_data)
    # Print the graph structure.
    import json
    print(json.dumps(graph, indent=2))
