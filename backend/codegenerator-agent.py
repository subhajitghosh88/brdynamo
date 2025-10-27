import os
import shutil

file_name = "D:\\EDL-SampleData\\input.txt"
parent_directory  = "D:\\EDL-SampleData"
project_directory = ""

def read_file_and_find_line_for_given_string(file_name:str,search_string:str) -> int:
    try:
        with open(file_name, "r") as file:
            for line_num, line in enumerate(file, 1):  # Start counting from 1 for line numbers
                if search_string in line:
                    print(f"Found '{search_string}' in line {line_num}: {line.strip()}")
                    return line_num

    except FileNotFoundError:
        print(f"Error: The file '{file_name}' was not found.")

    return -1

def fetch_required_lines(file_name:str, found_line_num:int, consider_str: str) -> tuple:
    end_line = -1
    start_line = -1
    try:
        with open(file_name, "r") as file:
            required_lines = False
            for index, line in enumerate(file, 1):  # Start counting from 1 for line numbers
                if consider_str in line and index >= found_line_num:
                    start_line = index
                    required_lines = True
                elif '```' in line and index >= found_line_num and required_lines:
                    end_line = index
                    required_lines = False
                    break
    except FileNotFoundError:
        print(f"Error: The file '{file_name}' was not found.")
    return start_line, end_line

def get_lines_by_range(filename, start_line, end_line) -> list:
    with open(filename, 'r') as file:
        lines = file.readlines()
        # Adjust for 0-based indexing
        final_lines =  lines[start_line :end_line-1]
        final_lines = [line.strip() for line in final_lines]
    return final_lines

def create_folder_and_write_content(project_folder_path:str,content: list, filename: str):
    try:
        os.makedirs(project_folder_path)
        print(f"Folder '{project_folder_path}' created successfully.")
    except FileExistsError:
        print(f"Folder '{project_folder_path}' already exists.")

    with open(os.path.join(project_folder_path, filename), "w") as file:
        for line in content:
            file.write(line + "\n")

def getClassNameFromFile(file_name: str) -> str:
    with open(file_name, 'r') as file:
        for line in file:
            if 'class' in line:
                class_name = line.split('class')[1].split('{')[0].strip()
                return class_name
    return "Main"  # Default class name if not found
def handle_settings_gradle():
   settings_gradle_found = read_file_and_find_line_for_given_string(file_name,'`settings.gradle`')
   start,end = fetch_required_lines(file_name,settings_gradle_found,'```gradle')
   setting_gradle_lines = get_lines_by_range(file_name, start, end)
   folder_name = get_lines_by_range(file_name, start, end)[0].split('=')[1].strip()
   folder_name = folder_name.replace("'","")
   global project_directory
   project_directory = folder_name
   project_folder_path = os.path.join(parent_directory, folder_name)
   create_folder_and_write_content(project_folder_path, setting_gradle_lines, 'settings.gradle')
def handle_build_gradle():
    build_gradle_found = read_file_and_find_line_for_given_string(file_name,'`build.gradle`')
    start,end = fetch_required_lines(file_name,build_gradle_found,'```gradle')
    build_gradle_lines = get_lines_by_range(file_name, start, end)
    project_folder_path = os.path.join(parent_directory, project_directory)
    create_folder_and_write_content(project_folder_path, build_gradle_lines, 'build.gradle')
    
def handle_java_src_code():
    java_src_found = read_file_and_find_line_for_given_string(file_name,'`src/main/java`')
    start,end = fetch_required_lines(file_name,java_src_found,'```java')
    java_src_lines = get_lines_by_range(file_name, start, end)
    project_folder_path = os.path.join(parent_directory, project_directory, 'src', 'main', 'java')
    class_name = getClassNameFromFile(file_name)
    create_folder_and_write_content(project_folder_path, java_src_lines, f'{class_name}.java')

def create_zip_file(project_folder_path: str):
    zip_file_path = os.path.join(parent_directory, f"{project_directory}.zip")
    shutil.make_archive(zip_file_path.replace('.zip', ''), 'zip', project_folder_path)
    print(f"Zip file created at: {zip_file_path}")

def generate_zip_for_project():
    handle_settings_gradle()
    handle_build_gradle()
    handle_java_src_code()
    create_zip_file(os.path.join(parent_directory, project_directory))

generate_zip_for_project()