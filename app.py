from flask import Flask, request, jsonify, render_template, redirect, url_for, send_from_directory
from apscheduler.schedulers.background import BackgroundScheduler
import os
import datetime
import threading
import subprocess
from models import Session, Repository, Scan
from main import scan_repository, update_repo, clone_repo  # Ensure scan_repository is correctly defined in main.py
from add_repo import add_repository 
from flask_cors import CORS

app = Flask(__name__, static_folder='static', template_folder='templates')
CORS(app, origins="http://localhost:5173")

def poll_repositories():
    session = Session()
    repos = session.query(Repository).all()
    for repo in repos:
        try:
            # 1. Ensure a local clone exists
            if repo.local_path and os.path.isdir(repo.local_path):
                # fetch remote updates
                subprocess.run(
                    ["git", "-C", repo.local_path, "fetch"],
                    check=True, capture_output=True
                )
            else:
                # clone if missing
                repo.local_path = clone_repo(repo.repo_url)
                session.commit()

            # 2. Get the latest remote commit on default branch
            out = subprocess.check_output(
                ["git", "-C", repo.local_path, "rev-parse", "origin/HEAD"]
            ).strip().decode()

            # 3. Compare & trigger
            if repo.last_commit != out:
                repo.last_commit = out
                session.commit()
                # trigger a background scan
                threading.Thread(
                  target=lambda rid=repo.id: scan_repository(rid),
                  daemon=True
                ).start()

        except Exception as e:
            app.logger.error(f"Polling {repo.name} failed: {e}")
    session.close()

# 4. Schedule the job
scheduler = BackgroundScheduler()
scheduler.add_job(
    func=poll_repositories,
    trigger="interval",
    minutes=10,     # adjust to taste
    next_run_time=datetime.datetime.now()  # start immediately on launch
)
scheduler.start()
@app.route('/')
def index():
    # Serve the built index.html from static/dist
    return send_from_directory('static/dist', 'index.html')

@app.route('/app/src/<path:filename>')
def serve_js(filename):
    return send_from_directory('app/src', filename)

@app.route('/<path:filename>')
def static_proxy(filename):
    return send_from_directory('static/dist', filename)

@app.route("/dashboard/<int:repo_id>")
def dashboard(repo_id):
    # The template attack_graph.html will fetch and display the latest scan for the repo.
    return render_template("attack_graph.html", repo_id=repo_id)

@app.route('/scan/<int:repo_id>/latest', methods=['GET'])
def get_latest_scan(repo_id):
    session = Session()
    scan = session.query(Scan).filter_by(repo_id=repo_id).order_by(Scan.timestamp.desc()).first()
    session.close()
    if not scan:
        return jsonify({"error": "No scan found for this repository"}), 404
    return jsonify(scan.scan_results)

@app.route("/repos", methods=["GET"])
def list_repos():
    with Session() as session:
        repos = session.query(Repository).all()
        result = [
            {"id": r.id, "name": r.name, "url": r.repo_url}
            for r in repos
        ]
    return jsonify(result), 200

@app.route("/repos", methods=["POST"])
def create_repo():
    data = request.get_json(force=True)
    name     = data.get("name")
    repo_url = data.get("repo_url")
    if not name or not repo_url:
        return jsonify({"error": "name and repo_url are required"}), 400

    # Delegate to your existing function
    try:
        new_repo = add_repository(name, repo_url)
    except Exception as e:
        # e.g. clone failure or DB error
        return jsonify({"error": str(e)}), 500

    # add_repository returns the SQLAlchemy model instance;
    # pull out the fields you want to return as JSON:
    return jsonify({
        "id":         new_repo.id,
        "name":       new_repo.name,
        "url":        new_repo.repo_url,
        "local_path": new_repo.local_path
    }), 201


@app.route('/scan/<int:repo_id>', methods=['POST'])
def scan_repo(repo_id):
    session = Session()
    repo = session.query(Repository).get(repo_id)
    if not repo:
        session.close()
        return jsonify({"error": "Repository not found"}), 404
    session.close()

    # Run the scanning process in a background thread.
    # scan_repository should handle updating the repository and storing scan results in the DB.
    def run_scan():
        scan_repository(repo.repo_url)
        # Optionally, update repo.last_scanned or perform further DB updates.
    
    threading.Thread(target=run_scan).start()
    return jsonify({"status": "Scan triggered", "repo": repo.repo_url}), 200

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
