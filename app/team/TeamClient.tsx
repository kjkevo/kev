"use client";

import { useState, useEffect, useCallback } from "react";

type Team = {
  id: number;
  name: string;
  role: string;
  memberCount: number;
};

type Member = {
  membershipId: number;
  userId: number;
  name: string | null;
  email: string;
  role: string;
  joinedAt: string;
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  manager: "Manager",
  rep: "Rep",
};

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-violet-100 text-violet-700",
  manager: "bg-blue-100 text-blue-700",
  rep: "bg-gray-100 text-gray-600",
};

export default function TeamClient({ currentUserId }: { currentUserId: number }) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [membersLoading, setMembersLoading] = useState(false);

  // Create team form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // Invite form
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("rep");
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState("");
  const [inviteError, setInviteError] = useState("");

  const fetchTeams = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/teams");
      if (res.ok) {
        const data = await res.json();
        setTeams(data);
        if (data.length > 0 && !selectedTeamId) {
          setSelectedTeamId(data[0].id);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [selectedTeamId]);

  const fetchMembers = useCallback(async (teamId: number) => {
    setMembersLoading(true);
    try {
      const res = await fetch(`/api/teams/${teamId}/members`);
      if (res.ok) {
        const data = await res.json();
        setMembers(data);
      }
    } finally {
      setMembersLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTeams();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedTeamId) fetchMembers(selectedTeamId);
  }, [selectedTeamId, fetchMembers]);

  const selectedTeam = teams.find((t) => t.id === selectedTeamId);
  const callerRole = selectedTeam?.role ?? "";

  async function createTeam() {
    if (!newTeamName.trim()) { setCreateError("Team name is required."); return; }
    setCreating(true);
    setCreateError("");
    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newTeamName.trim() }),
      });
      if (!res.ok) {
        const d = await res.json();
        setCreateError(d.error ?? "Failed to create team");
        return;
      }
      const team = await res.json();
      setTeams((prev) => [...prev, team]);
      setSelectedTeamId(team.id);
      setNewTeamName("");
      setShowCreateForm(false);
    } finally {
      setCreating(false);
    }
  }

  async function inviteMember() {
    if (!selectedTeamId) return;
    setInviting(true);
    setInviteError("");
    setInviteMsg("");
    try {
      const res = await fetch(`/api/teams/${selectedTeamId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      const d = await res.json();
      if (!res.ok) {
        setInviteError(d.error ?? "Failed to invite member");
        return;
      }
      setInviteMsg("Member added successfully.");
      setInviteEmail("");
      setInviteRole("rep");
      fetchMembers(selectedTeamId);
      // Update member count
      setTeams((prev) =>
        prev.map((t) => t.id === selectedTeamId ? { ...t, memberCount: t.memberCount + 1 } : t)
      );
    } finally {
      setInviting(false);
      setTimeout(() => setInviteMsg(""), 4000);
    }
  }

  async function changeRole(userId: number, role: string) {
    if (!selectedTeamId) return;
    await fetch(`/api/teams/${selectedTeamId}/members/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    setMembers((prev) => prev.map((m) => m.userId === userId ? { ...m, role } : m));
  }

  async function removeMember(userId: number) {
    if (!selectedTeamId) return;
    await fetch(`/api/teams/${selectedTeamId}/members/${userId}`, { method: "DELETE" });
    setMembers((prev) => prev.filter((m) => m.userId !== userId));
    setTeams((prev) =>
      prev.map((t) =>
        t.id === selectedTeamId ? { ...t, memberCount: Math.max(0, t.memberCount - 1) } : t
      )
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Team Workspaces</h1>
            <p className="text-sm text-gray-500 mt-1">Manage your teams and collaborate on leads</p>
          </div>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="inline-flex items-center gap-1.5 text-xs font-medium bg-brand-600 text-white hover:bg-brand-700 px-4 py-2 rounded-xl transition-colors"
          >
            + Create Team
          </button>
        </div>

        {/* Create team form */}
        {showCreateForm && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
            <h2 className="text-sm font-bold text-gray-700">New Team</h2>
            {createError && (
              <div className="bg-rose-50 text-rose-700 text-sm px-3 py-2 rounded-xl border border-rose-200">
                {createError}
              </div>
            )}
            <div className="flex gap-3">
              <input
                type="text"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createTeam()}
                placeholder="Team name…"
                className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <button
                onClick={createTeam}
                disabled={creating}
                className="text-sm bg-brand-600 text-white px-4 py-2 rounded-xl hover:bg-brand-700 font-medium disabled:opacity-60"
              >
                {creating ? "Creating…" : "Create"}
              </button>
              <button
                onClick={() => { setShowCreateForm(false); setCreateError(""); }}
                className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-sm text-gray-400 py-10 text-center">Loading teams…</div>
        ) : teams.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-16 text-center">
            <p className="text-2xl mb-3">👥</p>
            <p className="text-sm text-gray-500 font-medium">You&apos;re not in any teams yet.</p>
            <p className="text-xs text-gray-400 mt-1">Create a team to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Team list sidebar */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-1 mb-3">My Teams</p>
              {teams.map((team) => (
                <button
                  key={team.id}
                  onClick={() => setSelectedTeamId(team.id)}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                    selectedTeamId === team.id
                      ? "bg-brand-50 border-brand-200 text-brand-700"
                      : "bg-white border-gray-100 hover:border-gray-200 text-gray-700"
                  }`}
                >
                  <p className="text-sm font-semibold truncate">{team.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${ROLE_COLORS[team.role] ?? "bg-gray-100 text-gray-600"}`}>
                      {ROLE_LABELS[team.role] ?? team.role}
                    </span>
                    <span className="text-xs text-gray-400">{team.memberCount} member{team.memberCount !== 1 ? "s" : ""}</span>
                  </div>
                </button>
              ))}
            </div>

            {/* Team detail */}
            {selectedTeam && (
              <div className="lg:col-span-3 space-y-6">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <h2 className="text-lg font-bold text-gray-900">{selectedTeam.name}</h2>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold mt-1 inline-block ${ROLE_COLORS[callerRole] ?? ""}`}>
                        Your role: {ROLE_LABELS[callerRole] ?? callerRole}
                      </span>
                    </div>
                  </div>

                  {/* Members table */}
                  {membersLoading ? (
                    <p className="text-sm text-gray-400">Loading members…</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-100">
                            <th className="text-left text-xs font-semibold text-gray-500 py-2 pr-4">Name</th>
                            <th className="text-left text-xs font-semibold text-gray-500 py-2 pr-4">Email</th>
                            <th className="text-left text-xs font-semibold text-gray-500 py-2 pr-4">Role</th>
                            {callerRole === "admin" && (
                              <th className="text-left text-xs font-semibold text-gray-500 py-2">Actions</th>
                            )}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {members.map((member) => (
                            <tr key={member.userId} className="group">
                              <td className="py-3 pr-4 font-medium text-gray-900">
                                {member.name ?? "—"}
                                {member.userId === currentUserId && (
                                  <span className="ml-2 text-xs text-gray-400">(you)</span>
                                )}
                              </td>
                              <td className="py-3 pr-4 text-gray-500 text-xs">{member.email}</td>
                              <td className="py-3 pr-4">
                                {callerRole === "admin" && member.userId !== currentUserId ? (
                                  <select
                                    value={member.role}
                                    onChange={(e) => changeRole(member.userId, e.target.value)}
                                    className={`text-xs font-semibold px-2 py-1 rounded-full border-0 cursor-pointer focus:ring-2 focus:ring-brand-500 ${ROLE_COLORS[member.role] ?? "bg-gray-100"}`}
                                  >
                                    <option value="admin">Admin</option>
                                    <option value="manager">Manager</option>
                                    <option value="rep">Rep</option>
                                  </select>
                                ) : (
                                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ROLE_COLORS[member.role] ?? "bg-gray-100"}`}>
                                    {ROLE_LABELS[member.role] ?? member.role}
                                  </span>
                                )}
                              </td>
                              {callerRole === "admin" && (
                                <td className="py-3">
                                  {member.userId !== currentUserId ? (
                                    <button
                                      onClick={() => removeMember(member.userId)}
                                      className="text-xs text-rose-500 hover:text-rose-700 font-medium opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                      Remove
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => removeMember(member.userId)}
                                      className="text-xs text-gray-400 hover:text-rose-500 font-medium opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                      Leave
                                    </button>
                                  )}
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Invite member (admin only) */}
                {callerRole === "admin" && (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
                    <h3 className="text-sm font-bold text-gray-700">Invite Member</h3>
                    {inviteError && (
                      <div className="bg-rose-50 text-rose-700 text-sm px-3 py-2 rounded-xl border border-rose-200">
                        {inviteError}
                      </div>
                    )}
                    {inviteMsg && (
                      <div className="bg-emerald-50 text-emerald-700 text-sm px-3 py-2 rounded-xl border border-emerald-200">
                        {inviteMsg}
                      </div>
                    )}
                    <div className="flex gap-3 flex-wrap">
                      <input
                        type="email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="colleague@company.com"
                        className="flex-1 min-w-[200px] text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                      <select
                        value={inviteRole}
                        onChange={(e) => setInviteRole(e.target.value)}
                        className="text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
                      >
                        <option value="rep">Rep</option>
                        <option value="manager">Manager</option>
                        <option value="admin">Admin</option>
                      </select>
                      <button
                        onClick={inviteMember}
                        disabled={inviting || !inviteEmail.trim()}
                        className="text-sm bg-brand-600 text-white px-4 py-2 rounded-xl hover:bg-brand-700 font-medium disabled:opacity-60 transition-colors"
                      >
                        {inviting ? "Inviting…" : "Invite"}
                      </button>
                    </div>
                    <p className="text-xs text-gray-400">The user must already have an account in LeadIQ.</p>

                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
