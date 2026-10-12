/**
 * Task Service
 * Business logic for landlord task management
 */

import mongoose from "mongoose";
import Task, {
  ITaskDocument,
  TaskStatus,
  TaskCategory,
  ISubtask,
} from "./task.model";
import { callVercelAI } from "../ai/ai.service";
import Property from "../property/property.model";
import ApiError from "../../utils/ApiError";
import logger from "../../config/logger";
import { getPagination, buildPaginationMeta } from "../../utils/pagination";
import type {
  CreateTaskInput,
  UpdateTaskInput,
  GetTasksQuery,
} from "./task.validation";
import type { PaginationMeta } from "../../types/api.types";

export interface TaskSummary {
  today: number;
  upcoming: number;
  completed: number;
  total: number;
}

export interface TaskStatsResult {
  total: number;
  today: number;
  upcoming: number;
  completed: number;
  byPriority: { high: number; medium: number; low: number };
}

const validatePropertyOwnership = async (
  propertyId: string,
  landlordId: string,
): Promise<void> => {
  if (!mongoose.isValidObjectId(propertyId)) {
    throw ApiError.badRequest("Invalid property ID");
  }

  const property = await Property.findById(propertyId);
  if (!property || !property.isActive) {
    throw ApiError.notFound("Property not found");
  }

  if (property.landlordId.toString() !== landlordId) {
    throw ApiError.forbidden("You do not own this property");
  }
};

const sanitizeTzOffset = (offset: number): number =>
  offset >= -840 && offset <= 720 ? offset : 0;

export const computeStatus = (
  dueDate: Date,
  providedStatus?: TaskStatus,
  rawTzOffset = 0,
): TaskStatus => {
  return providedStatus || "pending";
};

/**
 * Single aggregation pipeline shared by getTasks and getTaskStats.
 * Promotes overdue upcoming tasks to the today bucket at query time.
 */
const aggregateStatusCounts = async (
  landlordId: string,
  todayUtc: Date,
): Promise<TaskSummary> => {
  const rows = await Task.aggregate([
    {
      $match: {
        landlordId: new mongoose.Types.ObjectId(landlordId),
        isActive: true,
      },
    },
    {
      $group: {
        _id: {
          $cond: [
            { $eq: ["$status", "completed"] },
            "completed",
            {
              $cond: [{ $lte: ["$dueDate", todayUtc] }, "today", "upcoming"],
            },
          ],
        },
        count: { $sum: 1 },
      },
    },
  ]);

  const map: Record<string, number> = {};
  for (const row of rows) map[row._id as string] = row.count as number;

  const today = map["today"] ?? 0;
  const upcoming = map["upcoming"] ?? 0;
  const completed = map["completed"] ?? 0;

  return { today, upcoming, completed, total: today + upcoming + completed };
};

export const handleRecurrence = async (
  task: ITaskDocument,
  session?: mongoose.ClientSession,
): Promise<void> => {
  if (!task.recurrence || task.recurrence.pattern === "none") {
    return;
  }

  const nextDue = new Date(task.dueDate);
  switch (task.recurrence.pattern) {
    case "weekly":
      nextDue.setDate(nextDue.getDate() + 7);
      break;
    case "monthly":
      nextDue.setMonth(nextDue.getMonth() + 1);
      break;
    case "quarterly":
      nextDue.setMonth(nextDue.getMonth() + 3);
      break;
    case "annually":
      nextDue.setFullYear(nextDue.getFullYear() + 1);
      break;
    default:
      return;
  }

  if (task.recurrence.endDate && nextDue > new Date(task.recurrence.endDate)) {
    return;
  }

  const newRawTask = {
    landlordId: task.landlordId,
    title: task.title,
    description: task.description,
    propertyId: task.propertyId,
    assignedTo: task.assignedTo,
    priority: task.priority,
    status: "pending" as TaskStatus,
    category: task.category,
    dueDate: nextDue,
    subtasks: task.subtasks.map((st) => ({
      title: st.title,
      isCompleted: false,
      completedAt: null,
    })),
    recurrence: task.recurrence,
    recurrenceParentId: task._id,
  };

  const newTask = new Task(newRawTask);
  await newTask.save();
  logger.info(
    `Auto-generated recurring task "${newTask.title}" with due date ${nextDue.toISOString()}`,
  );
};

export const seedDefaultTasks = async (
  landlordId: string,
  session?: mongoose.ClientSession,
): Promise<void> => {
  const count = await Task.countDocuments({ landlordId, isActive: true });
  if (count > 0) return;

  const now = new Date();
  const getFutureDate = (days: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() + days);
    return d;
  };

  const seedTasks = [
    {
      title: "Gas Safety Certificate Renewal (CP12)",
      description:
        "Annual gas safety check for landlord certification. Mandatory requirement in the UK.",
      priority: "high",
      status: "pending",
      category: "compliance",
      dueDate: getFutureDate(30),
      subtasks: [
        { title: "Contact certified Gas Safe engineer", isCompleted: false },
        { title: "Schedule inspection date with tenant", isCompleted: false },
        {
          title: "Conduct inspection and obtain certificate",
          isCompleted: false,
        },
        {
          title: "Provide copy of CP12 to tenant within 28 days",
          isCompleted: false,
        },
      ],
      recurrence: { pattern: "annually" },
    },
    {
      title: "EPC Assessment Check",
      description:
        "Check Energy Performance Certificate. Ensure rating is E or above.",
      priority: "medium",
      status: "pending",
      category: "compliance",
      dueDate: getFutureDate(45),
      subtasks: [
        { title: "Verify current EPC expiry and rating", isCompleted: false },
        {
          title:
            "If below rating E, review required energy efficiency improvements",
          isCompleted: false,
        },
      ],
      recurrence: { pattern: "none" },
    },
    {
      title: "Quarterly Property Inspection",
      description:
        "Regular routine inspection to assess property condition and tenant maintenance requirements.",
      priority: "medium",
      status: "pending",
      category: "inspection",
      dueDate: getFutureDate(14),
      subtasks: [
        { title: "Send 24-hour notice of entry to tenant", isCompleted: false },
        {
          title: "Inspect kitchen, bathroom, and loft for dampness",
          isCompleted: false,
        },
        {
          title: "Check smoke alarm batteries during visit",
          isCompleted: false,
        },
        { title: "Document inspection with photos", isCompleted: false },
      ],
      recurrence: { pattern: "quarterly" },
    },
    {
      title: "Self Assessment Tax Return",
      description:
        "File annual UK self-assessment tax return for rental income.",
      priority: "high",
      status: "pending",
      category: "financial",
      dueDate: new Date(
        now.getFullYear() + (now.getMonth() >= 10 ? 1 : 0),
        0,
        31,
      ),
      subtasks: [
        {
          title: "Gather all rental receipts and expense records",
          isCompleted: false,
        },
        {
          title: "Calculate net profit and deductible expenses",
          isCompleted: false,
        },
        { title: "Submit online form to HMRC", isCompleted: false },
      ],
      recurrence: { pattern: "annually" },
    },
    {
      title: "Tenancy Agreement Lease Review",
      description:
        "Review upcoming tenancy lease end and initiate renewal or check-out notice.",
      priority: "medium",
      status: "pending",
      category: "tenant_management",
      dueDate: getFutureDate(60),
      subtasks: [
        {
          title: "Contact tenant to discuss renewal interests",
          isCompleted: false,
        },
        { title: "Perform local market rent review", isCompleted: false },
        {
          title: "Draft tenancy agreement renewal or Section 21 if check-out",
          isCompleted: false,
        },
      ],
      recurrence: { pattern: "none" },
    },
    {
      title: "Annual Boiler Service",
      description:
        "Arrange annual maintenance service for heating boiler system to ensure efficiency and safety.",
      priority: "medium",
      status: "pending",
      category: "maintenance",
      dueDate: getFutureDate(20),
      subtasks: [
        { title: "Book appointment with plumber", isCompleted: false },
        {
          title: "Test radiators and flush system if needed",
          isCompleted: false,
        },
      ],
      recurrence: { pattern: "annually" },
    },
  ];

  await Task.insertMany(
    seedTasks.map((t) => ({ ...t, landlordId, isActive: true })),
    { session },
  );
  logger.info(`Seeded 6 default compliance tasks for landlord ${landlordId}`);
};

export const createTask = async (
  input: CreateTaskInput,
  landlordId: string,
  rawTzOffset = 0,
): Promise<ITaskDocument> => {
  if (input.propertyId) {
    await validatePropertyOwnership(input.propertyId, landlordId);
  }

  const status = input.status || "pending";

  const task = new Task({
    landlordId,
    title: input.title,
    description: input.description ?? null,
    propertyId: input.propertyId || null,
    assignedTo: input.assignedTo || null,
    priority: input.priority,
    status,
    category: input.category,
    dueDate: input.dueDate,
    subtasks: input.subtasks || [],
    recurrence: input.recurrence || { pattern: "none" },
  });

  await task.save();

  await task.populate([
    { path: "propertyId", select: "propertyName streetAddress city" },
    { path: "assignedTo", select: "name email role" },
  ]);

  logger.info(`Task created: "${task.title}" by landlord ${landlordId}`);

  return task;
};

export const getTasks = async (
  landlordId: string,
  query: GetTasksQuery,
): Promise<{
  tasks: ITaskDocument[];
  meta: PaginationMeta;
  summary: TaskSummary;
}> => {
  // Check and seed default tasks if empty
  await seedDefaultTasks(landlordId);

  const { page, limit, skip } = getPagination(query);

  const todayUtc = new Date();
  todayUtc.setUTCHours(0, 0, 0, 0);

  const baseConditions: Record<string, unknown>[] = [
    { landlordId: new mongoose.Types.ObjectId(landlordId) },
    { isActive: true },
  ];

  if (query.status === "today") {
    baseConditions.push({
      status: { $ne: "completed" },
      dueDate: { $lte: todayUtc },
    });
  } else if (query.status === "upcoming") {
    baseConditions.push({
      status: { $ne: "completed" },
      dueDate: { $gt: todayUtc },
    });
  } else if (query.status) {
    baseConditions.push({ status: query.status });
  }

  if (query.priority) {
    baseConditions.push({ priority: query.priority });
  }

  if (query.propertyId) {
    baseConditions.push({
      propertyId: new mongoose.Types.ObjectId(query.propertyId),
    });
  }

  if (query.category) {
    baseConditions.push({ category: query.category });
  }

  if (query.assignedTo) {
    baseConditions.push({
      assignedTo: new mongoose.Types.ObjectId(query.assignedTo),
    });
  }

  if (query.q) {
    baseConditions.push({
      $or: [
        { title: { $regex: query.q, $options: "i" } },
        { description: { $regex: query.q, $options: "i" } },
      ],
    });
  }

  const filter = { $and: baseConditions };

  let sortOption: Record<string, 1 | -1> = { dueDate: 1 };
  if (query.sortBy === "priority") {
    sortOption = { priority: 1 };
  } else if (query.sortBy === "category") {
    sortOption = { category: 1 };
  } else if (query.sortBy === "property") {
    sortOption = { propertyId: 1 };
  } else if (query.sortBy === "createdAt") {
    sortOption = { createdAt: -1 };
  } else if (query.sortBy === "dueDate") {
    sortOption = { dueDate: 1 };
  }

  const [tasks, total, summary] = await Promise.all([
    Task.find(filter)
      .populate("propertyId", "propertyName streetAddress city")
      .populate("assignedTo", "name email role")
      .sort(sortOption)
      .skip(skip)
      .limit(limit),
    Task.countDocuments(filter),
    aggregateStatusCounts(landlordId, todayUtc),
  ]);

  const meta = buildPaginationMeta(total, page, limit);

  return { tasks, meta, summary };
};

export const getTaskById = async (
  taskId: string,
  landlordId: string,
): Promise<ITaskDocument> => {
  if (!mongoose.isValidObjectId(taskId)) {
    throw ApiError.badRequest("Invalid task ID");
  }

  const task = await Task.findById(taskId)
    .populate("propertyId", "propertyName streetAddress city")
    .populate("assignedTo", "name email role");

  if (!task || !task.isActive) {
    throw ApiError.notFound("Task not found");
  }

  if (task.landlordId.toString() !== landlordId) {
    throw ApiError.forbidden("You do not have access to this task");
  }

  return task;
};

export const updateTask = async (
  taskId: string,
  landlordId: string,
  input: UpdateTaskInput,
  rawTzOffset = 0,
): Promise<ITaskDocument> => {
  const task = await getTaskById(taskId, landlordId);

  if (input.propertyId && input.propertyId !== task.propertyId?.toString()) {
    await validatePropertyOwnership(input.propertyId, landlordId);
  }

  if (input.title !== undefined) task.title = input.title;
  if (input.description !== undefined) task.description = input.description;
  if (input.priority !== undefined) task.priority = input.priority;
  if (input.category !== undefined) task.category = input.category;
  if (input.dueDate !== undefined) {
    task.dueDate = input.dueDate;
  }

  const wasCompleted = task.status === "completed";
  if (input.status !== undefined) {
    task.status = input.status;
    if (input.status === "completed" && !wasCompleted) {
      task.completedAt = new Date();
      // Auto-complete subtasks when parent task is completed
      task.subtasks = task.subtasks.map((st) => ({
        ...st,
        isCompleted: true,
        completedAt: st.completedAt || new Date(),
      }));
    } else if (input.status !== "completed" && wasCompleted) {
      task.completedAt = null;
    }
  }

  if ("propertyId" in input) {
    const pid = input.propertyId;
    task.propertyId = (
      pid && pid !== "" ? pid : null
    ) as mongoose.Types.ObjectId | null;
  }

  if ("assignedTo" in input) {
    const aid = input.assignedTo;
    task.assignedTo = (
      aid && aid !== "" ? aid : null
    ) as mongoose.Types.ObjectId | null;
  }

  if (input.subtasks !== undefined) {
    task.subtasks = input.subtasks.map((st) => ({
      title: st.title,
      isCompleted: st.isCompleted,
      completedAt:
        st.isCompleted && !st.completedAt ? new Date() : st.completedAt,
    })) as mongoose.Types.DocumentArray<any>;
  }

  if (input.recurrence !== undefined) {
    task.recurrence = input.recurrence;
  }

  // Save without session — standalone MongoDB doesn't support multi-document
  // transactions; the session wrapper was a no-op and gave false rollback safety.
  await task.save();

  // Trigger next recurrence as a best-effort operation (won't undo the update if it fails)
  if (input.status === "completed" && !wasCompleted) {
    try {
      await handleRecurrence(task);
    } catch (recurrenceErr) {
      logger.warn(`handleRecurrence failed after updateTask for ${taskId}`, {
        error:
          recurrenceErr instanceof Error
            ? recurrenceErr.message
            : String(recurrenceErr),
      });
    }
  }

  await task.populate([
    { path: "propertyId", select: "propertyName streetAddress city" },
    { path: "assignedTo", select: "name email role" },
  ]);

  logger.info(`Task updated: "${task.title}" (${taskId})`);

  return task;
};

export const completeTask = async (
  taskId: string,
  landlordId: string,
): Promise<ITaskDocument> => {
  const task = await getTaskById(taskId, landlordId);

  if (task.status === "completed") {
    logger.info(`Task ${taskId} already completed`);
    return task;
  }

  // ── Step 1: Mark task and subtasks as completed ────────────────────────────
  task.status = "completed";
  task.completedAt = new Date();

  task.subtasks = task.subtasks.map((st) => ({
    title: st.title,
    isCompleted: true,
    completedAt: st.completedAt || new Date(),
  })) as mongoose.Types.DocumentArray<any>;

  await task.save();

  logger.info(`Task completed: "${task.title}" (${taskId})`);

  try {
    await handleRecurrence(task);
  } catch (recurrenceErr) {
    logger.warn(
      `handleRecurrence failed for task ${taskId} — recurring task may not have been created`,
      {
        error:
          recurrenceErr instanceof Error
            ? recurrenceErr.message
            : String(recurrenceErr),
      },
    );
  }

  await task.populate([
    { path: "propertyId", select: "propertyName streetAddress city" },
    { path: "assignedTo", select: "name email role" },
  ]);

  return task;
};

export const deleteTask = async (
  taskId: string,
  landlordId: string,
): Promise<void> => {
  const task = await getTaskById(taskId, landlordId);
  task.isActive = false;
  await task.save();
  logger.info(`Task soft-deleted: "${task.title}" (${taskId})`);
};

export const searchTasks = async (
  landlordId: string,
  query: import("./task.validation").SearchTasksQuery,
): Promise<{ tasks: ITaskDocument[]; meta: PaginationMeta }> => {
  const { page, limit, skip } = getPagination(query);

  const baseConditions: Record<string, unknown>[] = [
    { landlordId: new mongoose.Types.ObjectId(landlordId) },
    { isActive: true },
  ];

  if (query.q && query.q.trim() !== "") {
    baseConditions.push({
      $or: [
        { title: { $regex: query.q.trim(), $options: "i" } },
        { description: { $regex: query.q.trim(), $options: "i" } },
      ],
    });
  }

  if (query.dueDate) {
    const start = new Date(`${query.dueDate}T00:00:00.000Z`);
    const end = new Date(`${query.dueDate}T23:59:59.999Z`);
    baseConditions.push({ dueDate: { $gte: start, $lte: end } });
  }

  const filter = { $and: baseConditions };

  const [tasks, total] = await Promise.all([
    Task.find(filter)
      .populate("propertyId", "propertyName streetAddress city")
      .populate("assignedTo", "name email role")
      .sort({ dueDate: 1 })
      .skip(skip)
      .limit(limit),
    Task.countDocuments(filter),
  ]);

  const meta = buildPaginationMeta(total, page, limit);

  return { tasks, meta };
};

export const getTaskStats = async (
  landlordId: string,
): Promise<TaskStatsResult> => {
  const todayUtc = new Date();
  todayUtc.setUTCHours(0, 0, 0, 0);

  const [summary, priorityRows] = await Promise.all([
    aggregateStatusCounts(landlordId, todayUtc),
    Task.aggregate([
      {
        $match: {
          landlordId: new mongoose.Types.ObjectId(landlordId),
          isActive: true,
          status: { $ne: "completed" },
        },
      },
      { $group: { _id: "$priority", count: { $sum: 1 } } },
    ]),
  ]);

  const priorityMap: Record<string, number> = {};
  for (const p of priorityRows)
    priorityMap[p._id as string] = p.count as number;

  return {
    total: summary.total,
    today: summary.today,
    upcoming: summary.upcoming,
    completed: summary.completed,
    byPriority: {
      high: priorityMap["high"] ?? 0,
      medium: priorityMap["medium"] ?? 0,
      low: priorityMap["low"] ?? 0,
    },
  };
};

export interface AISuggestedTask {
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  category: TaskCategory;
  dueDate: string; // YYYY-MM-DD
  reason: string;
  propertyName?: string;
}

export const getAITaskSuggestions = async (
  landlordId: string,
): Promise<AISuggestedTask[]> => {
  const properties = await Property.find({ landlordId, isActive: true }).lean();
  if (properties.length === 0) {
    return [];
  }

  const propertyBlocks = properties
    .map((p) => {
      return `- Name: ${p.propertyName}\n  Address: ${p.streetAddress}, ${p.city}, ${p.postcode}\n  Type: ${p.propertyType}\n  EPC Rating: ${p.epcRating || "Unknown"}\n  Insurance Renewal: ${p.renewalDate ? new Date(p.renewalDate).toLocaleDateString("en-GB") : "Unknown"}\n  Gas safety: ${p.gasSafetyExpiry ? new Date(p.gasSafetyExpiry).toLocaleDateString("en-GB") : "Unknown"}\n  EICR: ${p.electricalSafetyExpiry ? new Date(p.electricalSafetyExpiry).toLocaleDateString("en-GB") : "Unknown"}\n  HMO license: ${p.hmoLicenceExpiry ? new Date(p.hmoLicenceExpiry).toLocaleDateString("en-GB") : "Unknown"}`;
    })
    .join("\n\n");

  const systemPrompt =
    "You are a UK property compliance advisor. Return only valid JSON arrays, no markdown.";
  const userPrompt =
    `Here is the landlord's UK property portfolio:\n\n${propertyBlocks}\n\n` +
    `Today's date is: ${new Date().toLocaleDateString("en-GB")}.\n\n` +
    `Suggest up to 5 additional compliance or maintenance tasks that the landlord should schedule based on this portfolio under UK property laws. ` +
    `Consider minimum EPC ratings (E by 2025, C by 2030), HMO regulations, Gas CP12, EICR (5-year rule), Right to Rent checks, deposit protection, or fire risk assessments. ` +
    `For each suggestion, map it to a specific property in the list, and return a JSON array of objects with exactly these keys:\n` +
    `{\n` +
    `  "title": string (short descriptive title),\n` +
    `  "description": string (clear action step),\n` +
    `  "priority": "high" | "medium" | "low",\n` +
    `  "category": "inspection" | "compliance" | "maintenance" | "financial" | "administrative" | "tenant_management" | "other",\n` +
    `  "dueDate": "YYYY-MM-DD" (schedule it within the next 90 days),\n` +
    `  "reason": string (brief UK compliance reasoning),\n` +
    `  "propertyName": string (must match a propertyName from the provided list)\n` +
    `}`;

  try {
    const rawAI = await callVercelAI(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      { temperature: 0.3, max_tokens: 600 },
    );

    const cleanAI = rawAI
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();
    const parsed = JSON.parse(cleanAI);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.map((item: any) => ({
      title: String(item.title || ""),
      description: String(item.description || ""),
      priority: ["high", "medium", "low"].includes(item.priority)
        ? item.priority
        : "medium",
      category: [
        "inspection",
        "compliance",
        "maintenance",
        "financial",
        "administrative",
        "tenant_management",
        "other",
      ].includes(item.category)
        ? item.category
        : "other",
      dueDate: String(item.dueDate || new Date().toISOString().split("T")[0]),
      reason: String(item.reason || ""),
      propertyName: String(item.propertyName || ""),
    }));
  } catch (err) {
    logger.error("Failed to get AI task suggestions:", err);
    return [];
  }
};
