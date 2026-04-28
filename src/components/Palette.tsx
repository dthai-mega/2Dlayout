import { useState } from 'react';
import type { ComponentDef, PlacedComponent } from '../types';

interface Props {
  defs: ComponentDef[];
  placed: PlacedComponent[];
  onDeleteDef: (id: string) => void;
  onEditDef: (def: ComponentDef) => void;
  onAddDef: (def: ComponentDef) => void;
}

function placedCount(def: ComponentDef, placed: PlacedComponent[]): number {
  return placed.filter(p => p.defId === def.id).length;
}

function nextAutoId(defs: ComponentDef[]): string {
  const nums = defs.map(d => parseInt(d.id)).filter(n => !isNaN(n));
  return nums.length > 0 ? String(Math.max(...nums) + 1) : '1';
}

type FormState = { id: string; partNumber: string; width: string; height: string; depth: string; qty: string };

const blankForm = (id: string): FormState => ({ id, partNumber: '', width: '', height: '', depth: '', qty: '1' });

function isFormValid(f: FormState, allowEditId = false): boolean {
  return (allowEditId || !!f.id.trim()) &&
    !!f.partNumber.trim() &&
    !isNaN(parseFloat(f.width)) && parseFloat(f.width) > 0 &&
    !isNaN(parseFloat(f.height)) && parseFloat(f.height) > 0 &&
    !isNaN(parseFloat(f.depth)) &&
    Number.isInteger(Number(f.qty)) && Number(f.qty) >= 1;
}

function FormFields({ form, onChange, showId }: {
  form: FormState;
  onChange: (f: FormState) => void;
  showId: boolean;
}) {
  const f = (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...form, [field]: e.target.value });
  return (
    <>
      {showId && (
        <input
          placeholder="ID"
          value={form.id}
          onChange={f('id')}
          onKeyDown={e => e.stopPropagation()}
          style={{ width: '100%', marginBottom: 3 }}
        />
      )}
      <input
        placeholder="Part Number"
        value={form.partNumber}
        onChange={f('partNumber')}
        onKeyDown={e => e.stopPropagation()}
        style={{ width: '100%', marginBottom: 3 }}
      />
      <div style={{ display: 'flex', gap: 3, marginBottom: 3 }}>
        <input type="number" placeholder="W" value={form.width} onChange={f('width')} onKeyDown={e => e.stopPropagation()} style={{ width: 0, flex: 1 }} />
        <input type="number" placeholder="H" value={form.height} onChange={f('height')} onKeyDown={e => e.stopPropagation()} style={{ width: 0, flex: 1 }} />
        <input type="number" placeholder="D" value={form.depth} onChange={f('depth')} onKeyDown={e => e.stopPropagation()} style={{ width: 0, flex: 1 }} />
      </div>
      <input
        type="number"
        placeholder="Qty"
        value={form.qty}
        onChange={f('qty')}
        onKeyDown={e => e.stopPropagation()}
        style={{ width: '100%' }}
      />
    </>
  );
}

export default function Palette({ defs, placed, onDeleteDef, onEditDef, onAddDef }: Props) {
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormState>(blankForm(''));
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState<FormState>(blankForm(''));

  function handleDragStart(e: React.DragEvent, defId: string) {
    e.dataTransfer.setData('defId', defId);
    e.dataTransfer.effectAllowed = 'copy';
  }

  function startEdit(def: ComponentDef) {
    setEditingId(def.id);
    setEditForm({ id: def.id, partNumber: def.partNumber, width: String(def.width), height: String(def.height), depth: String(def.depth), qty: String(def.qty) });
  }

  function submitEdit(id: string) {
    if (!isFormValid(editForm, true)) return;
    onEditDef({ id, partNumber: editForm.partNumber.trim(), width: parseFloat(editForm.width), height: parseFloat(editForm.height), depth: parseFloat(editForm.depth), qty: parseInt(editForm.qty) });
    setEditingId(null);
  }

  function openAddForm() {
    setAddForm(blankForm(nextAutoId(defs)));
    setShowAddForm(true);
  }

  function submitAdd() {
    if (!isFormValid(addForm)) return;
    if (defs.some(d => d.id === addForm.id.trim())) return; // duplicate
    onAddDef({ id: addForm.id.trim(), partNumber: addForm.partNumber.trim(), width: parseFloat(addForm.width), height: parseFloat(addForm.height), depth: parseFloat(addForm.depth), qty: parseInt(addForm.qty) });
    setShowAddForm(false);
  }

  return (
    <div className="palette">
      {defs.length === 0 && !showAddForm && (
        <div style={{ color: '#999', fontSize: 12, marginBottom: 6 }}>Load a CSV or add items manually</div>
      )}

      {defs.map(def => {
        const count = placedCount(def, placed);
        const full = count >= def.qty;

        if (editingId === def.id) {
          return (
            <div key={def.id} className="palette-item" style={{ cursor: 'default' }}>
              <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 12 }}>{def.id}</div>
              <FormFields form={editForm} onChange={setEditForm} showId={false} />
              <div style={{ display: 'flex', gap: 4, marginTop: 5 }}>
                <button style={{ flex: 1 }} onClick={() => submitEdit(def.id)} disabled={!isFormValid(editForm, true)}>Save</button>
                <button style={{ flex: 1 }} onClick={() => setEditingId(null)}>Cancel</button>
              </div>
            </div>
          );
        }

        return (
          <div
            key={def.id}
            className={`palette-item${full ? ' fully-placed' : ''}`}
            draggable={!full}
            onDragStart={full ? undefined : e => handleDragStart(e, def.id)}
            style={{ position: 'relative', paddingRight: 40 }}
          >
            <div className="palette-item-id">{def.id}</div>
            <div className="palette-item-pn">{def.partNumber}</div>
            <div className="palette-item-qty">{count}/{def.qty} placed</div>
            <div style={{ position: 'absolute', top: 3, right: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <button
                className="palette-card-btn"
                title="Edit"
                onClick={e => { e.stopPropagation(); startEdit(def); }}
                style={{ fontSize: 11, padding: '1px 4px', lineHeight: 1 }}
              >✎</button>
              <button
                className="palette-card-btn palette-card-btn-delete"
                title="Delete"
                onClick={e => { e.stopPropagation(); setDeleteConfirmId(def.id); }}
                style={{ fontSize: 13, padding: '0px 4px', lineHeight: 1 }}
              >×</button>
            </div>
          </div>
        );
      })}

      {showAddForm ? (
        <div className="palette-item" style={{ cursor: 'default', marginTop: 4 }}>
          <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 12 }}>New Item</div>
          <FormFields form={addForm} onChange={setAddForm} showId={true} />
          {defs.some(d => d.id === addForm.id.trim()) && (
            <div style={{ color: '#e53e3e', fontSize: 11, marginTop: 2 }}>ID already exists</div>
          )}
          <div style={{ display: 'flex', gap: 4, marginTop: 5 }}>
            <button style={{ flex: 1 }} onClick={submitAdd} disabled={!isFormValid(addForm) || defs.some(d => d.id === addForm.id.trim())}>Add</button>
            <button style={{ flex: 1 }} onClick={() => setShowAddForm(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <button style={{ width: '100%', marginTop: 4, padding: '5px 0' }} onClick={openAddForm}>+ Add Item</button>
      )}

      {deleteConfirmId && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.35)' }} onClick={() => setDeleteConfirmId(null)} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 201, background: '#fff', border: '1px solid #ccc', borderRadius: 6, padding: '16px 20px', boxShadow: '0 4px 16px rgba(0,0,0,0.2)', minWidth: 240 }}>
            <div style={{ marginBottom: 12 }}>
              Delete <strong>{deleteConfirmId}</strong>?<br />
              <span style={{ fontSize: 11, color: '#666' }}>All placed instances will also be removed.</span>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteConfirmId(null)}>Cancel</button>
              <button
                style={{ background: '#e53e3e', color: '#fff', border: 'none', borderRadius: 3, padding: '4px 12px', cursor: 'pointer' }}
                onClick={() => { onDeleteDef(deleteConfirmId); setDeleteConfirmId(null); }}
              >Delete</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
