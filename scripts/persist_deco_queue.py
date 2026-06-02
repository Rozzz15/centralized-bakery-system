import sys

with open('src/components/DecoDashboard.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

changes = 0

# 1. Add load + subscribe useEffects after fetchMaterialRequests useEffect
old1 = """  useEffect(() => {
    db.fetchMaterialRequests().then(setMaterialReqs).catch(() => {});
  }, []);

  const togglePrepared"""

new1 = """  useEffect(() => {
    db.fetchMaterialRequests().then(setMaterialReqs).catch(() => {});
  }, []);

  // Load decoration queue from DB on mount
  useEffect(() => {
    db.fetchDecorationQueue().then((items) => {
      if (items.length > 0) setDecoQueue(items as DecoTask[]);
    }).catch(console.error);
  }, []);

  // Real-time subscription for decoration queue
  useEffect(() => {
    return db.subscribeDecorationQueue(() => {
      db.fetchDecorationQueue().then((items) => {
        if (items.length > 0) setDecoQueue(items as DecoTask[]);
      }).catch(console.error);
    });
  }, []);

  const togglePrepared"""

if old1 in content:
    content = content.replace(old1, new1)
    changes += 1
    print("OK 1/5: Added load + subscribe useEffects")
else:
    print("FAIL 1/5: Could not find fetchMaterialRequests useEffect")
    sys.exit(1)

# 2. Make updateDecoTask async and persist to DB
old2 = """  const updateDecoTask = (id: string, status: DecoTask["status"]) => {
    setDecoQueue(prev => prev.map(t => t.id === id ? { ...t, status } : t));
  };"""

new2 = """  const updateDecoTask = async (id: string, status: DecoTask["status"]) => {
    const task = decoQueue.find(t => t.id === id);
    if (task) {
      const updated = { ...task, status };
      await db.upsertDecorationQueue([updated]);
      setDecoQueue(prev => prev.map(t => t.id === id ? updated : t));
    }
  };"""

if old2 in content:
    content = content.replace(old2, new2)
    changes += 1
    print("OK 2/5: Made updateDecoTask async with DB persistence")
else:
    print("FAIL 2/5: Could not find updateDecoTask")
    sys.exit(1)

# 3. Make handleDeleteTask async and delete from DB
old3 = """    const handleDeleteTask = (id: string) => {
      if (confirm("Delete this task?")) setDecoQueue(prev => prev.filter(t => t.id !== id));
    };"""

new3 = """    const handleDeleteTask = async (id: string) => {
      if (confirm("Delete this task?")) {
        await db.deleteDecorationQueue(id);
        setDecoQueue(prev => prev.filter(t => t.id !== id));
      }
    };"""

if old3 in content:
    content = content.replace(old3, new3)
    changes += 1
    print("OK 3/5: Made handleDeleteTask async with DB deletion")
else:
    print("FAIL 3/5: Could not find handleDeleteTask")
    sys.exit(1)

# 4. Add db save in handleAddTask for freezerItem path
old4 = """          sourceProducedBy: freezerItem.producedBy,
        };
        setDecoQueue(prev => [...prev, newTask]);"""

new4 = """          sourceProducedBy: freezerItem.producedBy,
        };
        db.upsertDecorationQueue([newTask]);
        setDecoQueue(prev => [...prev, newTask]);"""

if old4 in content:
    content = content.replace(old4, new4)
    changes += 1
    print("OK 4/5: Added DB save in handleAddTask (freezerItem path)")
else:
    print("FAIL 4/5: Could not find freezerItem handleAddTask section")
    sys.exit(1)

# 5. Add db save in handleAddTask for manual path
old5 = """        };
        setDecoQueue(prev => [...prev, newTask]);
        setShowAddDecoTask(false);"""

new5 = """        };
        db.upsertDecorationQueue([newTask]);
        setDecoQueue(prev => [...prev, newTask]);
        setShowAddDecoTask(false);"""

if old5 in content:
    content = content.replace(old5, new5)
    changes += 1
    print("OK 5/5: Added DB save in handleAddTask (manual path)")
else:
    print("FAIL 5/5: Could not find manual handleAddTask section")
    sys.exit(1)

# Write back
with open('src/components/DecoDashboard.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done! %d changes applied successfully." % changes)
