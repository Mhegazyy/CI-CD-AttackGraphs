from openai import OpenAI
from dotenv import load_dotenv
import os
import json

# Load environment variables from .env file
load_dotenv()

# Initialize the OpenAI client with API key from the environment
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


def clean_json_response(text):
    """
    Remove markdown code fences and leading/trailing whitespace from the AI response.
    """
    text = text.strip()
    # Remove starting and ending code fences if present
    if text.startswith("```"):
        lines = text.splitlines()
        # If first line is like "```json", remove it
        if lines[0].strip().lower().startswith("```json"):
            lines = lines[1:]
        elif lines[0].strip().startswith("```"):
            lines = lines[1:]
        # Remove ending code fence if present
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        text = "\n".join(lines).strip()
    return text

def generate_ai_assessment(attack_graph):
    """
    Generate an AI-based impact assessment and potential attack path analysis using the updated Responses API.
    
    Args:
        attack_graph (dict): The node-link data representing the attack graph.
    
    Returns:
        dict: AI analysis results including per-function analysis, overall risk assessment, and critical attack paths.
    """
    prompt = (
        "You are a cybersecurity risk assessor. You are provided with an attack graph that represents the application's architecture. "
        "Each node in the graph corresponds to a function in the application, and contains metadata including its identifier, file path, "
        "line numbers, and, if applicable, a list of vulnerability objects. Each vulnerability object includes details such as:\n"
        "  - message: a brief description,\n"
        "  - severity: e.g. High, Medium, Low,\n"
        "  - likelihood: the chance that the vulnerability will be exploited,\n"
        "  - impact: the potential harm if exploited,\n"
        "  - confidence: the confidence in the finding,\n"
        "  - vulnerability_class: a list of vulnerability classifications.\n\n"
        "Your tasks are:\n"
        "1. For each function node, provide a detailed risk and impact analysis. For each function, include:\n"
        "   - function_id: the node identifier,\n"
        "   - risk_rating: High, Medium, or Low (based on its vulnerabilities),\n"
        "   - impact_rating: High, Medium, or Low,\n"
        "   - vulnerabilities: a list of all associated vulnerabilities with their detailed metadata,\n"
        "   - recommendation: mitigation recommendations if vulnerabilities are present.\n\n"
        "2. Provide an overall risk and impact assessment for the entire application, summarizing aggregated risks and key concerns.\n\n"
        "3. Identify the most critical attack paths in the application. An attack path is defined as a sequence of function calls, starting "
        "from an entry point and leading to functions with high-risk vulnerabilities. List each attack path as an array of function node IDs.\n\n"
        "Return your answer strictly in JSON format using the following structure:\n"
        "{\n"
        "  \"functions_analysis\": [\n"
        "    {\n"
        "      \"function_id\": \"<function node id>\",\n"
        "      \"risk_rating\": \"<High/Medium/Low>\",\n"
        "      \"impact_rating\": \"<High/Medium/Low>\",\n"
        "      \"vulnerabilities\": [\n"
        "         {\n"
        "           \"message\": \"<vulnerability description>\",\n"
        "           \"severity\": \"<severity>\",\n"
        "           \"likelihood\": \"<likelihood>\",\n"
        "           \"impact\": \"<impact>\",\n"
        "           \"confidence\": \"<confidence>\",\n"
        "           \"vulnerability_class\": [\"<class1>\", \"<class2>\", ...]\n"
        "         },\n"
        "         ...\n"
        "      ],\n"
        "      \"recommendation\": \"<mitigation recommendations>\"\n"
        "    },\n"
        "    ...\n"
        "  ],\n"
        "  \"overall_risk\": \"<summary of overall risk and impact>\",\n"
        "  \"critical_attack_paths\": [\n"
        "    [\"<function_node_id1>\", \"<function_node_id2>\", ...],\n"
        "    ...\n"
        "  ]\n"
        "}\n\n"
        "Below is the attack graph data in JSON format:\n"
        f"{json.dumps(attack_graph, indent=2)}\n\n"
        "JSON Response:\n"
    )

    try:
        print("🔍 Sending request to OpenAI API with prompt:")
        print(prompt)
        response = client.responses.create(
            model="o3-mini",  # Ensure you have access to this model; otherwise, switch to an available one.
            instructions="You are a cybersecurity expert tasked with analyzing an attack graph. Analyze function-level vulnerabilities, overall risk, and critical attack paths based on the provided data.",
            input=prompt
        )
    except Exception as e:
        print("❌ Error during API call:", str(e))
        return {"impact_assessment": None}

    # Debug: Print the raw API response
    try:
        response_dict = response.to_dict() if hasattr(response, "to_dict") else response
        print("✅ DEBUG: Raw API Response:")
        print(json.dumps(response_dict, indent=2, default=str))
    except Exception as e:
        print("Could not dump response as JSON:", str(e))
        print(response)

    # Extract the assistant's output from the response
    ai_answer = None
    if hasattr(response, "output"):
        for item in response.output:
            if hasattr(item, "role") and item.role == "assistant":
                parts = [c.text for c in item.content if hasattr(c, "text")]
                ai_answer = "".join(parts).strip()
                break

    if not ai_answer:
        print("DEBUG: No content found in response output. Full output:")
        print(response.output if hasattr(response, "output") else "No output attribute.")
        return {"impact_assessment": None}

    print("🔍 Raw AI Answer:")
    print(ai_answer)

    # Clean the AI answer to remove markdown code fences
    ai_answer_clean = clean_json_response(ai_answer)
    print("🔍 Cleaned AI Answer:")
    print(ai_answer_clean)

    # Attempt to parse the cleaned answer as JSON
    try:
        ai_json = json.loads(ai_answer_clean)
        print("✅ Parsed AI JSON successfully.")
    except json.JSONDecodeError as jde:
        print("⚠️ JSON decoding error:", jde)
        print("Raw cleaned answer:", ai_answer_clean)
        ai_json = ai_answer_clean  # Fallback to raw string

    return {"impact_assessment": ai_json}

if __name__ == "__main__":
    # Dummy attack graph for testing purposes
    dummy_attack_graph = {
        "directed": True,
        "multigraph": False,
        "graph": {},
        "nodes": [
            {"id": "example.py:funcA", "type": "function", "name": "funcA", "filepath": "example.py", "lineno": 10},
            {"id": "example.py:vuln", "type": "vulnerability", "message": "SQL Injection"}
        ],
        "links": [
            {"source": "example.py:funcA", "target": "example.py:vuln", "type": "vulnerability"}
        ]
    }
    
    result = generate_ai_assessment(dummy_attack_graph)
    print("\n🎯 AI Impact Assessment:")
    if result:
        print(json.dumps(result, indent=2))
    else:
        print("No valid assessment generated.")
