from main import clone_repo

def add_repository(repo_name, repo_url):
    """
    Adds a repository to the database and clones it locally.
    """
    from models import Session, Repository
    session = Session()
    existing = session.query(Repository).filter(Repository.repo_url == repo_url).first()
    if existing:
        print(f"Repository '{repo_name}' already exists in the database.")
        session.close()
        return existing

    local_path = clone_repo(repo_url)
    new_repo = Repository(name=repo_name, repo_url=repo_url, local_path=local_path)
    session.add(new_repo)
    session.commit()
    session.close()
    print(f"Repository '{repo_name}' added to the database with local path '{local_path}'.")
    return new_repo

if __name__ == "__main__":
    # Replace these values with your test repository information.
    test_repo_name = "test"
    test_repo_url = "https://github.com/vulnerable-apps/dvpwa.git"
    add_repository(test_repo_name, test_repo_url)