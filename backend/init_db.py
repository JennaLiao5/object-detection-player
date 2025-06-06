import os
import psycopg2
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Fetch required credentials from environment
dbname = os.environ.get("POSTGRES_DB")
user = os.environ.get("POSTGRES_USER")
password = os.environ.get("POSTGRES_PASSWORD")
host = os.environ.get("POSTGRES_HOST", "localhost")
port = os.environ.get("POSTGRES_PORT", 5432)

# Validate required credentials
if not dbname or not user or not password:
    raise ValueError("POSTGRES_DB, POSTGRES_USER, and POSTGRES_PASSWORD must be set in environment variables.")

# Connect to PostgreSQL
conn = psycopg2.connect(
    dbname=dbname,
    user=user,
    password=password,
    host=host,
    port=port
)

cursor = conn.cursor()

# Create the 'predictions' table if it doesn't exist
cursor.execute('''
CREATE TABLE IF NOT EXISTS predictions (
    id SERIAL PRIMARY KEY,
    prediction_id UUID NOT NULL,
    image_path TEXT,
    class_name TEXT,
    confidence FLOAT,
    bbox_left INT,
    bbox_top INT,
    bbox_width INT,
    bbox_height INT,
    created_at TIMESTAMP DEFAULT NOW()
)
''')

# Commit the transaction and close the connection
conn.commit()
cursor.close()
conn.close()

print("Database initialized successfully.")
