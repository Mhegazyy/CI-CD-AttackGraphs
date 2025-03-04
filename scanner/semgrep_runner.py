import subprocess
import json
import os

def run_semgrep(clone_dir="."):
    """
    Runs Semgrep on the specified directory and returns the parsed JSON output.
    
    Args:
        clone_dir (str): Path to the directory to scan.
    
    Returns:
        dict: Parsed JSON results from the Semgrep scan.
    """
    # Convert to absolute path to ensure Semgrep finds the correct directory
    abs_path = os.path.abspath(clone_dir)
    command = ["semgrep", "--config", "auto", "--json", abs_path]
    result = subprocess.run(command, capture_output=True, text=True)
    if result.returncode != 0:
        raise Exception("Semgrep scan failed:\n" + result.stderr)
    return json.loads(result.stdout)

if __name__ == "__main__":
    # Test the function by scanning the current directory
    results = run_semgrep(".")
    print(json.dumps(results, indent=4))
