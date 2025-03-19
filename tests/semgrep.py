from models import Session, Repository
from main import scan_repository

def add_repo_and_scan(repo_name, repo_url):
    session = Session()
    # Check if the repository already exists in the database
    repo = session.query(Repository).filter(Repository.repo_url == repo_url).first()
    if not repo:
        repo = Repository(name=repo_name, repo_url=repo_url)
        session.add(repo)
        session.commit()
        print(f"Repository '{repo_name}' added to the database.")
    else:
        print(f"Repository '{repo_name}' already exists in the database.")

    # Trigger the scan for the repository using its URL
    print(f"Starting scan for repository '{repo_name}'...")
    scan_repository(repo_url)
    session.close()

if __name__ == "__main__":
    # Replace these values with your test repository information.
    test_repo_name = "test"
    test_repo_url = "https://github.com/vulnerable-apps/dvpwa.git"
    add_repo_and_scan(test_repo_name, test_repo_url)
