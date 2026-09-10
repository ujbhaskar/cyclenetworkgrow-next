"use client";

import { useState } from "react";
import Table from "react-bootstrap/Table";
import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import Alert from "react-bootstrap/Alert";
import { ROLES, type Role, type UserProfile } from "@/lib/models/user";
import CreateUserModal from "./CreateUserModal";

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
    }
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

      <Table responsive hover>
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Phone</th>
            <th>Role</th>
            <th>Joined</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.uid}>
              <td>{user.displayName}</td>
              <td>{user.email ?? "—"}</td>
              <td>{user.phone ?? "—"}</td>
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
              <td>
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
    </div>
  );
}
