import openai
import json

# Set your OpenAI API key (make sure it's valid and has access to the model)
openai.api_key = "sk-..."

def generate_ai_assessment(attack_graph):
    """
    Generate an AI-based impact assessment and potential attack path analysis.
    
    Args:
        attack_graph (dict): The node-link data representing the attack graph.
    
    Returns:
        dict: AI analysis results including impact assessment and recommended attack paths.
    """
    prompt = (
        "You are a cybersecurity expert. Analyze the following attack graph data and determine the impact of the findings. "
        "Identify the most critical vulnerability chains and describe potential attack paths an adversary might take. "
        "Return your answer strictly as JSON with the following format:\n\n"
        "{\n  \"impact_assessment\": \"<summary>\",\n  \"attack_paths\": [ [\"node_id1\", \"node_id2\", ...], ... ]\n}\n\n"
        "Attack Graph Data:\n" + json.dumps(attack_graph, indent=2)
    )
    
    functions = [
        {
            "name": "analyze_attack_graph",
            "description": "Analyzes the attack graph and returns the impact assessment and recommended attack paths.",
            "parameters": {
                "type": "object",
                "properties": {
                    "impact_assessment": {
                        "type": "string",
                        "description": "A summary of the potential impact of the vulnerabilities."
                    },
                    "attack_paths": {
                        "type": "array",
                        "items": {
                            "type": "array",
                            "items": {"type": "string"}
                        },
                        "description": "A list of potential attack paths, each path represented as a list of node identifiers."
                    }
                },
                "required": ["impact_assessment", "attack_paths"]
            }
        }
    ]
    
    try:
        response = openai.ChatCompletion.create(
            model="o3-mini",
            messages=[
                {"role": "system", "content": "You are a cybersecurity risk assessor."},
                {"role": "user", "content": prompt}
            ],
            functions=functions,
            function_call="auto",
            max_completion_tokens=500  # Using max_completion_tokens as required
        )
    except Exception as e:
        print("Error during API call:", str(e))
        return {"impact_assessment": None}

    # Convert response to a dictionary if possible.
    try:
        response_dict = response.to_dict() if hasattr(response, "to_dict") else response
    except Exception as e:
        response_dict = response

    # Print raw API response for debugging
    print("DEBUG: Raw API Response:")
    print(json.dumps(response_dict, indent=2, default=str))
    
    # Extract the message content
    ai_message = response.choices[0].message
    ai_answer = ai_message.get("content")
    
    if not ai_answer:
        print("DEBUG: No content returned from API. Full message:")
        print(ai_message)
        return {"impact_assessment": None}
    
    return {"impact_assessment": ai_answer}

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
    print("AI Impact Assessment:")
    print(json.dumps(result, indent=2))
