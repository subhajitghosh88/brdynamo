from flask import Flask, request, jsonify, send_file
from werkzeug.utils import secure_filename
import os
import json
import re
import google.generativeai as genai
from flask_cors import CORS
import traceback
import PyPDF2
from dotenv import load_dotenv
from docx import Document
from codegenerator_agent import CodeGeneratorAgent
from flasgger import Swagger, LazyJSONEncoder

# ------------------------------
# CONFIGURATION
# ------------------------------

load_dotenv()  # Load environment variables
app = Flask(__name__)
CORS(app) 

# Use flasgger's lazy JSON encoder so Swagger can resolve host dynamically
app.json_encoder = LazyJSONEncoder

# Get the directory where this script is located
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

UPLOAD_FOLDER = os.path.join(SCRIPT_DIR, "uploads")
PARSED_FOLDER = os.path.join(SCRIPT_DIR, "parsed_json")
GENERATED_CODE_FOLDER = os.path.join(SCRIPT_DIR, "generated_code")

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(PARSED_FOLDER, exist_ok=True)
os.makedirs(GENERATED_CODE_FOLDER, exist_ok=True)

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
code_generator = CodeGeneratorAgent(GENERATED_CODE_FOLDER)

# ------------------------------
# Swagger / OpenAPI (Flasgger)
# ------------------------------
swagger_template = {
    "swagger": "2.0",
    "info": {
        "title": "BRDynamo API",
        "description": "Upload BRD, parse with Gemini, and generate code",
        "version": "1.0.0",
    },
    "basePath": "/",
    "host": None,  # Dynamically set at runtime
}

@app.before_request
def set_swagger_host():
    if not swagger_template["host"]:
        swagger_template["host"] = request.host

swagger_config = {
    "headers": [],
    "specs": [
        {
            "endpoint": "apispec",
            "route": "/apispec.json",
            "rule_filter": lambda rule: True,
            "model_filter": lambda tag: True,
        }
    ],
    "static_url_path": "/flasgger_static",
    "swagger_ui": True,
    "specs_route": "/apidocs/",
}

Swagger(app, template=swagger_template, config=swagger_config)

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
    # Remove code block markers from generated content
    raw_text = raw_text.replace("```java", "").replace("```", "").strip()

    # Debugging: Print raw_text after removing code block markers
    print("Processed RAW OUTPUT:", raw_text)

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

    # Ensure the output directory exists
    os.makedirs(PARSED_FOLDER, exist_ok=True)

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(parsed_data, f, indent=2)

    return output_path


# ------------------------------
# ROUTES
# ------------------------------

@app.route('/upload', methods=['POST'])
def upload_file():
    """Upload BRD file

    ---
    consumes:
      - multipart/form-data
    parameters:
      - name: file
        in: formData
        type: file
        required: true
        description: BRD file (.txt, .docx, .pdf)
    responses:
      200:
        description: File processed successfully
        schema:
          type: object
          properties:
            message:
              type: string
            uploaded_file:
              type: string
            parsed_content:
              type: object
            generated_files:
              type: array
              items:
                type: string
      400:
        description: Missing file
      500:
        description: Server error
    """
    try:
        if 'file' not in request.files:
            return jsonify({"error": "No file part"}), 400

        file = request.files['file']
        if file.filename == '':
            return jsonify({"error": "No file selected"}), 400

        filepath = os.path.join(UPLOAD_FOLDER, secure_filename(file.filename))
        
        # Ensure upload directory exists before saving
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        
        file.save(filepath)

        print(f"File saved at: {filepath}")

        parsed_path = parse_brd_with_gemini(filepath)
        print(f"Parsed output saved at: {parsed_path}")

        with open(parsed_path, 'r') as f:
            parsed_data = json.load(f)

        # Generate code based on parsed BRD
        generated_files = code_generator.generate_code_from_brd(parsed_data)
        code_generator.save_generated_code(generated_files)

        return jsonify({
            "message": "File processed and code generated successfully",
            "uploaded_file": filepath,
            "parsed_content": parsed_data,
            "generated_files": list(generated_files.keys())
        })

    except Exception as e:
        print("ERROR OCCURRED")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route('/generated-files', methods=['GET'])
def get_generated_files():
    """Return generated files as JSON mapping relative-path -> content.

    ---
    responses:
      200:
        description: Successfully retrieved generated files
        schema:
          type: object
          additionalProperties:
            type: string
      500:
        description: Server error
    """
    try:
        result = {}
        for root, _, files in os.walk(GENERATED_CODE_FOLDER):
            for fname in files:
                # skip zip artifacts
                if fname.endswith('.zip'):
                    continue
                full = os.path.join(root, fname)
                # normalize path separators to forward slashes for JSON keys
                rel = os.path.relpath(full, GENERATED_CODE_FOLDER).replace('\\', '/')
                try:
                    with open(full, 'r', encoding='utf-8', errors='ignore') as f:
                        result[rel] = f.read()
                except Exception:
                    # binary files or unreadable files are represented as a placeholder
                    result[rel] = '<binary or unreadable file>'
        return jsonify(result)
    except Exception as e:
        print('ERROR listing generated files', e)
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/generated-code/status', methods=['GET'])
def generated_code_status():
    """Return JSON { ready: true/false } indicating whether the zip exists.

    ---
    responses:
      200:
        description: ZIP file status
        schema:
          type: object
          properties:
            ready:
              type: boolean
      500:
        description: Server error
    """
    try:
        zip_path = os.path.join(GENERATED_CODE_FOLDER, 'generated_package.zip')
        ready = os.path.exists(zip_path)
        return jsonify({'ready': ready})
    except Exception as e:
        print("ERROR checking generated zip status:", e)
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/generated-code', methods=['GET'])
def get_generated_code():
    """Download generated code as a ZIP file.

    ---
    responses:
      200:
        description: Successfully downloaded ZIP file
        schema:
          type: string
          format: binary
      404:
        description: ZIP file not found
      500:
        description: Server error
    """
    try:
        # Prefer the zip produced by the generator
        package_zip = os.path.join(GENERATED_CODE_FOLDER, 'generated_package.zip')
        if os.path.exists(package_zip):
            zip_path = package_zip
        else:
            # Create a zip from the generated folder, excluding zip files
            zip_path = os.path.join(GENERATED_CODE_FOLDER, 'generated_code_temp.zip')
            import shutil
            if os.path.exists(zip_path):
                os.remove(zip_path)
            
            # Find the project folder (any directory that's not hidden)
            project_folders = [d for d in os.listdir(GENERATED_CODE_FOLDER) 
                             if os.path.isdir(os.path.join(GENERATED_CODE_FOLDER, d)) 
                             and not d.startswith('.')]
            
            if project_folders:
                # Zip only the project folder, not the entire generated_code folder
                project_path = os.path.join(GENERATED_CODE_FOLDER, project_folders[0])
                print(f"Creating zip from project folder: {project_path}")
                shutil.make_archive(zip_path[:-4], 'zip', project_path)
            else:
                print("No project folder found, creating empty zip")
                # Create empty zip if no project folder exists
                import zipfile
                with zipfile.ZipFile(zip_path, 'w') as zipf:
                    pass

        return send_file(
            zip_path,
            mimetype='application/zip',
            as_attachment=True,
            download_name='generated_package.zip'
        )

    except Exception as e:
        print("ERROR OCCURRED")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route('/diagrams', methods=['GET'])
def get_diagrams():
    """Return all generated architecture diagrams.
    ---
    tags:
      - Diagrams
    responses:
      200:
        description: Successfully retrieved diagrams
        schema:
          type: object
          properties:
            diagrams:
              type: object
              description: Map of diagram paths to their content/metadata
            summary:
              type: object
              properties:
                total_diagrams:
                  type: integer
                puml_files:
                  type: integer
                svg_files:
                  type: integer
                png_files:
                  type: integer
      500:
        description: Server error
    """
    try:
        diagrams = {}
        summary = {
            "total_diagrams": 0,
            "puml_files": 0,
            "svg_files": 0,
            "png_files": 0
        }
        
        # Look for diagram files in generated projects
        for root, dirs, files in os.walk(GENERATED_CODE_FOLDER):
            normalized_root = root.replace('\\', '/')
            
            for fname in files:
                if 'docs/diagrams' in normalized_root:
                    full_path = os.path.join(root, fname)
                    rel_path = os.path.relpath(full_path, GENERATED_CODE_FOLDER).replace('\\', '/')
                    
                    try:
                        if fname.endswith('.puml'):
                            # PlantUML source files
                            with open(full_path, 'r', encoding='utf-8') as f:
                                diagrams[rel_path] = {
                                    "type": "plantuml",
                                    "content": f.read(),
                                    "format": "text"
                                }
                            summary["puml_files"] += 1
                        elif fname.endswith('.svg'):
                            # SVG files
                            with open(full_path, 'r', encoding='utf-8') as f:
                                diagrams[rel_path] = {
                                    "type": "svg",
                                    "content": f.read(),
                                    "format": "svg"
                                }
                            summary["svg_files"] += 1
                        elif fname.endswith('.png'):
                            # PNG files (base64 encoded)
                            import base64
                            with open(full_path, 'rb') as f:
                                diagrams[rel_path] = {
                                    "type": "png",
                                    "content": base64.b64encode(f.read()).decode('ascii'),
                                    "format": "base64"
                                }
                            summary["png_files"] += 1
                        elif fname == 'README.md':
                            # README files
                            with open(full_path, 'r', encoding='utf-8') as f:
                                diagrams[rel_path] = {
                                    "type": "markdown",
                                    "content": f.read(),
                                    "format": "text"
                                }
                    except Exception as e:
                        print(f"Error reading diagram file {rel_path}: {e}")
                        diagrams[rel_path] = {
                            "type": "error",
                            "content": f"Error reading file: {str(e)}",
                            "format": "text"
                        }
                    
                    summary["total_diagrams"] += 1
        
        return jsonify({
            "diagrams": diagrams,
            "summary": summary
        })
        
    except Exception as e:
        print('ERROR listing diagrams', e)
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/jira-stories', methods=['GET'])
def get_jira_stories():
    """Return all generated JIRA stories and project management files.
    ---
    tags:
      - JIRA
    responses:
      200:
        description: Successfully retrieved JIRA stories
        schema:
          type: object
          properties:
            files:
              type: object
              description: Map of file names to their content
            summary:
              type: object
              properties:
                total_files:
                  type: integer
                project_name:
                  type: string
      500:
        description: Server error
    """
    try:
        files = {}
        summary = {
            "total_files": 0,
            "project_name": None
        }
        
        # Look for project-management files in generated projects
        for root, dirs, filenames in os.walk(GENERATED_CODE_FOLDER):
            normalized_root = root.replace('\\', '/')
            
            # Check if this is a project-management folder
            if 'project-management' in normalized_root:
                # Extract project name from path
                if not summary["project_name"]:
                    parts = normalized_root.split('/')
                    for i, part in enumerate(parts):
                        if part == 'generated_code' and i + 1 < len(parts):
                            summary["project_name"] = parts[i + 1]
                            break
                
                for fname in filenames:
                    if fname.endswith(('.md', '.csv', '.txt')):
                        full_path = os.path.join(root, fname)
                        
                        try:
                            with open(full_path, 'r', encoding='utf-8') as f:
                                files[fname] = f.read()
                            summary["total_files"] += 1
                        except Exception as file_error:
                            print(f'Error reading {full_path}: {file_error}')
                            continue
        
        return jsonify({
            "files": files,
            "summary": summary
        })
        
    except Exception as e:
        print('ERROR listing JIRA stories', e)
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


# ------------------------------
# ENTRY POINT
# ------------------------------

if __name__ == "__main__":
    app.run(port=8000, debug=True)

