/**
 * Conversation Service — inbox CRUD, direct/group/support creation
 */

import mongoose from 'mongoose';
import Conversation, { type ParticipantRole } from './conversation.model';
import Property from '../property/property.model';
import tenantModels from '../tenant/tenant.model';
import User from '../user/user.model';
import ApiError from '../../utils/ApiError';
import { buildPaginationMeta } from '../../utils/pagination';
import {
  createSystemMessage,
  ensureParticipant,
  findActiveParticipant,
  formatConversation,
} from './chat.helpers';
import { emitConversationCreated } from './chat.socket';
import type {
  AuthUser,
  CreateDirectConversationInput,
  CreateGroupConversationInput,
  CreateSupportConversationInput,
  ListConversationsQuery,
  ListConversationsResult,
  ManageMembersInput,
  UpdateConversationInput,
} from './chat.types';

const { LeaseAgreement } = tenantModels;

const verifyPropertyAccess = async (
  propertyId: string,
  userId: string,
  role: string
): Promise<{ landlordId: string }> => {
  const property = await Property.findById(propertyId).select('landlordId isActive');
  if (!property || !property.isActive) {
    throw ApiError.notFound('Property not found');
  }

  if (role === 'landlord') {
    if (property.landlordId.toString() !== userId) {
      throw ApiError.forbidden('You do not own this property');
    }
    return { landlordId: property.landlordId.toString() };
  }

  if (role === 'tenant') {
    const lease = await LeaseAgreement.findOne({
      propertyId,
      tenantId: userId,
      status: { $in: ['accepted', 'active'] },
    });
    if (!lease) {
      throw ApiError.forbidden('You are not a tenant of this property');
    }
    return { landlordId: property.landlordId.toString() };
  }

  throw ApiError.forbidden('Insufficient permissions');
};

const verifyTenantOnProperty = async (
  propertyId: string,
  tenantId: string
): Promise<void> => {
  const lease = await LeaseAgreement.findOne({
    propertyId,
    tenantId,
    status: { $in: ['accepted', 'active'] },
  });
  if (!lease) {
    throw ApiError.badRequest(`User ${tenantId} is not an active tenant on this property`);
  }
};

export const listConversations = async (
  user: AuthUser,
  query: ListConversationsQuery
): Promise<ListConversationsResult> => {
  const userId = user._id.toString();
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(50, Math.max(1, query.limit ?? 20));
  const skip = (page - 1) * limit;

  const filter: Record<string, unknown> = {
    'participants.userId': user._id,
    'participants.archivedAt': null,
    'participants.leftAt': null,
  };

  if (query.category && query.category !== 'all') {
    filter.category = query.category;
  }

  if (query.search?.trim()) {
    filter.$or = [
      { title: { $regex: query.search.trim(), $options: 'i' } },
      { 'lastMessage.text': { $regex: query.search.trim(), $options: 'i' } },
    ];
  }

  const [conversations, total] = await Promise.all([
    Conversation.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit),
    Conversation.countDocuments(filter),
  ]);

  const formatted = await Promise.all(
    conversations.map((c) => formatConversation(c, userId))
  );

  return {
    conversations: formatted,
    meta: buildPaginationMeta(total, page, limit),
  };
};

export const getOrCreateDirectConversation = async (
  user: AuthUser,
  input: CreateDirectConversationInput
) => {
  const userId = user._id.toString();
  await verifyPropertyAccess(input.propertyId, userId, user.role);

  const otherUser = await User.findById(input.otherUserId);
  if (!otherUser || !otherUser.isActive) {
    throw ApiError.notFound('Other user not found');
  }

  if (otherUser._id.toString() === userId) {
    throw ApiError.badRequest('Cannot create a conversation with yourself');
  }

  const property = await Property.findById(input.propertyId).select('landlordId propertyName');
  if (!property) throw ApiError.notFound('Property not found');

  const landlordId = property.landlordId.toString();
  const isLandlordTenantPair =
    (user.role === 'landlord' && otherUser.role === 'tenant') ||
    (user.role === 'tenant' && otherUser.role === 'landlord');

  if (!isLandlordTenantPair) {
    throw ApiError.badRequest('Direct conversations are only between landlord and tenant');
  }

  if (user.role === 'tenant') {
    await verifyTenantOnProperty(input.propertyId, userId);
    if (otherUser._id.toString() !== landlordId) {
      throw ApiError.forbidden('Tenants can only chat with their property landlord');
    }
  } else {
    await verifyTenantOnProperty(input.propertyId, input.otherUserId);
  }

  const participantIds = [user._id, otherUser._id];

  let conversation = await Conversation.findOne({
    type: 'direct',
    propertyId: input.propertyId,
    'participants.userId': { $all: participantIds },
    participants: { $size: 2 },
  });

  if (!conversation) {
    conversation = await Conversation.create({
      type: 'direct',
      propertyId: input.propertyId,
      category: 'tenant',
      title: property.propertyName,
      participants: [
        {
          userId: property.landlordId,
          role: 'owner',
          joinedAt: new Date(),
          unreadCount: 0,
        },
        {
          userId: otherUser.role === 'tenant' ? otherUser._id : user._id,
          role: 'member',
          joinedAt: new Date(),
          unreadCount: 0,
        },
      ],
      metadata: { isSupport: false },
      createdBy: user._id,
    });

    const formatted = await formatConversation(conversation, userId);
    emitConversationCreated(
      formatted,
      conversation.participants.map((p) => p.userId.toString())
    );
    return formatted;
  }

  return formatConversation(conversation, userId);
};

export const createGroupConversation = async (
  user: AuthUser,
  input: CreateGroupConversationInput
) => {
  if (user.role !== 'landlord') {
    throw ApiError.forbidden('Only landlords can create group conversations');
  }

  const userId = user._id.toString();
  await verifyPropertyAccess(input.propertyId, userId, user.role);

  const property = await Property.findById(input.propertyId).select('propertyName');
  if (!property) throw ApiError.notFound('Property not found');

  for (const memberId of input.memberIds) {
    await verifyTenantOnProperty(input.propertyId, memberId);
  }

  const uniqueMemberIds = [...new Set(input.memberIds)];
  const members = await User.find({
    _id: { $in: uniqueMemberIds },
    role: 'tenant',
    isActive: true,
  });

  if (members.length !== uniqueMemberIds.length) {
    throw ApiError.badRequest('One or more member IDs are invalid tenants');
  }

  const participants = [
    {
      userId: user._id,
      role: 'owner' as const,
      joinedAt: new Date(),
      unreadCount: 0,
    },
    ...members.map((m) => ({
      userId: m._id,
      role: 'member' as const,
      joinedAt: new Date(),
      unreadCount: 0,
    })),
  ];

  const conversation = await Conversation.create({
    type: 'group',
    propertyId: input.propertyId,
    category: 'group',
    title: input.name,
    participants,
    metadata: { isSupport: false, avatarSeed: input.name },
    createdBy: user._id,
  });

  await createSystemMessage(
    conversation._id,
    user._id,
    `Group "${input.name}" created for ${property.propertyName}`
  );

  const formatted = await formatConversation(conversation, userId);
  emitConversationCreated(
    formatted,
    conversation.participants.map((p) => p.userId.toString())
  );

  return formatted;
};

export const createSupportConversation = async (
  user: AuthUser,
  input: CreateSupportConversationInput
) => {
  const userId = user._id.toString();
  const category = input.queue === 'marketplace' ? 'marketplace' : 'tenant';

  const existing = await Conversation.findOne({
    type: 'support',
    'metadata.supportQueue': input.queue,
    'participants.userId': user._id,
    'participants.leftAt': null,
  });

  if (existing) {
    return formatConversation(existing, userId);
  }

  const supportAgent = await User.findOne({
    role: 'support_agent',
    isActive: true,
  }).sort({ createdAt: 1 });

  const participants: Array<{
    userId: mongoose.Types.ObjectId;
    role: ParticipantRole;
    joinedAt: Date;
    unreadCount: number;
  }> = [
    {
      userId: user._id,
      role: 'member',
      joinedAt: new Date(),
      unreadCount: 0,
    },
  ];

  if (supportAgent) {
    participants.push({
      userId: supportAgent._id,
      role: 'support_agent',
      joinedAt: new Date(),
      unreadCount: 0,
    });
  }

  const conversation = await Conversation.create({
    type: 'support',
    propertyId: null,
    category,
    title: input.queue === 'marketplace' ? 'Marketplace Support' : 'Help & Support',
    participants,
    metadata: {
      isSupport: true,
      supportQueue: input.queue,
    },
    createdBy: user._id,
  });

  await createSystemMessage(
    conversation._id,
    user._id,
    'Support conversation started. A team member will respond shortly.'
  );

  const formatted = await formatConversation(conversation, userId);
  emitConversationCreated(
    formatted,
    conversation.participants.map((p) => p.userId.toString())
  );

  return formatted;
};

export const getConversationById = async (conversationId: string, user: AuthUser) => {
  const conversation = await ensureParticipant(conversationId, user._id.toString());
  return formatConversation(conversation, user._id.toString());
};

export const updateConversation = async (
  conversationId: string,
  user: AuthUser,
  input: UpdateConversationInput
) => {
  const conversation = await ensureParticipant(conversationId, user._id.toString());
  const participant = findActiveParticipant(conversation, user._id.toString());
  if (!participant) throw ApiError.forbidden('Not a participant');

  if (input.title !== undefined) {
    if (conversation.type !== 'group') {
      throw ApiError.badRequest('Only group conversations can be renamed');
    }
    if (participant.role !== 'owner' && participant.role !== 'admin') {
      throw ApiError.forbidden('Only group owners can rename the conversation');
    }
    conversation.title = input.title;
  }

  if (input.mutedUntil !== undefined) {
    participant.mutedUntil = input.mutedUntil ? new Date(input.mutedUntil) : null;
    conversation.markModified('participants');
  }

  await conversation.save();
  return formatConversation(conversation, user._id.toString());
};

export const archiveConversation = async (conversationId: string, user: AuthUser) => {
  const conversation = await ensureParticipant(conversationId, user._id.toString());
  const participant = conversation.participants.find(
    (p) => p.userId.toString() === user._id.toString()
  );
  if (!participant) throw ApiError.forbidden('Not a participant');

  participant.archivedAt = new Date();
  conversation.markModified('participants');
  await conversation.save();

  return { archived: true };
};

export const manageMembers = async (
  conversationId: string,
  user: AuthUser,
  input: ManageMembersInput
) => {
  const conversation = await ensureParticipant(conversationId, user._id.toString());

  if (conversation.type !== 'group') {
    throw ApiError.badRequest('Member management is only for group conversations');
  }

  const actor = findActiveParticipant(conversation, user._id.toString());
  if (!actor || (actor.role !== 'owner' && actor.role !== 'admin')) {
    throw ApiError.forbidden('Only group owners can manage members');
  }

  if (!conversation.propertyId) {
    throw ApiError.badRequest('Group must be linked to a property');
  }

  const propertyId = conversation.propertyId.toString();

  if (input.action === 'add') {
    for (const memberId of input.memberIds) {
      await verifyTenantOnProperty(propertyId, memberId);

      const exists = conversation.participants.some(
        (p) => p.userId.toString() === memberId && !p.leftAt
      );
      if (exists) continue;

      const previouslyLeft = conversation.participants.find(
        (p) => p.userId.toString() === memberId && p.leftAt
      );

      if (previouslyLeft) {
        previouslyLeft.leftAt = null;
        previouslyLeft.joinedAt = new Date();
      } else {
        conversation.participants.push({
          userId: new mongoose.Types.ObjectId(memberId),
          role: 'member',
          joinedAt: new Date(),
          unreadCount: 0,
        });
      }

      await createSystemMessage(
        conversation._id,
        user._id,
        'A new member was added to the group'
      );
    }
  } else {
    for (const memberId of input.memberIds) {
      const target = conversation.participants.find(
        (p) => p.userId.toString() === memberId && !p.leftAt
      );
      if (!target || target.role === 'owner') continue;
      target.leftAt = new Date();

      await createSystemMessage(
        conversation._id,
        user._id,
        'A member left the group'
      );
    }
  }

  conversation.markModified('participants');
  await conversation.save();

  return formatConversation(conversation, user._id.toString());
};

export const getTenantDefaultConversation = async (user: AuthUser) => {
  if (user.role !== 'tenant') {
    throw ApiError.forbidden('Only tenants can access default conversation');
  }

  const lease = await LeaseAgreement.findOne({
    tenantId: user._id,
    status: { $in: ['accepted', 'active'] },
  }).sort({ updatedAt: -1 });

  if (!lease) {
    throw ApiError.notFound('No active lease found');
  }

  return getOrCreateDirectConversation(user, {
    propertyId: lease.propertyId.toString(),
    otherUserId: lease.landlordId.toString(),
  });
};
