from models import Session, Repository

def test_db_connection():
    session = Session()
    try:
        # Try to query the repositories table (even if it's empty)
        repositories = session.query(Repository).all()
        print(f"Successfully connected to the database. Found {len(repositories)} repositories.")
        for repo in repositories:
            print(f"ID: {repo.id}, Name: {repo.name}, URL: {repo.repo_url}")
    except Exception as e:
        print("Database connection failed:", e)
    finally:
        session.close()

if __name__ == "__main__":
    test_db_connection()
