import networkx as nx

def build_attack_graph(semgrep_results, ast_data):
    """
    Build an attack graph by merging Semgrep vulnerability data with function call relationships.
    
    Args:
        semgrep_results (dict): Parsed JSON output from Semgrep.
        ast_data (dict): Output from the AST analyzer with 'functions' and 'calls'.
    
    Returns:
        dict: A node-link representation of the attack graph.
    """
    G = nx.DiGraph()
    
    # Add nodes for each function extracted from the AST analysis.
    # Use the full_name as the node identifier.
    for func in ast_data.get("functions", []):
        node_id = func.full_name()  # Using the full name method of FunctionInfo
        G.add_node(node_id, 
                   type="function",
                   name=func.name,
                   filepath=func.filepath,
                   lineno=func.lineno,
                   class_name=func.class_name)
    
    # Add edges based on call relationships from the AST analysis.
    for caller, callee in ast_data.get("calls", []):
        # Add an edge only if both caller and callee exist in the graph.
        if caller in G and callee in G:
            G.add_edge(caller, callee, type="calls")
        else:
            # Optionally, add nodes for external calls or simply log the missing information.
            G.add_edge(caller, callee, type="calls (external?)")
    
    # Now, overlay vulnerability information from Semgrep.
    vulnerabilities = semgrep_results.get("results", [])
    for vuln in vulnerabilities:
        file_path = vuln.get("path")
        message = vuln.get("extra", {}).get("message", "vulnerability")
        vuln_node = f"{file_path}:vuln"
        
        # Add a vulnerability node.
        G.add_node(vuln_node, type="vulnerability", message=message)
        
        # Connect the vulnerability node to all function nodes defined in the same file.
        for func in ast_data.get("functions", []):
            if func.filepath == file_path:
                func_node = func.full_name()
                G.add_edge(func_node, vuln_node, type="vulnerability")
    
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
    ast_data = analyze_code("path/to/your/codebase")
    
    graph = build_attack_graph(dummy_semgrep_results, ast_data)
    # Print the graph structure.
    import json
    print(json.dumps(graph, indent=2))
