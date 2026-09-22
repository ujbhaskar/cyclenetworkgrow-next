"use client";

import { useMemo, useState } from "react";
import Table from "react-bootstrap/Table";
import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import Alert from "react-bootstrap/Alert";
import Toast from "react-bootstrap/Toast";
import ToastContainer from "react-bootstrap/ToastContainer";
import { ROLES, type Role, type UserProfile } from "@/lib/models/user";
import { normalizeCity, normalizeCasing } from "@/lib/registration-normalize";
import CreateUserModal from "./CreateUserModal";
import EditUserModal from "./EditUserModal";
import ImpersonateButton from "./ImpersonateButton";

export default function UsersTable({
  initialUsers,
  currentUid,
}: {
  initialUsers: UserProfile[];
  currentUid: string;
}) {
  const [users, setUsers] = useState(initialUsers);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [roleChangeToast, setRoleChangeToast] = useState<string | null>(null);
  const [profileSavedToast, setProfileSavedToast] = useState<string | null>(null);

  const [nameFilter, setNameFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [stateFilter, setStateFilter] = useState("");

  // Populated from whatever's actually in the current list, not a fixed
  // list — so the dropdowns never offer a choice that would return zero
  // rows, and stay correct as riders' locations change. Normalized first
  // so "Kolkata"/"kolkata"/"KOLKATA" collapse into one option instead of
  // three near-duplicates.
  const cityOptions = useMemo(
    () => [...new Set(users.map((u) => (u.city ? normalizeCity(u.city) : "")).filter(Boolean))].sort(),
    [users],
  );
  const stateOptions = useMemo(
    () => [...new Set(users.map((u) => (u.state ? normalizeCasing(u.state) : "")).filter(Boolean))].sort(),
    [users],
  );

  const filteredUsers = users.filter((u) => {
    if (nameFilter.trim() && !u.displayName.toLowerCase().includes(nameFilter.trim().toLowerCase())) {
      return false;
    }
    if (cityFilter && (u.city ? normalizeCity(u.city) : "") !== cityFilter) {
      return false;
    }
    if (stateFilter && (u.state ? normalizeCasing(u.state) : "") !== stateFilter) {
      return false;
    }
    return true;
  });

  async function refetch() {
    const res = await fetch("/api/admin/users");
    if (res.ok) {
      const body = await res.json();
      setUsers(body.users);
    }
  }

  async function handleRoleChange(uid: string, role: Role) {
    setError(null);
    const previous = users;
    setUsers((list) => list.map((u) => (u.uid === uid ? { ...u, role } : u)));
    const res = await fetch(`/api/admin/users/${uid}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    if (!res.ok) {
      setUsers(previous);
      setError("Couldn't update that user's role.");
      return;
    }
    const user = previous.find((u) => u.uid === uid);
    setRoleChangeToast(`${user?.displayName ?? "User"}'s role changed to ${role}.`);
  }

  function handleProfileSaved(updated: Partial<UserProfile> & { uid: string }) {
    setUsers((list) => list.map((u) => (u.uid === updated.uid ? { ...u, ...updated } : u)));
    setEditingUser(null);
    setProfileSavedToast(`${updated.displayName ?? "User"}'s details were updated.`);
  }

  async function handleDelete(uid: string) {
    if (!confirm("Delete this user permanently? This can't be undone.")) {
      return;
    }
    setError(null);
    const res = await fetch(`/api/admin/users/${uid}`, { method: "DELETE" });
    if (res.ok) {
      setUsers((list) => list.filter((u) => u.uid !== uid));
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Couldn't delete that user.");
    }
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h1 className="h3 mb-0">Users</h1>
        <Button onClick={() => setShowCreate(true)}>Add user</Button>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      <div className="d-flex flex-wrap align-items-end gap-2 mb-3">
        <Form.Group>
          <Form.Label className="small mb-1">Name</Form.Label>
          <Form.Control
            size="sm"
            value={nameFilter}
            onChange={(e) => setNameFilter(e.target.value)}
            placeholder="Search by name…"
            style={{ width: 200 }}
          />
        </Form.Group>
        <Form.Group>
          <Form.Label className="small mb-1">City</Form.Label>
          <Form.Select
            size="sm"
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            style={{ width: 160 }}
          >
            <option value="">All cities</option>
            {cityOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Form.Select>
        </Form.Group>
        <Form.Group>
          <Form.Label className="small mb-1">State</Form.Label>
          <Form.Select
            size="sm"
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
            style={{ width: 180 }}
          >
            <option value="">All states</option>
            {stateOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Form.Select>
        </Form.Group>
        {(nameFilter || cityFilter || stateFilter) && (
          <Button
            size="sm"
            variant="outline-secondary"
            onClick={() => {
              setNameFilter("");
              setCityFilter("");
              setStateFilter("");
            }}
          >
            Clear filters
          </Button>
        )}
        <span className="text-muted small ms-auto">
          {filteredUsers.length} of {users.length} users
        </span>
      </div>

      <Table responsive hover className="table table-striped">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Phone</th>
            <th>City</th>
            <th>State</th>
            <th>Role</th>
            <th>Joined</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {filteredUsers.map((user) => (
            <tr key={user.uid}>
              <td className="text-nowrap">{user.displayName}</td>
              <td>{user.email ?? "—"}</td>
              <td>{user.phone ?? "—"}</td>
              <td>{user.city ?? "—"}</td>
              <td>{user.state ?? "—"}</td>
              <td>
                <Form.Select
                  size="sm"
                  value={user.role}
                  onChange={(e) => handleRoleChange(user.uid, e.target.value as Role)}
                  disabled={user.uid === currentUid}
                  style={{ width: 130 }}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </Form.Select>
              </td>
              <td>{new Date(user.createdAt).toLocaleDateString()}</td>
              <td className="d-flex gap-2">
                <Button
                  size="sm"
                  variant="outline-secondary"
                  onClick={() => setEditingUser(user)}
                  title="Fix this rider's name/city/state/phone"
                >
                  <i className="bi bi-pencil" aria-hidden />
                </Button>
                <ImpersonateButton uid={user.uid} disabled={user.uid === currentUid || user.role === "admin"} />
                <Button
                  size="sm"
                  variant="outline-danger"
                  onClick={() => handleDelete(user.uid)}
                  disabled={user.uid === currentUid}
                >
                  Delete
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>

      <CreateUserModal show={showCreate} onClose={() => setShowCreate(false)} onCreated={refetch} />

      <EditUserModal
        key={editingUser?.uid}
        user={editingUser}
        onClose={() => setEditingUser(null)}
        onSaved={handleProfileSaved}
      />

      <ToastContainer position="top-center" className="p-3" style={{ zIndex: 1100 }}>
        <Toast bg="success" onClose={() => setRoleChangeToast(null)} show={!!roleChangeToast} delay={3000} autohide>
          <Toast.Body className="text-white">{roleChangeToast}</Toast.Body>
        </Toast>
        <Toast bg="success" onClose={() => setProfileSavedToast(null)} show={!!profileSavedToast} delay={3000} autohide>
          <Toast.Body className="text-white">{profileSavedToast}</Toast.Body>
        </Toast>
      </ToastContainer>
    </div>
  );
}
