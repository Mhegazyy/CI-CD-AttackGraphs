from openai import OpenAI
client = OpenAI(api_key="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")

prompt = """
Write a bash script that takes a matrix represented as a string with 
format '[1,2],[3,4],[5,6]' and prints the transpose in the same format.
"""

response = client.chat.completions.create(
    model="o3-mini",
    reasoning_effort="medium",
    messages=[
        {
            "role": "user", 
            "content": prompt
        }
    ]
)

print(response.choices[0].message.content)