from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import os
from pathlib import Path

UPLOAD_DIR = Path(__file__).parent / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="File Upload API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MAX_MB = 50  # max file size in MB


@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    contents = await file.read()
    size_mb = len(contents) / 1024 / 1024
    if size_mb > MAX_MB:
        raise HTTPException(status_code=413, detail=f"File too large. Max {MAX_MB} MB")

    # basic sanitization
    safe_name = file.filename.replace("..", "").replace("/", "_")
    dest = UPLOAD_DIR / safe_name

    with open(dest, "wb") as f:
        f.write(contents)

    return {"filename": safe_name, "size_mb": round(size_mb, 2)}
