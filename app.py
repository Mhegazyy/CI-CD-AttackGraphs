from flask import Flask, request, jsonify, render_template, redirect, url_for, send_from_directory
import threading
from models import Session, Repository, Scan
from main import scan_repository  # Ensure scan_repository is correctly defined in main.py

app = Flask(__name__, static_folder='static', template_folder='templates')

@app.route('/')
def index():
    # Serve the built index.html from static/dist
    return send_from_directory('static/dist', 'index.html')

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

@app.route('/add_repo', methods=['POST'])
def add_repo():
    repo_url = request.form.get('repo_url')
    repo_name = request.form.get('name')
    if not repo_url or not repo_name:
        return "Repository name and URL are required", 400
    
    session = Session()
    # Check if repository already exists
    existing_repo = session.query(Repository).filter_by(repo_url=repo_url).first()
    if existing_repo:
        session.close()
        return redirect(url_for('index'))
    
    new_repo = Repository(name=repo_name, repo_url=repo_url)
    session.add(new_repo)
    session.commit()
    session.close()
    return redirect(url_for('index'))

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
