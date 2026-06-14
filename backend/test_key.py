import os
import requests
from dotenv import load_dotenv

load_dotenv()

print("=== SCHLR API Key Diagnostic ===")

# Test Gemini
gemini_key = os.getenv("GEMINI_API_KEY") or os.getenv("ANTHROPIC_API_KEY")
if gemini_key and not gemini_key.startswith("sk-ant-") and gemini_key != "yahan_apni_real_key_dalo":
    print(f"\nTesting Gemini Key: {gemini_key[:8]}...{gemini_key[-5:] if len(gemini_key) > 5 else ''}")
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent"
    headers = {
        "Content-Type": "application/json",
        "x-goog-api-key": gemini_key
    }
    payload = {"contents": [{"role": "user", "parts": [{"text": "hello"}]}]}
    try:
        r = requests.post(url, json=payload, headers=headers)
        if r.status_code == 200:
            print("[SUCCESS] Your Gemini API key is valid and working.")
        else:
            print(f"[FAILED] Status: {r.status_code}")
            print(f"Response: {r.text}")
    except Exception as e:
        print(f"Error calling Gemini: {e}")

# Test Anthropic
anthropic_key = os.getenv("ANTHROPIC_API_KEY")
if anthropic_key and anthropic_key.startswith("sk-ant-") and anthropic_key != "yahan_apni_real_key_dalo":
    print(f"\nTesting Anthropic Key: {anthropic_key[:10]}...")
    import anthropic
    try:
        client = anthropic.Anthropic(api_key=anthropic_key)
        client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=10,
            messages=[{"role": "user", "content": "hello"}]
        )
        print("[SUCCESS] Your Anthropic API key is valid and working.")
    except Exception as e:
        print(f"[FAILED] Error: {e}")

# Test OpenAI
openai_key = os.getenv("OPENAI_API_KEY")
if openai_key and openai_key != "yahan_apni_real_key_dalo":
    print(f"\nTesting OpenAI Key: {openai_key[:10]}...")
    url = "https://api.openai.com/v1/chat/completions"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {openai_key}"
    }
    payload = {
        "model": "gpt-4o-mini",
        "messages": [{"role": "user", "content": "hello"}],
        "max_tokens": 10
    }
    try:
        r = requests.post(url, json=payload, headers=headers)
        if r.status_code == 200:
            print("[SUCCESS] Your OpenAI API key is valid and working.")
        else:
            print(f"[FAILED] Status: {r.status_code}")
            print(f"Response: {r.text}")
    except Exception as e:
        print(f"Error calling OpenAI: {e}")
