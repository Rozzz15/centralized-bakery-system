import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('src/components/AdminDashboard.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# The finance section's return has multiple root elements because
# content was lost during reordering.
# Fix: wrap everything inside the return in a fragment <>

# Find the return ( at line 2090
return_start = content.find('    return (')
if return_start < 0:
    print("ERROR: return ( not found!")
    exit(1)

# We need to wrap everything between return ( and ); in a fragment
# The ); closes at around position... let me find the last one
last_close = content.rfind('  );\n}')
if last_close < 0:
    # Try rn
    last_close = content.rfind('  );\r\n}')

if last_close < 0:
    print("ERROR: closing ); } not found!")
    exit(1)

# Content between return ( and ); 
inner_start = return_start + len('    return (')
inner_end = last_close

print(f"Return from {return_start} to {inner_end}")
inner = content[inner_start:inner_end]
print(f"Inner content: {len(inner)} chars")

# Check if inner already has a wrapper
if inner.strip().startswith('<>') or inner.strip().startswith('<React.Fragment'):
    print("Already wrapped in fragment")
else:
    # Wrap in fragment
    new_inner = '<>\n' + inner + '\n</>'
    content = content[:inner_start] + new_inner + content[inner_end:]
    print("Wrapped content in fragment <>...</>")

with open('src/components/AdminDashboard.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done")
