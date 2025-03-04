from flask import Flask, request, jsonify, render_template, redirect, url_for
import threading
from models import Session, Repository
from main import scan_repository  # We’ll define this scanning function in main.py

app = Flask(__name__)

@app.route('/')
def index():
    session = Session()
    repos = session.query(Repository).all()
    return render_template('index.html', repositories=repos)

@app.route('/add_repo', methods=['POST'])
def add_repo():
    repo_url = request.form.get('repo_url')
    repo_name = request.form.get('name')
    if not repo_url or not repo_name:
        return "Repository name and URL are required", 400
    
    session = Session()
    new_repo = Repository(name=repo_name, repo_url=repo_url)
    session.add(new_repo)
    session.commit()
    return redirect(url_for('index'))

@app.route('/scan/<int:repo_id>', methods=['POST'])
def scan_repo(repo_id):
    session = Session()
    repo = session.query(Repository).get(repo_id)
    if not repo:
        return jsonify({"error": "Repository not found"}), 404

    # Run the scanning process in a background thread
    def run_scan():
        scan_repository(repo.repo_url)
        # Here you could also update repo.last_scanned or store results in the DB
    
    threading.Thread(target=run_scan).start()
    return jsonify({"status": "Scan triggered", "repo": repo.repo_url}), 200

if __name__ == '__main__':
    app.run(debug=True)
