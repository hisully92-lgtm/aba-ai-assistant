"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Profile = {
  id: string;
  full_name: string;
  email: string;
  role: string;
};

export default function AdminPage() {
  const router = useRouter();

  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState("rbt");

  // 🔐 ROLE GUARD (ADDED)
  useEffect(() => {
    async function check() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        router.replace("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();

      const role = profile?.role ?? "rbt";

      if (role !== "admin") {
        router.replace("/login");
      }
    }

    check();
  }, [router]);

  // LOAD USERS
  async function loadUsers() {
    setLoading(true);

    const { data, error } = await supabase.from("profiles").select("*");

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    setUsers(data || []);
    setLoading(false);
  }

  useEffect(() => {
    loadUsers();
  }, []);

  // UPDATE ROLE
  async function updateRole(userId: string, newRole: string) {
    const { error } = await supabase
      .from("profiles")
      .update({ role: newRole })
      .eq("id", userId);

    if (error) {
      alert(error.message);
      return;
    }

    loadUsers();
  }

  // CREATE USER
  async function createUser() {
    if (!newName || !newEmail) {
      alert("Please enter name and email.");
      return;
    }

    const res = await fetch("/api/admin/create-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: newEmail,
        full_name: newName,
        role: newRole,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "Something went wrong");
      return;
    }

    alert("User invited successfully!");

    setNewName("");
    setNewEmail("");
    setNewRole("rbt");

    loadUsers();
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>Admin Panel</h1>

      {/* CREATE USER */}
      <div
        style={{
          marginBottom: 30,
          padding: 15,
          border: "1px solid #ddd",
          borderRadius: 8,
        }}
      >
        <h2>Create User</h2>

        <input
          placeholder="Full Name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          style={{ marginRight: 10 }}
        />

        <input
          placeholder="Email"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          style={{ marginRight: 10 }}
        />

        <select
          value={newRole}
          onChange={(e) => setNewRole(e.target.value)}
          style={{ marginRight: 10 }}
        >
          <option value="admin">admin</option>
          <option value="supervisor">supervisor</option>
          <option value="student_analyst">student_analyst</option>
          <option value="rbt">rbt</option>
        </select>

        <button onClick={createUser}>Create User</button>
      </div>

      {/* USER TABLE */}
      {loading ? (
        <p>Loading users...</p>
      ) : (
        <table border={1} cellPadding={10} style={{ width: "100%" }}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Change Role</th>
            </tr>
          </thead>

          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.full_name}</td>
                <td>{user.email}</td>
                <td>{user.role}</td>
                <td>
                  <select
                    value={user.role}
                    onChange={(e) =>
                      updateRole(user.id, e.target.value)
                    }
                  >
                    <option value="admin">admin</option>
                    <option value="supervisor">supervisor</option>
                    <option value="student_analyst">student_analyst</option>
                    <option value="rbt">rbt</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}