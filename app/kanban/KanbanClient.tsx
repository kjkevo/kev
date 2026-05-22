"use client";

import { useState } from "react";
import Link from "next/link";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  DragOverlay,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Lead = {
  id: number;
  companyName: string;
  contactName: string;
  title: string;
  email: string;
  triggerEvent: string;
  status: string;
  tags: string[];
  createdAt: string;
};

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const STAGES = [
  { id: "new", label: "New", color: "border-t-gray-400" },
  { id: "contacted", label: "Contacted", color: "border-t-blue-400" },
  { id: "qualified", label: "Qualified", color: "border-t-cyan-400" },
  { id: "proposal", label: "Proposal", color: "border-t-amber-400" },
  { id: "negotiation", label: "Negotiation", color: "border-t-orange-400" },
  { id: "won", label: "Won", color: "border-t-emerald-400" },
  { id: "lost", label: "Lost", color: "border-t-rose-400" },
];

function classifyTrigger(trigger: string) {
  const t = trigger.toLowerCase();
  if (/series|raised|funding|round|\$\d/.test(t)) return { icon: "💰", label: "Funding", badge: "bg-emerald-50 text-emerald-700 border border-emerald-200" };
  if (/job|hir|engineer|recruit|role|devops|sre|position/.test(t)) return { icon: "🧑‍💻", label: "Hiring", badge: "bg-blue-50 text-blue-700 border border-blue-200" };
  if (/competitor|price|switch|g2|alternative|crm|moved away/.test(t)) return { icon: "⚔️", label: "Competitor", badge: "bg-rose-50 text-rose-700 border border-rose-200" };
  if (/webinar|attended|demo|event|stayed/.test(t)) return { icon: "🎯", label: "Engagement", badge: "bg-amber-50 text-amber-700 border border-amber-200" };
  if (/blog|post|publish|article|wrote/.test(t)) return { icon: "📝", label: "Content", badge: "bg-violet-50 text-violet-700 border border-violet-200" };
  return { icon: "📌", label: "Other", badge: "bg-gray-50 text-gray-600 border border-gray-200" };
}

const TAG_COLORS = [
  "bg-blue-100 text-blue-700",
  "bg-violet-100 text-violet-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
];

function tagColor(tag: string) {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) hash = (hash * 31 + tag.charCodeAt(i)) | 0;
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
}

// ---------------------------------------------------------------------------
// Card component
// ---------------------------------------------------------------------------

function KanbanCard({ lead, isDragging = false }: { lead: Lead; isDragging?: boolean }) {
  const trigger = classifyTrigger(lead.triggerEvent);
  return (
    <Link href={`/leads/${lead.id}`}>
      <div
        className={`bg-white rounded-xl border border-gray-100 p-3 space-y-2 cursor-grab active:cursor-grabbing hover:shadow-md transition-all ${
          isDragging ? "shadow-lg rotate-1 opacity-90" : "shadow-sm"
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{lead.companyName}</p>
            <p className="text-xs text-gray-500 truncate">{lead.contactName}</p>
          </div>
          <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${trigger.badge}`}>
            {trigger.icon}
          </span>
        </div>

        {lead.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {lead.tags.slice(0, 3).map((tag) => (
              <span key={tag} className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${tagColor(tag)}`}>
                {tag}
              </span>
            ))}
            {lead.tags.length > 3 && (
              <span className="text-xs text-gray-400">+{lead.tags.length - 3}</span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Sortable card wrapper
// ---------------------------------------------------------------------------

function SortableCard({ lead }: { lead: Lead }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lead.id,
    data: { lead },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <KanbanCard lead={lead} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Column component
// ---------------------------------------------------------------------------

function KanbanColumn({
  stage,
  leads,
}: {
  stage: (typeof STAGES)[number];
  leads: Lead[];
}) {
  return (
    <div className={`flex flex-col bg-gray-50 rounded-2xl border-t-4 ${stage.color} min-h-[400px] w-64 shrink-0`}>
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-700">{stage.label}</h3>
        <span className="text-xs font-semibold text-gray-400 bg-white border border-gray-200 px-2 py-0.5 rounded-full">
          {leads.length}
        </span>
      </div>
      <SortableContext items={leads.map((l) => l.id)} strategy={verticalListSortingStrategy}>
        <div className="flex-1 px-3 pb-3 space-y-2 overflow-y-auto">
          {leads.map((lead) => (
            <SortableCard key={lead.id} lead={lead} />
          ))}
          {leads.length === 0 && (
            <div className="h-20 border-2 border-dashed border-gray-200 rounded-xl flex items-center justify-center">
              <p className="text-xs text-gray-400">Drop here</p>
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Kanban board
// ---------------------------------------------------------------------------

export default function KanbanClient({ leads: initialLeads }: { leads: Lead[] }) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [activeId, setActiveId] = useState<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const activeLead = leads.find((l) => l.id === activeId);

  function onDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as number);
  }

  function onDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;

    const draggedId = active.id as number;
    const overId = over.id;

    // Check if over a column (stage id is a string like "new", "contacted", etc.)
    const overStage = STAGES.find((s) => s.id === overId);
    if (overStage) {
      setLeads((prev) =>
        prev.map((l) => (l.id === draggedId ? { ...l, status: overStage.id } : l))
      );
      return;
    }

    // Over another card: find that card's column
    const overLead = leads.find((l) => l.id === overId);
    if (overLead && overLead.status !== leads.find((l) => l.id === draggedId)?.status) {
      setLeads((prev) =>
        prev.map((l) => (l.id === draggedId ? { ...l, status: overLead.status } : l))
      );
    }
  }

  async function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    const draggedId = active.id as number;
    const draggedLead = leads.find((l) => l.id === draggedId);
    if (!draggedLead) return;

    // Persist the status update
    await fetch(`/api/leads/${draggedId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draggedLead),
    });
  }

  const leadsByStage = (stageId: string) => leads.filter((l) => l.status === stageId);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-full px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link href="/" className="text-xl font-bold text-brand-700 shrink-0">
            LeadIQ
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-500">
            <Link href="/dashboard" className="hover:text-gray-900 transition-colors">Dashboard</Link>
            <Link href="/kanban" className="text-brand-600 font-semibold">Kanban</Link>
            <Link href="/leads" className="hover:text-gray-900 transition-colors">All Leads</Link>
          </nav>
          <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
            {leads.length} lead{leads.length !== 1 ? "s" : ""}
          </span>
        </div>
      </header>

      <main className="px-4 sm:px-6 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pipeline Kanban</h1>
          <p className="text-sm text-gray-500 mt-1">Drag leads between stages to update their status</p>
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
        >
          <div className="flex gap-4 overflow-x-auto pb-4">
            {STAGES.map((stage) => (
              <KanbanColumn
                key={stage.id}
                stage={stage}
                leads={leadsByStage(stage.id)}
              />
            ))}
          </div>

          <DragOverlay>
            {activeLead ? (
              <div className="w-64">
                <KanbanCard lead={activeLead} isDragging />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </main>
    </div>
  );
}
