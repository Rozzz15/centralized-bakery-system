import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

with open("src/components/DecoDashboard.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Fix "Prepare in Advanced Freemix ->" buttons
content = content.replace(
    'Prepare in Advanced Freemix ->',
    'Prepare in Advanced Freemix \u2192'
)

# Fix "Next: {nextStep.label} ->" in the workflow nav (the new Production Prep section)
content = content.replace(
    'Next: {nextStep.label} ->',
    'Next: {nextStep.label} \u2192'
)

with open("src/components/DecoDashboard.tsx", "w", encoding="utf-8") as f:
    f.write(content)

print("Fixed arrow characters")
