import os
import json
import re
import zipfile
from typing import Dict, List
import google.generativeai as genai


class CodeGeneratorAgent:
    def __init__(self, output_dir: str):
        """Initialize the code generator with output directory."""
        self.output_dir = output_dir
        self.model = genai.GenerativeModel("gemini-2.0-flash")
        # NOTE: simplified: no retries/wrappers — direct model calls

    def generate_code_from_brd(self, parsed_brd: Dict) -> Dict:
        """Generate code based on parsed BRD structure."""
        generated_files = {}
        backend_code = self._generate_backend_code(parsed_brd)
        generated_files.update(backend_code)
        return generated_files
    
    def _generate_backend_code(self, parsed_brd: Dict) -> Dict:
        """Generate Spring Boot backend code including models, repositories, and controllers."""
        files = {}
        # Use a single consolidated prompt to generate the entire Spring Boot project structure
        full_prompt = self._create_spring_full_project_prompt(parsed_brd)
        # Direct model call (no retries/wrappers)
        resp = self.model.generate_content(full_prompt)

        # Try to split model output into files using the separator lines the
        # prompt requests (=== filename: <path> ===). If no separators are
        # found, fall back to a single file containing the raw response.
        parsed_files = self._split_model_output_to_files(resp.text)
        if parsed_files:
            files.update(parsed_files)
        else:
            files["spring-boot/GENERATED_OUTPUT.txt"] = resp.text

        # Persist files to disk under output_dir
        self.save_generated_code(files)

        # Create a zip archive of the generated package for easy download
        zip_path = os.path.join(self.output_dir, "generated_package.zip")
        self._create_zip_from_files(files, zip_path)

        return files

    # Note: older per-file Spring prompt helpers were removed in favor of
    # the single consolidated `_create_spring_full_project_prompt` which
    # asks the model to emit the full project using filename separators.

    def _create_spring_full_project_prompt(self, parsed_brd: Dict) -> str:
        """Create a minimal single prompt instructing the model to emit the full Spring Boot project.

        The model should output multiple files using the separator:
        === filename: <path> ===\n<file contents>\n
        """
        entities = parsed_brd.get("data_model", {}).get("entities", [])
        requirements = parsed_brd.get("functional_requirements", [])
        nonfunc = parsed_brd.get("non_functional_requirements", [])

        prompt = (
            "You are an expert Java/Spring developer. Generate a complete Spring Boot project for the following application. "
            + "Produce all source files and a pom.xml. Output multiple files in plain text using this exact separator line before each file:\n"
            + "=== filename: <relative-path> ===\n<file contents>\n\n"
            + "Include package names under com.brdynamo. The project must include: entities (JPA), repositories (Spring Data), services, controllers (REST), main application class, application.properties template, and pom.xml."
            + " Use UUID for primary keys, Lombok for boilerplate, and sensible exception handling. Ensure controllers expose standard CRUD endpoints."
            + "\n\nApplication data (JSON):\n"
            + json.dumps({"entities": entities, "requirements": requirements, "non_functional_requirements": nonfunc}, indent=2)
            + "\n\nStart output now."
        )
        return prompt

    def _split_model_output_to_files(self, text: str) -> Dict[str, str]:
        """Split model output into a dict of path -> content using separators.

        Expected separator format (exact):
        === filename: <relative-path> ===\n<file contents>\n
        Returns an empty dict when no separators are found.
        """
        files: Dict[str, str] = {}
        pattern = r"^=== filename:\s*(.+?)\s*===\s*\n(.*?)(?=^=== filename:|\Z)"
        matches = re.findall(pattern, text, flags=re.DOTALL | re.MULTILINE)
        for path, content in matches:
            p = path.strip()
            files[p] = content.rstrip() + "\n"
        return files

    def _create_zip_from_files(self, files: Dict[str, str], zip_path: str) -> None:
        """Create a zip archive at zip_path containing the given files.

        Each key in `files` is treated as a relative path inside the zip.
        """
        try:
            with zipfile.ZipFile(zip_path, 'w', compression=zipfile.ZIP_DEFLATED) as zf:
                for rel_path, content in files.items():
                    # Normalize slashes for zip
                    arcname = rel_path.replace('\\', '/')
                    zf.writestr(arcname, content)
        except Exception as e:
            print(f"Failed to create zip {zip_path}: {e}")
    
    def save_generated_code(self, generated_files: Dict) -> None:
        """Save generated code to output directory."""
        for file_path, content in generated_files.items():
            try:
                full_path = os.path.join(self.output_dir, file_path)
                os.makedirs(os.path.dirname(full_path), exist_ok=True)
                with open(full_path, "w") as f:
                    f.write(content)
            except Exception as e:
                print(f"Error saving file {file_path}: {str(e)}")
