from google import genai
import os
from dotenv import load_dotenv

load_dotenv()
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
# response = client.models.generate_content(
#     model="gemini-2.0-flash",
#     contents="why is the sky blue?",
# )
chat = client.chats.create(model="gemini-2.0-flash")

while True:
    message = input("You: ")
    if message.lower() == "exit":
        break
    res = chat.send_message(message)
    print(f"Gemini: {res.text}")
    file_path = "D:\\EDL-SampleData\\input.txt"

    ## writing the response to a file
    with open(file_path, "a", encoding="utf-8") as file:
        file.write(res.text + "\n")