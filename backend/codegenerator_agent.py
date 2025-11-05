import os
import json
import re
import base64
import requests
import zlib
from typing import Dict, List
import google.generativeai as genai


class CodeGeneratorAgent:
    def __init__(self, output_dir: str):
        """Initialize the code generator with output directory."""
        self.output_dir = output_dir
        self.model = genai.GenerativeModel("gemini-2.0-flash")
        # NOTE: simplified: no retries/wrappers — direct model calls
    
    def _get_current_timestamp(self) -> str:
        """Get current timestamp for documentation."""
        from datetime import datetime
        return datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    def _generate_project_name(self, project_name: str) -> tuple:
        """Generate clean, meaningful project names from BRD project name."""
        # Extract key words and create abbreviated names
        words = re.findall(r'[A-Za-z]+', project_name.lower())
        
        # Common words to filter out for shorter names
        stop_words = {'system', 'platform', 'application', 'app', 'management', 'service', 'api', 'web', 'portal', 'solution', 'for', 'the', 'and', 'or', 'of', 'in', 'on', 'at', 'to', 'from', 'by', 'with', 'brd', 'test'}
        meaningful_words = [word for word in words if word not in stop_words and len(word) > 2]
        
        # Create short name using first few meaningful words or abbreviation
        if len(meaningful_words) >= 2:
            # Use first 2-3 meaningful words
            short_name = '-'.join(meaningful_words[:3])
        elif len(meaningful_words) == 1:
            short_name = meaningful_words[0]
        else:
            # Fallback: use first letters of all words
            short_name = ''.join(word[0] for word in words if word)[:6]
        
        # Limit length and ensure it's meaningful
        if len(short_name) > 20:
            short_name = short_name[:20].rstrip('-')
        
        clean_name = re.sub(r'[^a-zA-Z0-9\-]', '', short_name)
        demo_project_name = clean_name  # Remove "demo-" and "-starter" prefixes/suffixes
        package_name = clean_name.replace('-', '')
        
        return clean_name, demo_project_name, package_name

    def generate_code_from_brd(self, parsed_brd: Dict) -> Dict:
        """Generate all code and documentation in a single comprehensive API call."""
        # Use single comprehensive prompt to avoid rate limiting
        comprehensive_prompt = self._create_comprehensive_prompt(parsed_brd)
        
        print("=== SENDING PROMPT TO AI ===")
        print(f"Prompt length: {len(comprehensive_prompt)} characters")
        
        # Single API call for everything
        resp = self.model.generate_content(comprehensive_prompt)
        
        print("=== AI RESPONSE RECEIVED ===")
        print(f"Response length: {len(resp.text)} characters")
        print("=== FIRST 1000 CHARS OF RESPONSE ===")
        print(resp.text[:1000])
        print("=== LAST 1000 CHARS OF RESPONSE ===")
        print(resp.text[-1000:])
        
        # Parse the comprehensive response
        all_files = self._split_model_output_to_files(resp.text)
        
        print(f"=== PARSED FILES COUNT: {len(all_files)} ===")
        for file_path in sorted(all_files.keys()):
            print(f"  - {file_path}")
        
        # Count test files specifically
        test_files = [f for f in all_files.keys() if '/test/' in f or 'Test' in f]
        print(f"=== TEST FILES FOUND: {len(test_files)} ===")
        for test_file in test_files:
            print(f"  - TEST: {test_file}")
        
        # If parsing fails, add non-API generated content
        if not all_files:
            print("WARNING: No files parsed from AI response!")
            all_files = {}
        
        # Add non-API generated content (GitHub workflows, database scripts, JIRA stories, diagrams)
        all_files.update(self._generate_github_workflows(parsed_brd))
        all_files.update(self._generate_database_scripts(parsed_brd))
        all_files.update(self._generate_jira_stories(parsed_brd))
        all_files.update(self._generate_architecture_diagrams(parsed_brd))
        
        return all_files

    def _create_comprehensive_prompt(self, parsed_brd: Dict) -> str:
        """Create a single comprehensive prompt that generates all code at once."""
        entities = parsed_brd.get("data_model", {}).get("entities", [])
        requirements = parsed_brd.get("functional_requirements", [])
        nonfunc = parsed_brd.get("non_functional_requirements", [])

        # Extract project name for demo naming convention
        project_name = parsed_brd.get("project_overview", {}).get("name", "spring-app")
        clean_name, demo_project_name, package_name = self._generate_project_name(project_name)
        
        prompt = (
            f"You are an expert Java/Spring developer and test engineer. Generate a COMPLETE Spring Boot project named '{demo_project_name}' "
            + "with ALL associated files including source code, tests, test data, and build configurations. "
            + f"Use the exact separator format: === filename: {demo_project_name}/<path> ===\n\n"
            + f"CRITICAL: Generate ALL files in a single response. ALL files must be nested under '{demo_project_name}/' directory.\n\n"
            + "GENERATE THE FOLLOWING COMPLETE PROJECT STRUCTURE:\n\n"
            + "1. SPRING BOOT APPLICATION FILES:\n"
            + f"- {demo_project_name}/pom.xml (Maven with Spring Boot, JPA, H2, TestContainers, JUnit 5, Mockito, JavaFaker)\n"
            + f"- {demo_project_name}/build.gradle (Gradle equivalent with same dependencies)\n"
            + f"- {demo_project_name}/gradle/wrapper/gradle-wrapper.properties\n"
            + f"- {demo_project_name}/gradlew (Unix wrapper script)\n"
            + f"- {demo_project_name}/gradlew.bat (Windows wrapper script)\n"
            + f"- {demo_project_name}/src/main/java/com/brdynamo/{package_name}/*Application.java (Main class)\n"
            + f"- {demo_project_name}/src/main/java/com/brdynamo/{package_name}/entity/*.java (JPA Entities with UUID, Lombok)\n"
            + f"- {demo_project_name}/src/main/java/com/brdynamo/{package_name}/repository/*.java (Spring Data JPA repositories)\n"
            + f"- {demo_project_name}/src/main/java/com/brdynamo/{package_name}/service/*.java (Business logic services)\n"
            + f"- {demo_project_name}/src/main/java/com/brdynamo/{package_name}/controller/*.java (REST controllers with CRUD)\n"
            + f"- {demo_project_name}/src/main/java/com/brdynamo/{package_name}/exception/*.java (Custom exceptions)\n"
            + f"- {demo_project_name}/src/main/resources/application.properties (Spring configuration)\n\n"
            + "2. COMPREHENSIVE TEST FILES:\n"
            + f"- {demo_project_name}/src/test/java/com/brdynamo/{package_name}/*ApplicationTests.java (Integration tests)\n"
            + f"- {demo_project_name}/src/test/java/com/brdynamo/{package_name}/controller/*ControllerTest.java (Controller unit tests)\n"
            + f"- {demo_project_name}/src/test/java/com/brdynamo/{package_name}/service/*ServiceTest.java (Service unit tests)\n"
            + f"- {demo_project_name}/src/test/java/com/brdynamo/{package_name}/repository/*RepositoryTest.java (Repository tests)\n"
            + f"- {demo_project_name}/src/test/resources/application-test.properties (Test configuration)\n\n"
            + "3. TEST DATA AND FIXTURES:\n"
            + f"- {demo_project_name}/src/test/java/com/brdynamo/{package_name}/testdata/*TestDataBuilder.java (JavaFaker test data builders)\n"
            + f"- {demo_project_name}/src/test/java/com/brdynamo/{package_name}/util/TestDataGenerator.java (Test data utilities)\n"
            + f"- {demo_project_name}/src/test/resources/fixtures/*.json (JSON test fixtures for each entity)\n\n"
            + "REQUIREMENTS:\n"
            + "- Use UUID for all primary keys\n"
            + "- Include Lombok annotations (@Data, @Entity, @NoArgsConstructor, @AllArgsConstructor)\n"
            + "- Implement proper REST endpoints (GET, POST, PUT, DELETE)\n"
            + "- Add comprehensive error handling and custom exceptions\n"
            + "- Include validation annotations (@NotNull, @Size, etc.)\n"
            + "- Generate realistic test data using JavaFaker library\n"
            + "- Create both unit tests (with @MockBean) and integration tests (@SpringBootTest)\n"
            + "- Include TestContainers for database integration testing\n"
            + "- Add proper JSON fixtures for API testing\n"
            + f"- Package structure: com.brdynamo.{package_name}\n\n"
            + "APPLICATION DATA:\n"
            + json.dumps({"entities": entities, "requirements": requirements, "non_functional_requirements": nonfunc}, indent=2)
            + "\n\nGenerate ALL files now with proper content. Start output immediately."
        )
        return prompt

    def _split_model_output_to_files(self, text: str) -> Dict[str, str]:
        """Split model output into a dict of path -> content using separators.

        Expected separator format (exact):
        === filename: <relative-path> ===\n<file contents>\n
        Returns an empty dict when no separators are found.
        """
        files: Dict[str, str] = {}
        
        # Try primary pattern first
        pattern = r"^=== filename:\s*(.+?)\s*===\s*\n(.*?)(?=^=== filename:|\Z)"
        matches = re.findall(pattern, text, flags=re.DOTALL | re.MULTILINE)
        
        print(f"=== PRIMARY PATTERN MATCHES: {len(matches)} ===")
        
        # If no matches, try alternative patterns
        if not matches:
            print("Trying alternative separator patterns...")
            
            # Try without newline requirement
            alt_pattern1 = r"=== filename:\s*(.+?)\s*===(.*?)(?==== filename:|\Z)"
            matches = re.findall(alt_pattern1, text, flags=re.DOTALL)
            print(f"Alternative pattern 1 matches: {len(matches)}")
            
            # Try with different separator format
            if not matches:
                alt_pattern2 = r"```\s*filename:\s*(.+?)\s*```(.*?)(?=```\s*filename:|\Z)"
                matches = re.findall(alt_pattern2, text, flags=re.DOTALL)
                print(f"Alternative pattern 2 matches: {len(matches)}")
        
        for path, content in matches:
            p = path.strip()
            # Clean up content - remove leading/trailing whitespace but preserve internal structure
            clean_content = content.strip()
            if clean_content:
                files[p] = clean_content + "\n"
                
        print(f"=== FILES EXTRACTED: {len(files)} ===")
        if not files:
            print("=== SAMPLE OF RAW TEXT (first 2000 chars) ===")
            print(text[:2000])
            print("=== SEARCHING FOR SEPARATOR PATTERNS ===")
            separator_count = text.count("=== filename:")
            print(f"Found {separator_count} instances of '=== filename:' in text")
        
        return files

    def _generate_github_workflows(self, parsed_brd: Dict) -> Dict:
        """Generate GitHub Actions workflows for CI/CD."""
        project_name = parsed_brd.get("project_overview", {}).get("name", "spring-app")
        clean_name, demo_project_name, package_name = self._generate_project_name(project_name)
        
        # CI/CD Workflow
        ci_workflow = f"""name: {demo_project_name} CI/CD Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:13
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: testdb
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Set up JDK 17
      uses: actions/setup-java@v3
      with:
        java-version: '17'
        distribution: 'temurin'
    
    - name: Cache Maven packages
      uses: actions/cache@v3
      with:
        path: ~/.m2
        key: ${{{{ runner.os }}}}-m2-${{{{ hashFiles('**/pom.xml') }}}}
        restore-keys: ${{{{ runner.os }}}}-m2
    
    - name: Run tests
      run: mvn clean test
    
    - name: Generate test report
      uses: dorny/test-reporter@v1
      if: success() || failure()
      with:
        name: Maven Tests
        path: target/surefire-reports/*.xml
        reporter: java-junit

  build:
    needs: test
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Set up JDK 17
      uses: actions/setup-java@v3
      with:
        java-version: '17'
        distribution: 'temurin'
    
    - name: Build with Maven
      run: mvn clean package -DskipTests
    
    - name: Build Docker image
      run: |
        docker build -t {project_name.lower().replace(' ', '-')}:latest .
    
    - name: Upload artifacts
      uses: actions/upload-artifact@v3
      with:
        name: jar-artifact
        path: target/*.jar

  deploy-dev:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/develop'
    
    steps:
    - name: Deploy to Development
      run: echo "Deploying to development environment"

  deploy-prod:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
    - name: Deploy to Production
      run: echo "Deploying to production environment"
"""

        # Dockerfile
        dockerfile = """FROM openjdk:17-jdk-slim

WORKDIR /app

COPY target/*.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]
"""

        # Docker Compose for local development
        docker_compose = """version: '3.8'

services:
  app:
    build: .
    ports:
      - "8080:8080"
    depends_on:
      - postgres
    environment:
      - SPRING_PROFILES_ACTIVE=docker
      - SPRING_DATASOURCE_URL=jdbc:postgresql://postgres:5432/appdb
      - SPRING_DATASOURCE_USERNAME=postgres
      - SPRING_DATASOURCE_PASSWORD=postgres

  postgres:
    image: postgres:13
    environment:
      POSTGRES_DB: appdb
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
"""

        return {
            f"{demo_project_name}/.github/workflows/ci-cd.yml": ci_workflow,
            f"{demo_project_name}/Dockerfile": dockerfile,
            f"{demo_project_name}/docker-compose.yml": docker_compose
        }

    def _generate_database_scripts(self, parsed_brd: Dict) -> Dict:
        """Generate database scripts for Oracle and MongoDB."""
        entities = parsed_brd.get("data_model", {}).get("entities", [])
        project_name = parsed_brd.get("project_overview", {}).get("name", "Project")
        clean_name, demo_project_name, package_name = self._generate_project_name(project_name)
        
        # Oracle SQL scripts
        oracle_script = "-- Oracle Database Schema Script\n"
        oracle_script += f"-- Generated for {demo_project_name}\n\n"
        
        for entity in entities:
            table_name = entity.get("name", "").upper()
            oracle_script += f"-- Table: {table_name}\n"
            oracle_script += f"CREATE TABLE {table_name} (\n"
            
            for attr in entity.get("attributes", []):
                attr_name = attr.get("name", "").upper()
                attr_type = attr.get("type", "VARCHAR2(255)")
                
                # Convert common types to Oracle types
                if attr_type.lower() == "uuid":
                    oracle_type = "RAW(16)"
                elif attr_type.lower() in ["string", "text"]:
                    oracle_type = "VARCHAR2(255)"
                elif attr_type.lower() == "integer":
                    oracle_type = "NUMBER(10)"
                elif attr_type.lower() == "decimal":
                    oracle_type = "NUMBER(19,2)"
                elif attr_type.lower() == "timestamp":
                    oracle_type = "TIMESTAMP"
                else:
                    oracle_type = "VARCHAR2(255)"
                
                oracle_script += f"    {attr_name} {oracle_type}"
                
                if "primary" in attr.get("constraints", []):
                    oracle_script += " PRIMARY KEY"
                elif "not null" in attr.get("constraints", []):
                    oracle_script += " NOT NULL"
                
                oracle_script += ",\n"
            
            oracle_script = oracle_script.rstrip(",\n") + "\n);\n\n"
            
            # Add sequences for UUID/ID fields
            oracle_script += f"CREATE SEQUENCE {table_name}_SEQ START WITH 1 INCREMENT BY 1;\n\n"

        # MongoDB scripts
        mongodb_script = "// MongoDB Collection Schema Scripts\n"
        mongodb_script += "// Generated for " + parsed_brd.get("project_overview", {}).get("name", "Application") + "\n\n"
        
        for entity in entities:
            collection_name = entity.get("name", "").lower() + "s"
            mongodb_script += f"// Collection: {collection_name}\n"
            mongodb_script += f"db.createCollection('{collection_name}');\n\n"
            
            # Create indexes
            mongodb_script += f"// Indexes for {collection_name}\n"
            for attr in entity.get("attributes", []):
                if "primary" in attr.get("constraints", []):
                    mongodb_script += f"db.{collection_name}.createIndex({{'{attr.get('name', '')}': 1}}, {{unique: true}});\n"
            
            mongodb_script += "\n"
            
            # Sample document structure
            mongodb_script += f"// Sample document structure for {collection_name}\n"
            mongodb_script += f"db.{collection_name}.insertOne({{\n"
            for attr in entity.get("attributes", []):
                attr_name = attr.get("name", "")
                attr_type = attr.get("type", "")
                
                if attr_type.lower() == "uuid":
                    sample_value = "ObjectId()"
                elif attr_type.lower() == "string":
                    sample_value = f'"{attr_name}_example"'
                elif attr_type.lower() == "integer":
                    sample_value = "123"
                elif attr_type.lower() == "decimal":
                    sample_value = "99.99"
                elif attr_type.lower() == "timestamp":
                    sample_value = "new Date()"
                else:
                    sample_value = f'"{attr_name}_value"'
                
                mongodb_script += f'    "{attr_name}": {sample_value},\n'
            
            mongodb_script = mongodb_script.rstrip(",\n") + "\n});\n\n"

        return {
            f"{demo_project_name}/database/oracle/schema.sql": oracle_script,
            f"{demo_project_name}/database/oracle/indexes.sql": "-- Oracle Indexes\n-- Add performance indexes here\n",
            f"{demo_project_name}/database/mongodb/collections.js": mongodb_script,
            f"{demo_project_name}/database/mongodb/indexes.js": "-- MongoDB Indexes\n-- Add performance indexes here\n"
        }

    def _generate_jira_stories(self, parsed_brd: Dict) -> Dict:
        """Generate specific, actionable JIRA stories based on the actual BRD requirements.
        
        Creates real JIRA stories that can be directly imported into JIRA, including:
        - Specific user stories for each entity with CRUD operations
        - Implementation stories for each functional requirement
        - API endpoint development stories
        - Business rules and validation stories
        - Testing and DevOps stories
        - CSV file for direct JIRA import
        - Comprehensive sprint planning guide
        """
        project_overview = parsed_brd.get("project_overview", {})
        project_name = project_overview.get("name", "Project")
        project_description = project_overview.get("description", "")
        clean_name, demo_project_name, package_name = self._generate_project_name(project_name)
        
        requirements = parsed_brd.get("functional_requirements", [])
        entities = parsed_brd.get("data_model", {}).get("entities", [])
        api_endpoints = parsed_brd.get("api_specifications", {}).get("endpoints", [])
        business_rules = parsed_brd.get("business_rules", [])
        
        # Generate comprehensive JIRA stories document
        jira_stories = f"""# {project_name} - JIRA Epic and User Stories
# Generated on: {self._get_current_timestamp()}
# Project Description: {project_description}

## Project Overview
**Project Key:** {clean_name.upper()}
**Project Type:** Software Development
**Project Lead:** [To be assigned]
**Target Release:** [To be determined]

"""

        # Generate CSV header for JIRA import
        csv_stories = "Issue Type,Summary,Description,Priority,Story Points,Epic Name,Assignee,Labels,Acceptance Criteria\n"
        
        story_id = 1

        # Epic 1: Data Model Implementation
        jira_stories += f"""## Epic 1: Data Model and Entities Implementation
**Epic Name:** DATA-MODEL
**Epic Summary:** Implement all data entities and database schema for {project_name}
**Epic Description:** Create and implement all data models, entities, and database structures required for the {project_name} system.

### User Stories:

"""
        
        for entity in entities:
            entity_name = entity.get("name", "Entity")
            entity_fields = entity.get("attributes", [])
            field_list = ", ".join([f["name"] for f in entity_fields]) if entity_fields else "Standard fields"
            
            # Generate story for each entity
            jira_stories += f"""#### {clean_name.upper()}-{story_id}: Create {entity_name} Entity and CRUD Operations
**Story Type:** Story
**Story Points:** 3
**Priority:** High
**Epic:** DATA-MODEL

**User Story:**
As a developer, I want to create a {entity_name} entity with full CRUD operations so that the system can manage {entity_name.lower()} data effectively.

**Description:**
Implement the {entity_name} entity with the following fields: {field_list}. Include repository, service layer, and REST controller with full CRUD operations.

**Acceptance Criteria:**
- [ ] {entity_name} JPA entity created with fields: {field_list}
- [ ] {entity_name}Repository interface extends JpaRepository
- [ ] {entity_name}Service implements business logic and validation
- [ ] {entity_name}Controller provides REST endpoints (GET, POST, PUT, DELETE)
- [ ] Custom exceptions for {entity_name} not found scenarios
- [ ] Unit tests for service layer (minimum 80% coverage)
- [ ] Integration tests for controller endpoints
- [ ] OpenAPI documentation for all endpoints

**Technical Tasks:**
- Create {entity_name}.java entity class
- Create {entity_name}Repository.java interface
- Create {entity_name}Service.java service class
- Create {entity_name}Controller.java REST controller
- Write unit tests for {entity_name}Service
- Write integration tests for {entity_name}Controller
- Update database migration scripts

---

"""
            # Add CSV entry
            csv_stories += f'Story,"{clean_name.upper()}-{story_id}: Create {entity_name} Entity","Implement {entity_name} entity with CRUD operations including fields: {field_list}",High,3,DATA-MODEL,[Assignee],backend entity crud,"{field_list} entity created; Repository and Service implemented; REST endpoints available; Tests written"\n'
            story_id += 1

        # Epic 2: Functional Requirements Implementation
        if requirements:
            jira_stories += f"""## Epic 2: Functional Requirements Implementation
**Epic Name:** FUNCTIONAL-REQS
**Epic Summary:** Implement all functional requirements for {project_name}
**Epic Description:** Develop all specific functional requirements and business features as defined in the BRD.

### User Stories:

"""
            
            for req in requirements:
                req_title = req.get("title", f"Requirement {story_id}")
                req_description = req.get("description", "")
                priority = req.get("priority", "Medium")
                story_points = 5 if priority == "High" else 3 if priority == "Medium" else 2
                
                jira_stories += f"""#### {clean_name.upper()}-{story_id}: {req_title}
**Story Type:** Story
**Story Points:** {story_points}
**Priority:** {priority}
**Epic:** FUNCTIONAL-REQS

**User Story:**
As a user, I want {req_description} so that I can accomplish my business goals effectively.

**Description:**
Implement the functional requirement: {req_title}. 
{req_description}

**Acceptance Criteria:**
- [ ] Requirement "{req_title}" is fully implemented
- [ ] Business logic follows the specifications in BRD
- [ ] All edge cases and error scenarios are handled
- [ ] API endpoints are created and documented
- [ ] Input validation is implemented
- [ ] Unit tests cover all business logic paths
- [ ] Integration tests verify end-to-end functionality
- [ ] User documentation is updated

**Business Value:**
This feature directly supports the core business objectives of the {project_name} system.

---

"""
                # Add CSV entry
                csv_stories += f'Story,"{clean_name.upper()}-{story_id}: {req_title}","{req_description}",{priority},{story_points},FUNCTIONAL-REQS,[Assignee],requirement business-logic,"{req_title} implemented; Business logic working; API documented; Tests passing"\n'
                story_id += 1

        # Epic 3: API Endpoints Implementation
        if api_endpoints:
            jira_stories += f"""## Epic 3: API Endpoints and Integration
**Epic Name:** API-ENDPOINTS
**Epic Summary:** Implement all REST API endpoints for {project_name}
**Epic Description:** Develop all API endpoints as specified in the API documentation with proper error handling and validation.

### User Stories:

"""
            
            for endpoint in api_endpoints:
                endpoint_path = endpoint.get("path", "/api/endpoint")
                method = endpoint.get("method", "GET")
                description = endpoint.get("description", f"{method} endpoint")
                
                jira_stories += f"""#### {clean_name.upper()}-{story_id}: Implement {method} {endpoint_path} API Endpoint
**Story Type:** Story
**Story Points:** 2
**Priority:** Medium
**Epic:** API-ENDPOINTS

**User Story:**
As a client application, I want to access the {method} {endpoint_path} endpoint so that I can {description.lower()}.

**Description:**
Implement the {method} {endpoint_path} API endpoint with proper request/response handling, validation, and error management.

**Acceptance Criteria:**
- [ ] {method} {endpoint_path} endpoint is implemented
- [ ] Request validation is in place
- [ ] Proper HTTP status codes are returned
- [ ] Response format matches API specification
- [ ] Error handling for all edge cases
- [ ] OpenAPI documentation is complete
- [ ] Integration tests verify endpoint functionality
- [ ] Security measures are implemented (if required)

---

"""
                csv_stories += f'Story,"{clean_name.upper()}-{story_id}: {method} {endpoint_path}","Implement {method} {endpoint_path} API endpoint: {description}",Medium,2,API-ENDPOINTS,[Assignee],api endpoint rest,"{method} {endpoint_path} working; Validation in place; Tests passing; Documentation complete"\n'
                story_id += 1

        # Epic 4: Business Rules Implementation
        if business_rules:
            jira_stories += f"""## Epic 4: Business Rules and Validation
**Epic Name:** BUSINESS-RULES
**Epic Summary:** Implement all business rules and validation logic for {project_name}
**Epic Description:** Develop all business rules, validations, and constraints as defined in the BRD.

### User Stories:

"""
            
            for rule in business_rules:
                rule_title = rule.get("title", f"Business Rule {story_id}")
                rule_description = rule.get("description", "")
                
                jira_stories += f"""#### {clean_name.upper()}-{story_id}: Implement {rule_title}
**Story Type:** Story
**Story Points:** 3
**Priority:** High
**Epic:** BUSINESS-RULES

**User Story:**
As a system administrator, I want the system to enforce the business rule "{rule_title}" so that business processes are followed correctly.

**Description:**
Implement the business rule: {rule_title}
{rule_description}

**Acceptance Criteria:**
- [ ] Business rule "{rule_title}" is implemented in service layer
- [ ] Validation logic prevents rule violations
- [ ] Appropriate error messages are displayed to users
- [ ] Rule enforcement is tested with various scenarios
- [ ] Documentation explains the business rule implementation
- [ ] Edge cases and exceptions are properly handled

---

"""
                csv_stories += f'Story,"{clean_name.upper()}-{story_id}: {rule_title}","Implement business rule: {rule_description}",High,3,BUSINESS-RULES,[Assignee],business-rule validation,"{rule_title} enforced; Validation working; Error handling complete; Tests passing"\n'
                story_id += 1

        # Epic 5: Testing and Quality Assurance
        jira_stories += f"""## Epic 5: Testing and Quality Assurance
**Epic Name:** TESTING-QA
**Epic Summary:** Comprehensive testing strategy for {project_name}
**Epic Description:** Implement comprehensive testing including unit tests, integration tests, and quality assurance measures.

### User Stories:

#### {clean_name.upper()}-{story_id}: Unit Testing Implementation
**Story Type:** Story
**Story Points:** 5
**Priority:** High
**Epic:** TESTING-QA

**User Story:**
As a developer, I want comprehensive unit tests for all components so that code quality and reliability are maintained.

**Acceptance Criteria:**
- [ ] Unit tests for all service classes (>90% coverage)
- [ ] Unit tests for all controller classes
- [ ] Mockito integration for dependency mocking
- [ ] Test data builders for consistent test data
- [ ] Parameterized tests for multiple scenarios
- [ ] Tests run automatically in CI/CD pipeline

---

"""
        csv_stories += f'Story,"{clean_name.upper()}-{story_id}: Unit Testing","Implement comprehensive unit tests for all components",High,5,TESTING-QA,[Assignee],testing unit-tests,">90% test coverage; Mockito integration; Test builders created; CI/CD integration complete"\n'
        story_id += 1

        jira_stories += f"""#### {clean_name.upper()}-{story_id}: Integration Testing Implementation
**Story Type:** Story
**Story Points:** 5
**Priority:** High
**Epic:** TESTING-QA

**User Story:**
As a developer, I want integration tests for API endpoints so that end-to-end functionality is verified.

**Acceptance Criteria:**
- [ ] Integration tests using TestContainers
- [ ] Database integration testing with test data
- [ ] API endpoint testing with real HTTP calls
- [ ] Test fixtures and sample data management
- [ ] Performance testing for critical endpoints
- [ ] Security testing for authentication/authorization

---

"""
        csv_stories += f'Story,"{clean_name.upper()}-{story_id}: Integration Testing","Implement integration tests for API endpoints and database",High,5,TESTING-QA,[Assignee],testing integration-tests,"TestContainers setup; Database tests working; API tests complete; Performance validated"\n'
        story_id += 1

        # Epic 6: DevOps and Deployment
        jira_stories += f"""## Epic 6: DevOps and Deployment
**Epic Name:** DEVOPS-DEPLOY
**Epic Summary:** CI/CD pipeline and deployment automation for {project_name}
**Epic Description:** Set up automated build, test, and deployment pipelines with containerization.

### User Stories:

#### {clean_name.upper()}-{story_id}: CI/CD Pipeline Implementation
**Story Type:** Story
**Story Points:** 8
**Priority:** Medium
**Epic:** DEVOPS-DEPLOY

**User Story:**
As a DevOps engineer, I want automated build and deployment pipelines so that code changes are automatically tested and deployed.

**Acceptance Criteria:**
- [ ] GitHub Actions workflow for CI/CD
- [ ] Automated testing on pull requests
- [ ] Docker containerization with multi-stage builds
- [ ] Environment-specific configuration management
- [ ] Automated deployment to staging environment
- [ ] Production deployment with approval gates
- [ ] Monitoring and alerting setup

---

"""
        csv_stories += f'Story,"{clean_name.upper()}-{story_id}: CI/CD Pipeline","Setup automated build, test, and deployment pipeline",Medium,8,DEVOPS-DEPLOY,[Assignee],devops cicd docker,"GitHub Actions working; Docker containers built; Automated deployment ready; Monitoring active"\n'
        story_id += 1

        # Project Summary
        total_stories = story_id - 1
        estimated_points = len(entities) * 3 + len(requirements) * 3 + len(api_endpoints) * 2 + len(business_rules) * 3 + 18  # Base stories
        
        jira_stories += f"""
## Project Summary and Sprint Planning

### Story Statistics:
- **Total Stories Created:** {total_stories}
- **Total Story Points:** ~{estimated_points}
- **Estimated Duration:** {(estimated_points // 12) + 1} sprints (2-week sprints)

### Epic Breakdown:
- **DATA-MODEL:** Entity and database implementation
- **FUNCTIONAL-REQS:** Business requirements implementation  
- **API-ENDPOINTS:** REST API development
- **BUSINESS-RULES:** Business logic and validation
- **TESTING-QA:** Testing and quality assurance
- **DEVOPS-DEPLOY:** DevOps and deployment automation

### Sprint Recommendations:
- **Sprint 1:** Focus on DATA-MODEL epic (entities and CRUD)
- **Sprint 2:** FUNCTIONAL-REQS implementation
- **Sprint 3:** API-ENDPOINTS and BUSINESS-RULES
- **Sprint 4:** TESTING-QA and DEVOPS-DEPLOY

### Definition of Done:
- [ ] Code is peer reviewed and approved
- [ ] Unit tests pass with >80% coverage
- [ ] Integration tests pass
- [ ] Code meets quality gates (SonarQube)
- [ ] API documentation is updated
- [ ] Security review completed (if applicable)
- [ ] Performance requirements met
- [ ] Acceptance criteria validated by Product Owner

---
*Generated by BRDynamo - {self._get_current_timestamp()}*
"""

        # Create additional project management files
        sprint_planning = f"""# Sprint Planning Guide for {project_name}
Generated on: {self._get_current_timestamp()}

## Project Overview
- **Total Stories:** {total_stories}
- **Estimated Story Points:** ~{estimated_points}
- **Recommended Sprint Duration:** 2 weeks
- **Estimated Project Duration:** {(estimated_points // 12) + 1} sprints

## Sprint Guidelines for {project_name}:

### Sprint Capacity Planning:
- Team velocity: 10-15 story points per sprint (adjust based on team size)
- Include testing tasks in each sprint
- Reserve 20% capacity for bugs and technical debt
- Plan for code reviews and documentation updates

### Sprint 1 (Weeks 1-2): Foundation Setup
**Focus:** Data Model and Core Entities
**Target Points:** 12-15
**Goals:** 
- Complete all entity implementations
- Setup basic CRUD operations
- Establish development environment

### Sprint 2 (Weeks 3-4): Business Logic Implementation  
**Focus:** Functional Requirements
**Target Points:** 12-15
**Goals:**
- Implement core business requirements
- Complete service layer development
- Begin API endpoint implementation

### Sprint 3 (Weeks 5-6): API and Integration
**Focus:** API Endpoints and Business Rules
**Target Points:** 10-12
**Goals:**
- Complete REST API endpoints
- Implement business validation rules
- Integration testing setup

### Sprint 4 (Weeks 7-8): Quality and Deployment
**Focus:** Testing and DevOps
**Target Points:** 10-12
**Goals:**
- Comprehensive testing implementation
- CI/CD pipeline setup
- Production deployment preparation

## Definition of Ready (DoR):
- [ ] User story is well-defined and understood
- [ ] Acceptance criteria are clear and testable  
- [ ] Dependencies are identified and resolved
- [ ] Story is estimated and fits in sprint
- [ ] Technical approach is discussed

## Definition of Done (DoD):
- [ ] Code is implemented and peer reviewed
- [ ] Unit tests written with >80% coverage
- [ ] Integration tests pass
- [ ] Documentation updated
- [ ] Acceptance criteria validated
- [ ] Code deployed to staging environment

## Risk Management:
- Monitor velocity and adjust sprint commitments
- Address technical debt proactively
- Maintain open communication with stakeholders
- Regular retrospectives for continuous improvement

---
*This sprint planning guide is specific to {project_name} and should be adjusted based on team capacity and project priorities.*
"""

        backlog_refinement = f"""# Product Backlog Refinement for {project_name}

## Backlog Prioritization:

### High Priority (Must Have):
- All Data Model stories (Epic: DATA-MODEL)
- Core functional requirements (Epic: FUNCTIONAL-REQS)
- Critical API endpoints (Epic: API-ENDPOINTS)

### Medium Priority (Should Have):
- Business rules implementation (Epic: BUSINESS-RULES)
- Integration testing (Epic: TESTING-QA)

### Lower Priority (Could Have):
- Advanced API features
- Performance optimization
- DevOps automation (Epic: DEVOPS-DEPLOY)

## Story Refinement Checklist:
- [ ] Story follows INVEST criteria
- [ ] Acceptance criteria are measurable
- [ ] Technical dependencies identified
- [ ] Story size is appropriate (1-8 points)
- [ ] Business value is clear

## Estimation Guidelines:
- **1 Point:** Simple configuration or minor bug fix
- **2 Points:** Small feature or API endpoint
- **3 Points:** Standard entity with CRUD operations
- **5 Points:** Complex business logic or integration
- **8 Points:** Major feature or infrastructure setup

---
*Generated for {project_name} project*
"""

        return {
            f"{demo_project_name}/project-management/jira-stories.md": jira_stories,
            f"{demo_project_name}/project-management/jira-import.csv": csv_stories,
            f"{demo_project_name}/project-management/sprint-planning.md": sprint_planning,
            f"{demo_project_name}/project-management/backlog-refinement.md": backlog_refinement
        }

    def _generate_architecture_diagrams(self, parsed_brd: Dict) -> Dict:
        """Generate architecture diagrams using Kroki.io API."""
        project_name = parsed_brd.get("project_overview", {}).get("name", "spring-app")
        clean_name, demo_project_name, package_name = self._generate_project_name(project_name)
        
        entities = parsed_brd.get("data_model", {}).get("entities", [])
        requirements = parsed_brd.get("functional_requirements", [])
        
        diagrams = {}
        
        # 1. System Architecture Diagram
        system_arch = self._generate_system_architecture_plantuml(demo_project_name, entities, requirements)
        diagrams[f"{demo_project_name}/docs/diagrams/system-architecture.puml"] = system_arch
        
        # 2. Database ER Diagram
        er_diagram = self._generate_database_er_plantuml(demo_project_name, entities)
        diagrams[f"{demo_project_name}/docs/diagrams/database-er.puml"] = er_diagram
        
        # 3. API Flow Diagram
        api_flow = self._generate_api_flow_plantuml(demo_project_name, entities, requirements)
        diagrams[f"{demo_project_name}/docs/diagrams/api-flow.puml"] = api_flow
        
        # 4. Component Diagram
        component_diagram = self._generate_component_diagram_plantuml(demo_project_name, entities)
        diagrams[f"{demo_project_name}/docs/diagrams/component-diagram.puml"] = component_diagram
        
        # Generate rendered versions using Kroki.io
        svg_success = 0
        png_success = 0
        total_diagrams = len([k for k in diagrams.keys() if k.endswith('.puml')])
        
        for puml_path, puml_content in list(diagrams.items()):
            if not puml_path.endswith('.puml'):
                continue
                
            try:
                # Generate SVG version (usually more reliable)
                svg_content = self._render_with_kroki(puml_content, "plantuml", "svg")
                if svg_content:
                    svg_path = puml_path.replace(".puml", ".svg")
                    diagrams[svg_path] = svg_content
                    svg_success += 1
                    print(f"SUCCESS Generated SVG: {svg_path}")
                else:
                    print(f"FAILED SVG: {puml_path}")
            except Exception as e:
                print(f"ERROR SVG for {puml_path}: {e}")
            
            try:
                # Generate PNG version (may fail for complex diagrams)
                png_content = self._render_with_kroki(puml_content, "plantuml", "png")
                if png_content:
                    png_path = puml_path.replace(".puml", ".png")
                    diagrams[png_path] = png_content
                    png_success += 1
                    print(f"SUCCESS Generated PNG: {png_path}")
                else:
                    print(f"FAILED PNG: {puml_path}")
            except Exception as e:
                print(f"ERROR PNG for {puml_path}: {e}")
        
        print(f"Kroki.io rendering summary: {svg_success}/{total_diagrams} SVG, {png_success}/{total_diagrams} PNG")
        
        # Generate README for diagrams
        diagrams_readme = self._generate_diagrams_readme(demo_project_name)
        diagrams[f"{demo_project_name}/docs/diagrams/README.md"] = diagrams_readme
        
        return diagrams
    
    def _generate_system_architecture_plantuml(self, project_name: str, entities: List, requirements: List) -> str:
        """Generate system architecture diagram in PlantUML format (simplified)."""
        return f"""@startuml {project_name}-system-architecture
!theme plain
title {project_name.replace('-', ' ').title()} - System Architecture

package "Frontend" {{
    [React App] as frontend
}}

package "Backend" {{
    [Spring Boot] as app
    [Services] as services
}}

package "Data" {{
    [JPA] as orm
    database "Database" as db
}}

package "External" {{
    cloud "Storage" as storage
    cloud "Cache" as cache
}}

' Connections
frontend -> app : HTTPS/REST
app -> services : Internal
services -> orm : JPA
orm -> db : SQL
app -> cache : Cache
app -> storage : Files

note right of services
  Components:
{chr(10).join(f"  - {entity.get('name', 'Entity')}" for entity in entities[:3])}
end note

@enduml"""

    def _generate_database_er_plantuml(self, project_name: str, entities: List) -> str:
        """Generate database ER diagram in PlantUML format."""
        puml = f"""@startuml {project_name}-database-er
!theme plain
title {project_name.replace('-', ' ').title()} - Database ER Diagram

' Entity definitions
"""
        
        # Add entities
        for entity in entities:
            entity_name = entity.get("name", "Entity")
            attributes = entity.get("attributes", [])
            
            puml += f"""
entity "{entity_name}" as {entity_name.lower()} {{
    + id : UUID <<PK>>
    --
"""
            
            for attr in attributes[:8]:  # Limit to 8 attributes for readability
                attr_name = attr.get("name", "attribute")
                attr_type = attr.get("type", "String")
                nullable = "?" if attr.get("nullable", True) else ""
                puml += f"    {attr_name} : {attr_type}{nullable}\n"
            
            puml += "}\n"
        
        # Add relationships (basic many-to-one relationships)
        puml += "\n' Relationships\n"
        for i, entity in enumerate(entities):
            if i > 0:  # Create relationship with previous entity as example
                prev_entity = entities[i-1]
                puml += f"{entity.get('name', 'Entity').lower()} }}|--|| {prev_entity.get('name', 'Entity').lower()} : belongs to\n"
        
        puml += "\n@enduml"
        return puml
    
    def _generate_api_flow_plantuml(self, project_name: str, entities: List, requirements: List) -> str:
        """Generate API flow diagram in PlantUML format (simplified for better rendering)."""
        main_entity = entities[0].get("name", "Resource") if entities else "Resource"
        
        return f"""@startuml {project_name}-api-flow
!theme plain
title {project_name.replace('-', ' ').title()} - API Flow

actor Client
participant Controller
participant Service  
participant Repository
database Database

== Create {main_entity} ==
Client -> Controller : POST /{main_entity.lower()}s
Controller -> Service : create{main_entity}()
Service -> Repository : save()
Repository -> Database : INSERT
Database --> Repository : ID
Repository --> Service : Entity
Service --> Controller : Created
Controller --> Client : 201 Created

== Get {main_entity} ==
Client -> Controller : GET /{main_entity.lower()}s/id
Controller -> Service : findById()
Service -> Repository : findById()
Repository -> Database : SELECT
Database --> Repository : Data
Repository --> Service : Entity
Service --> Controller : Found
Controller --> Client : 200 OK

== Update {main_entity} ==
Client -> Controller : PUT /{main_entity.lower()}s/id
Controller -> Service : update()
Service -> Repository : save()
Repository -> Database : UPDATE
Database --> Repository : OK
Repository --> Service : Updated
Service --> Controller : Success
Controller --> Client : 200 OK

== Delete {main_entity} ==
Client -> Controller : DELETE /{main_entity.lower()}s/id
Controller -> Service : delete()
Service -> Repository : deleteById()
Repository -> Database : DELETE
Database --> Repository : OK
Repository --> Service : Deleted
Service --> Controller : Success
Controller --> Client : 204 No Content

@enduml"""

    def _generate_component_diagram_plantuml(self, project_name: str, entities: List) -> str:
        """Generate component diagram in PlantUML format."""
        return f"""@startuml {project_name}-component-diagram
!theme plain
title {project_name.replace('-', ' ').title()} - Component Diagram

package "Web Layer" {{
    [REST Controllers] as controllers
    [Exception Handlers] as exceptions
    [Request/Response DTOs] as dtos
}}

package "Service Layer" {{
    [Business Services] as services
    [Validation Logic] as validation
    [Business Rules] as rules
}}

package "Data Access Layer" {{
    [JPA Repositories] as repositories
    [Entity Models] as entities
    [Database Config] as dbconfig
}}

package "Cross-Cutting Concerns" {{
    [Security Config] as security
    [Logging] as logging
    [Caching] as caching
    [Monitoring] as monitoring
}}

package "External Integrations" {{
    [Database] as database
    [Cache Store] as cache
    [File Storage] as storage
}}

' Dependencies
controllers --> services : uses
controllers --> dtos : uses
controllers --> exceptions : handles

services --> repositories : uses
services --> validation : uses
services --> rules : applies
services --> caching : uses

repositories --> entities : manages
repositories --> dbconfig : configured by

services --> security : secured by
controllers --> logging : logs to
services --> logging : logs to
repositories --> logging : logs to

repositories --> database : persists to
caching --> cache : stores in
controllers --> storage : uploads to

controllers --> monitoring : metrics
services --> monitoring : metrics

note right of services
  Core Business Components:
{chr(10).join(f"  - {entity.get('name', 'Entity')}Service" for entity in entities[:5])}
end note

note left of repositories
  Data Access Components:
{chr(10).join(f"  - {entity.get('name', 'Entity')}Repository" for entity in entities[:5])}
end note

@enduml"""

    def _render_with_kroki(self, diagram_content: str, diagram_type: str, output_format: str) -> str:
        """Render diagram using Kroki.io API."""
        try:
            print(f"Rendering diagram with Kroki.io: {diagram_type} -> {output_format}")
            
            # Use POST request to avoid URL length limitations
            url = f"https://kroki.io/{diagram_type}/{output_format}"
            
            headers = {
                'Content-Type': 'text/plain',
                'Accept': 'image/svg+xml' if output_format == 'svg' else f'image/{output_format}'
            }
            
            # Send raw PlantUML content in POST body
            response = requests.post(
                url, 
                data=diagram_content.encode('utf-8'), 
                headers=headers,
                timeout=30
            )
            response.raise_for_status()
            
            print(f"SUCCESS: Kroki.io returned {len(response.text if output_format=='svg' else response.content)} bytes")
            
            if output_format in ['svg']:
                return response.text
            else:  # png, pdf, etc.
                return base64.b64encode(response.content).decode('ascii')
                
        except Exception as e:
            print(f"Failed to render diagram with Kroki.io: {e}")
            # Fallback: try GET method with encoded content
            try:
                print(f"Retrying with GET method for {diagram_type} -> {output_format}")
                encoded = base64.urlsafe_b64encode(zlib.compress(diagram_content.encode('utf-8'), 9)).decode('ascii')
                fallback_url = f"https://kroki.io/{diagram_type}/{output_format}/{encoded}"
                
                # Only try GET if URL is not too long (under 8000 chars - Kroki's limit)
                if len(fallback_url) < 8000:
                    response = requests.get(fallback_url, timeout=30)
                    response.raise_for_status()
                    print(f"SUCCESS (fallback): Kroki.io returned {len(response.text if output_format=='svg' else response.content)} bytes")
                    
                    if output_format in ['svg']:
                        return response.text
                    else:
                        return base64.b64encode(response.content).decode('ascii')
                else:
                    print(f"Fallback URL too long ({len(fallback_url)} chars), skipping {output_format} generation")
                    return None
                    
            except Exception as fallback_error:
                print(f"Fallback also failed: {fallback_error}")
                # For PNG failures, we can still provide the SVG version
                if output_format == 'png':
                    print("PNG generation failed, but SVG version should be available")
                return None
    
    def _generate_diagrams_readme(self, project_name: str) -> str:
        """Generate README for the diagrams folder."""
        return f"""# Architecture Diagrams for {project_name.replace('-', ' ').title()}

This folder contains various architecture diagrams that document the system design and structure.

## Available Diagrams

### 1. System Architecture (`system-architecture.*`)
- **Purpose**: Shows the high-level system architecture
- **Includes**: Frontend, API Gateway, Application Layer, Data Layer, External Services
- **Use Case**: Understanding overall system structure and component interactions

### 2. Database ER Diagram (`database-er.*`)
- **Purpose**: Shows entity relationships and database schema
- **Includes**: All entities, their attributes, and relationships
- **Use Case**: Database design and understanding data model

### 3. API Flow Diagram (`api-flow.*`)
- **Purpose**: Shows the request/response flow for API operations
- **Includes**: CRUD operations flow from client to database
- **Use Case**: Understanding API request processing and error handling

### 4. Component Diagram (`component-diagram.*`)
- **Purpose**: Shows internal application components and their dependencies
- **Includes**: Controllers, Services, Repositories, Cross-cutting concerns
- **Use Case**: Understanding internal architecture and component relationships

## File Formats

- **`.puml`**: PlantUML source files (editable)
- **`.svg`**: Scalable Vector Graphics (web-friendly, zoomable)
- **`.png`**: Portable Network Graphics (image format)

## Editing Diagrams

To edit the diagrams:

1. Modify the `.puml` files using any text editor
2. Use PlantUML tools or online editors like:
   - [PlantUML Online Editor](http://www.plantuml.com/plantuml/uml/)
   - [Kroki.io Live Editor](https://kroki.io/)
   - VS Code with PlantUML extension

## Regenerating Images

The SVG and PNG versions are automatically generated using [Kroki.io](https://kroki.io/) during the code generation process.

To manually regenerate:
1. Copy the `.puml` content
2. Use Kroki.io API or online editor
3. Save the output as SVG or PNG

## Integration with Documentation

These diagrams can be embedded in:
- README files
- Technical documentation
- Wiki pages
- Confluence pages
- JIRA stories

Example markdown for embedding:
```markdown
![System Architecture](./diagrams/system-architecture.svg)
```
"""

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
