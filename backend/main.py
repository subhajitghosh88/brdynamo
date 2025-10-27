from flask import Flask, request, jsonify
from werkzeug.utils import secure_filename
import os
import json
import re
import google.generativeai as genai
from flask_cors import CORS
import traceback
import PyPDF2

# ------------------------------
# CONFIGURATION
# ------------------------------

app = Flask(__name__)
CORS(app) 

UPLOAD_FOLDER = "uploads"
PARSED_FOLDER = "parsed_json"

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(PARSED_FOLDER, exist_ok=True)

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

# ------------------------------
# HELPERS
# ------------------------------

def extract_text_from_file(file_path):
    """Extract text from txt, docx, or pdf files."""
    ext = os.path.splitext(file_path)[1].lower()
    text = ""

    if ext == ".txt":
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            text = f.read()

    elif ext == ".docx":
        doc = Document(file_path)
        text = "\n".join([para.text for para in doc.paragraphs])

    elif ext == ".pdf":
        reader = PyPDF2.PdfReader(file_path)
        for page in reader.pages:
            text += page.extract_text() or ""

    else:
        raise ValueError("Unsupported file type. Please upload .txt, .docx, or .pdf")

    return text.strip()

def parse_brd_with_gemini(file_path):
    """Parses a BRD text file using Gemini API and saves structured JSON."""
    brd_text = extract_text_from_file(file_path)
    
    print("BRD TEXT: ", brd_text)

    model = genai.GenerativeModel("gemini-2.0-flash")

    prompt = f"""
    You are an expert systems analyst AI that converts Business Requirement Documents (BRDs)
    into detailed structured data for autonomous code generation.

    Extract every possible business and technical detail. Return ONLY valid JSON (no markdown).

    Expected schema:
    {{
      "project_overview": {{
        "name": "",
        "objective": "",
        "business_context": "",
        "modules": [],
        "timeline": "",
        "budget_estimate": ""
      }},
      "stakeholders": {{
        "business_team": [],
        "technical_team": [],
        "approvers": [],
        "end_users": []
      }},
      "functional_requirements": [
        {{
          "id": "",
          "title": "",
          "description": "",
          "priority": "",
          "dependencies": [],
          "input": "",
          "output": "",
          "workflow_steps": []
        }}
      ],
      "non_functional_requirements": [],
      "business_rules": [],
      "data_model": {{
        "entities": []
      }},
      "api_details": [],
      "ui_specifications": [],
      "security_and_compliance": [],
      "risks_and_mitigations": [],
      "assumptions_and_constraints": [],
      "open_questions": [],
      "glossary": []
    }}

    BRD TEXT:
    {brd_text}
    """

    response = model.generate_content(prompt)
    raw_text = response.text.strip()
    print("RAW OUTPUT: ", raw_text)
    # Try to recover JSON even if wrapped in markdown
    try:
        parsed_data = json.loads(raw_text)
    except json.JSONDecodeError:
        json_str = re.search(r"\{.*\}", raw_text, re.DOTALL)
        parsed_data = json.loads(json_str.group()) if json_str else {"error": "Invalid JSON", "raw_output": raw_text}

    ext = os.path.splitext(file_path)[1].lower()
    output_path = os.path.join(
    PARSED_FOLDER,
    os.path.basename(file_path).replace(ext, "_parsed.json")
    )

    

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(parsed_data, f, indent=2)

    return output_path


# ------------------------------
# ROUTES
# ------------------------------

@app.route('/upload', methods=['POST'])
def upload_file():
    try:
        if 'file' not in request.files:
            return jsonify({"error": "No file part"}), 400

        file = request.files['file']
        if file.filename == '':
            return jsonify({"error": "No file selected"}), 400

        filepath = os.path.join(UPLOAD_FOLDER, file.filename)
        file.save(filepath)

        print(f"File saved at: {filepath}")

        parsed_path = parse_brd_with_gemini(filepath)
        print(f"Parsed output saved at: {parsed_path}")

        return jsonify({
            "message": "File processed successfully",
            "parsed_path": parsed_path
        })

    except Exception as e:
        print("ERROR OCCURRED")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500
# ------------------------------
# ENTRY POINT
# ------------------------------

if __name__ == "__main__":
    app.run(port=8000, debug=True)
