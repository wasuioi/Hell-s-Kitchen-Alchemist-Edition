import { useState } from 'react'
import { useVfxStore } from '../stores/vfxStore'

export default function VfxPicker() {
  const [open, setOpen] = useState(false)
  const [addMode, setAddMode] = useState(false)
  const [newId, setNewId] = useState('')
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')

  const variants = useVfxStore((s) => s.variants)
  const activeId = useVfxStore((s) => s.activeExplosionId)
  const setActive = useVfxStore((s) => s.setActiveExplosion)
  const removeVariant = useVfxStore((s) => s.removeVariant)
  const addVariant = useVfxStore((s) => s.addVariant)

  const btnStyle = (active: boolean) => ({
    background: active ? '#f97316' : '#333',
    color: active ? 'black' : 'white',
    border: active ? '2px solid #fbbf24' : '1px solid #555',
    borderRadius: '6px',
    padding: '6px 10px',
    fontSize: '11px',
    cursor: 'pointer' as const,
    textAlign: 'left' as const,
    width: '100%',
  })

  function handleAdd() {
    if (!newId.trim() || !newName.trim()) return
    addVariant({ id: newId.trim(), name: newName.trim(), description: newDesc.trim() })
    setNewId('')
    setNewName('')
    setNewDesc('')
    setAddMode(false)
  }

  return (
    <div style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 999 }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          background: 'rgba(0,0,0,0.7)', color: '#f97316', border: '1px solid #f97316',
          borderRadius: '4px', padding: '4px 10px', fontSize: '11px', cursor: 'pointer',
        }}
      >
        {open ? 'Close VFX' : 'VFX Picker'}
      </button>
      {open && (
        <div style={{
          marginTop: '4px', background: 'rgba(0,0,0,0.9)', borderRadius: '8px',
          padding: '10px', color: 'white', fontSize: '11px',
          display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '240px',
          maxHeight: '400px', overflowY: 'auto',
        }}>
          <div style={{ opacity: 0.6, marginBottom: '4px' }}>Active: {activeId}</div>
          {variants.map((v) => (
            <div key={v.id} style={{ display: 'flex', gap: '4px', alignItems: 'stretch' }}>
              <button
                onClick={() => setActive(v.id)}
                style={btnStyle(v.id === activeId)}
              >
                <div style={{ fontWeight: 'bold' }}>{v.name}</div>
                <div style={{ opacity: 0.7, fontSize: '10px' }}>{v.description}</div>
              </button>
              <button
                onClick={() => removeVariant(v.id)}
                style={{
                  background: '#333', color: '#ef4444', border: '1px solid #555',
                  borderRadius: '6px', padding: '0 8px', cursor: 'pointer', fontSize: '14px',
                }}
                title="Delete this variant"
              >
                x
              </button>
            </div>
          ))}

          {/* Add new variant */}
          {!addMode ? (
            <button
              onClick={() => setAddMode(true)}
              style={{
                background: '#1a1a1a', color: '#888', border: '1px dashed #555',
                borderRadius: '6px', padding: '6px', cursor: 'pointer', fontSize: '11px',
                marginTop: '4px',
              }}
            >
              + Add variant
            </button>
          ) : (
            <div style={{
              marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '4px',
              border: '1px solid #555', borderRadius: '6px', padding: '8px',
            }}>
              <input
                placeholder="ID (e.g. my_custom_v6)"
                value={newId}
                onChange={(e) => setNewId(e.target.value)}
                style={{ background: '#222', color: 'white', border: '1px solid #444', borderRadius: '4px', padding: '4px', fontSize: '11px' }}
              />
              <input
                placeholder="Name (e.g. V6: My Version)"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                style={{ background: '#222', color: 'white', border: '1px solid #444', borderRadius: '4px', padding: '4px', fontSize: '11px' }}
              />
              <input
                placeholder="Description"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                style={{ background: '#222', color: 'white', border: '1px solid #444', borderRadius: '4px', padding: '4px', fontSize: '11px' }}
              />
              <div style={{ display: 'flex', gap: '4px' }}>
                <button onClick={handleAdd} style={{ background: '#22c55e', color: 'black', border: 'none', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', fontSize: '11px', flex: 1 }}>
                  Add
                </button>
                <button onClick={() => setAddMode(false)} style={{ background: '#333', color: 'white', border: 'none', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', fontSize: '11px' }}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
