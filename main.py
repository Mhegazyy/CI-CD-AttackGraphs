import os
import subprocess
import shutil
import datetime
from models import Session, Scan, Repository
from scanner.semgrep_runner import run_semgrep
from scanner.ast_analyzer import analyze_code
from scanner.graph_builder import build_attack_graph
from scanner.ai_impact import generate_ai_assessment


def clone_repo(repo_url, base_dir="clones"):
     # Ensure the base directory exists.
    if not os.path.exists(base_dir):
        os.makedirs(base_dir)
    
    # Determine a repository name from the URL.
    repo_name = repo_url.rstrip('/').split('/')[-1]
    if repo_name.endswith(".git"):
        repo_name = repo_name[:-4]
    
    clone_path = os.path.join(base_dir, repo_name)
    
    # Remove the existing directory if it already exists to ensure a fresh clone.
    if os.path.exists(clone_path):
        shutil.rmtree(clone_path)
    
    # Run the git clone command.
    command = ["git", "clone", repo_url, clone_path]
    result = subprocess.run(command, capture_output=True, text=True)
    
    if result.returncode != 0:
        raise Exception(f"Failed to clone repository {repo_url}: {result.stderr}")
    
    return clone_path

def update_repo(local_path):
    """
    Updates the local clone by running a git pull.
    
    Args:
        local_path (str): Path to the local repository clone.
    
    Returns:
        str: The output of the git pull command.
    """
    if not os.path.exists(local_path):
        raise Exception(f"Local repository path {local_path} does not exist.")
    
    # Change directory to the repository and run git pull
    command = ["git", "-C", local_path, "pull"]
    result = subprocess.run(command, capture_output=True, text=True)
    if result.returncode != 0:
        raise Exception(f"Failed to update repository at {local_path}: {result.stderr}")
    return result.stdout

def full_scan_process(repo_id):
    session = Session()
    # Retrieve the repository from the database
    repo = session.query(Repository).get(repo_id)
    if not repo:
        session.close()
        raise Exception(f"Repository with id {repo_id} not found.")

    # Use stored local clone if available; otherwise, clone the repository.
    if repo.local_path and os.path.exists(repo.local_path):
        print(f"Updating repository at {repo.local_path}...")
        update_repo(repo.local_path)
        clone_dir = repo.local_path
    else:
        print("Cloning repository as no local copy exists...")
        clone_dir = clone_repo(repo.repo_url)
        repo.local_path = clone_dir
        session.commit()

    # Run Semgrep and AST analysis on the cloned repository.
    semgrep_results = run_semgrep(clone_dir=clone_dir)
    ast_data = analyze_code(clone_dir)
    
    # Build the attack graph from the results.
    attack_graph = build_attack_graph(semgrep_results, ast_data)
    
    # Get AI assessment using the o1 model
    ai_result = generate_ai_assessment(attack_graph)
    
    # Persist the scan and AI analysis in the database
    new_scan = Scan(
        repo_id=repo.id,
        timestamp=datetime.datetime.utcnow(),
        scan_results={"attack_graph": attack_graph, "ai_assessment": ai_result}
    )
    session.add(new_scan)
    session.commit()
    session.close()
    
    return ai_result

if __name__ == "__main__":
    # For testing, pass a repository id (ensure it exists in your database)
    test_repo_id = 3  # Update this as needed
    try:
        result = full_scan_process(test_repo_id)
        print("AI Assessment:")
        print(result)
    except Exception as e:
        print(f"Error during scan: {e}")