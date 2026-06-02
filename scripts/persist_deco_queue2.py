import sys

with open('src/components/DecoDashboard.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

changes = 0

# 1. Add .catch() to fire-and-forget upsertDecorationQueue calls
# First one (freezerItem path)
old1 = """        };
        db.upsertDecorationQueue([newTask]);
        setDecoQueue(prev => [...prev, newTask]);
        setDecoTaskQty"""

new1 = """        };
        db.upsertDecorationQueue([newTask]).catch(console.error);
        setDecoQueue(prev => [...prev, newTask]);
        setDecoTaskQty"""

if old1 in content:
    content = content.replace(old1, new1)
    changes += 1
    print("OK 1/2: Added .catch to freezerItem upsert")
else:
    print("FAIL 1/2: Could not find freezerItem upsert pattern")
    sys.exit(1)

# Second one (manual path)
old2 = """        };
        db.upsertDecorationQueue([newTask]);
        setDecoQueue(prev => [...prev, newTask]);
        setShowAddDecoTask"""

new2 = """        };
        db.upsertDecorationQueue([newTask]).catch(console.error);
        setDecoQueue(prev => [...prev, newTask]);
        setShowAddDecoTask"""

if old2 in content:
    content = content.replace(old2, new2)
    changes += 1
    print("OK 2/2: Added .catch to manual upsert")
else:
    print("FAIL 2/2: Could not find manual upsert pattern")
    sys.exit(1)

# 3. Fix handleBackward to handle async properly
old3 = """    const handleBackward = (task: DecoTask) => {
      if (task.status === "in-progress") updateDecoTask(task.id, "pending");
      else if (task.status === "completed") updateDecoTask(task.id, "in-progress");
    };"""

new3 = """    const handleBackward = async (task: DecoTask) => {
      if (task.status === "in-progress") await updateDecoTask(task.id, "pending");
      else if (task.status === "completed") await updateDecoTask(task.id, "in-progress");
    };"""

if old3 in content:
    content = content.replace(old3, new3)
    changes += 1
    print("OK 3/3: Fixed handleBackward to await async updateDecoTask")
else:
    print("FAIL 3/3: Could not find handleBackward")
    sys.exit(1)

with open('src/components/DecoDashboard.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done! %d changes applied." % changes)
