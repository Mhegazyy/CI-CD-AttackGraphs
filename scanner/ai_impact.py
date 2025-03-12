from openai import OpenAI

client = OpenAI(api_key="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")
import json

# Make sure to set your OpenAI API key

def generate_ai_assessment(attack_graph):
    """
    Generate an AI-based impact assessment and potential attack path analysis.
    
    Args:
        attack_graph (dict): The node-link data representing the attack graph.
    
    Returns:
        dict: AI analysis results including impact assessment and recommended attack paths.
    """
    # Prepare a prompt with details of the attack graph
    prompt = (
    "You are a cybersecurity expert. Analyze the following attack graph data "
    "and determine the impact of the findings. Identify the most critical vulnerability chains and "
    "describe potential attack paths. Return your answer strictly as JSON with the following format:\n\n"
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
                        "items": {
                            "type": "string"
                        }
                    },
                    "description": "A list of potential attack paths, each path represented as a list of node identifiers."
                }
            },
            "required": ["impact_assessment", "attack_paths"]
        }
    }
]

    response = client.chat.completions.create(model="o3-mini",
    messages=[
        {"role": "system", "content": "You are a cybersecurity risk assessor."},
        {"role": "user", "content": prompt}
    ],
    functions=functions,
    function_call="auto",
    max_tokens=500)   

    # Extract the AI's answer from the response
    ai_answer = response.choices[0].message.content
    return {"impact_assessment": ai_answer}

if __name__ == "__main__":
    # For testing purposes: Load or simulate an attack graph
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
    print(result["impact_assessment"])
