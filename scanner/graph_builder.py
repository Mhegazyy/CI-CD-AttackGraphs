import networkx as nx


def find_matching_node_id(G, short_name):
    """
    Look for a node in G whose ID ends with ":" + short_name.
    Returns the full node ID if found, otherwise None.
    """
    for node in G.nodes():
        if node == short_name or node.endswith(":" + short_name):
            return node
    return None

def build_attack_graph(semgrep_results, ast_data):
    """
    Build an improved attack graph that integrates vulnerability information from Semgrep
    directly into function nodes and normalizes function nodes to avoid duplicates.
    
    Args:
        semgrep_results (dict): Vulnerability results from Semgrep.
        ast_data (dict): AST analysis output containing function definitions and call relationships.
    
    Returns:
        dict: A node-link representation of the attack graph.
    """
    G = nx.DiGraph()

    # 1. Create function nodes from AST analysis.
    for func in ast_data.get("functions", []):
        node_id = func.full_name()  # e.g. "clones/dvpwa/sqli/services/db.py:setup_database"
        G.add_node(node_id, 
                   type="function",
                   label=func.name,
                   filepath=func.filepath,
                   lineno=func.lineno,
                   class_name=func.class_name,
                   vulnerabilities=[],   # list to store vulnerability messages
                   vulnerable=False)     # flag to mark if this function is vulnerable

    # 2. Add call edges (normalize names if necessary).
    for caller, callee in ast_data.get("calls", []):
        # Normalize caller
        if caller not in G:
            match = find_matching_node_id(G, caller)
            if match:
                caller = match
        # Normalize callee
        if callee not in G:
            match = find_matching_node_id(G, callee)
            if match:
                callee = match

        # If still missing, consider them external.
        if caller not in G:
            G.add_node(caller, type="external_function", label=caller)
        if callee not in G:
            G.add_node(callee, type="external_function", label=callee)

        G.add_edge(caller, callee, type="calls")

    # 3. Integrate vulnerability information from Semgrep.
    vulnerabilities = semgrep_results.get("results", [])
    for vuln in vulnerabilities:
        file_path = vuln.get("path")
        message = vuln.get("extra", {}).get("message", "vulnerability")
        # For each function node that belongs to the same file, attach the vulnerability message.
        for node, data in G.nodes(data=True):
            if data.get("type") == "function" and data.get("filepath") == file_path:
                data["vulnerabilities"].append(message)
                data["vulnerable"] = True  # Mark the function as vulnerable

    return nx.node_link_data(G)


if __name__ == "__main__":
    # Dummy data for testing: Replace with real semgrep and ast output.
    # For example, use your Semgrep module to get vulnerability results,
    # and your updated ast_analyzer to get function definitions and call relationships.
    dummy_semgrep_results = {
        "results": [
            {"path": "example.py", "extra": {"message": "Potential SQL injection"}}
        ]
    }
    # Assume ast_data is the output from your updated analyze_code() that provides FunctionInfo objects and calls.
    from ast_analyzer import analyze_code
    ast_data = analyze_code("clones/dvpwa")
    
    graph = build_attack_graph(dummy_semgrep_results, ast_data)
    # Print the graph structure.
    import json
    print(json.dumps(graph, indent=2))
