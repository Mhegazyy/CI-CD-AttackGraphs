import os
import subprocess
import shutil
from scanner.semgrep_runner import run_semgrep
# from scanner.ast_analyzer import analyze_code
# from scanner.graph_builder import build_attack_graph

def scan_repository(repo_url):
    repo_name = repo_url.split('/')[-1].replace('.git', '')
    clone_dir = os.path.join('clones', repo_name)
    
    # Remove any previous clone
    if os.path.exists(clone_dir):
        shutil.rmtree(clone_dir)
    
    # Clone the repository
    cmd = ["git", "clone", repo_url, clone_dir]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"Failed to clone {repo_url}: {result.stderr}")
        return
    
    # Run SAST scan using Semgrep
    semgrep_results = run_semgrep(clone_dir=clone_dir)
    
    # Analyze code structure using AST
    # code_relationships = analyze_code(clone_dir)
    
    # Build attack graph
    # attack_graph = build_attack_graph(semgrep_results, code_relationships)
    
    # For now, just print the attack graph.
    # print(f"Attack graph for {repo_url}:")
    # print(attack_graph)
    
    # TODO: Save scan results to the database
