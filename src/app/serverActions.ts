"use server";

import { prisma } from "@/lib/db";
import { ablyRestClient } from "@/lib/subscription/server";
import { socketChannels } from "@/lib/subscription/channels";

const sendUpdateMessage = async (id: string) => {
  const channel = ablyRestClient.channels.get(socketChannels.voting.name);
  await channel.publish(socketChannels.voting.events.update, id);
};

export const addEntry = async (value: string, username: string) => {
  const { id } = await prisma.entry.create({
    data: {
      text: value,
      createdBy: {
        connect: {
          username,
        },
      },
    },
  });

  await sendUpdateMessage(id);
};

export const updateEntry = async (
  id: string,
  value: string,
  username: string
) => {
  await prisma.entry.update({
    where: { id },
    data: {
      text: value,
      updatedBy: {
        connect: {
          username,
        },
      },
    },
  });

  await sendUpdateMessage(id);
};

export const deleteEntry = async (id: string) => {
  await prisma.entry.delete({ where: { id } });

  await sendUpdateMessage(id);
};

export const fetchEntries = async () => {
  return await prisma.entry.findMany({
    include: { createdBy: true, updatedBy: true, voters: true },
  });
};

export const fetchEntry = async (id: string) => {
  return await prisma.entry.findUnique({
    where: { id },
    include: { createdBy: true, updatedBy: true, voters: true },
  });
};

export const upsertUsername = async (
  username: string,
  prevUsername: string
) => {
  if (username == prevUsername) return { success: true };

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    const hasEntriesPrevious = !!(await prisma.user.findUnique({
      where: {
        username: prevUsername,
        OR: [
          { entries: { some: {} } },
          { modifiedEntries: { some: {} } },
          { votes: { some: {} } },
        ],
      },
    }));
    // If the previous user has already made some actions, we can't delete it
    if (hasEntriesPrevious) {
      return { success: false, error: "Это имя уже занято" };
    }
    // If the previous user has no actions, we can delete it and give access to the target
    // If the previous user doesn't exist, we just give access to the target
    else {
      return await prisma.user
        .delete({ where: { username: prevUsername } })
        .then(() => ({ success: true }))
        .catch(() => ({ success: true }));
    }
  }

  return await prisma.user
    .upsert({
      create: { username },
      update: { username },
      where: { username: prevUsername },
    })
    .then(() => ({ success: true }))
    .catch(() => ({ success: false, error: "Не удалось изменить имя" }));
};

export const voteForEntry = async (entryId: string, username: string) => {
  await prisma.entry.update({
    where: { id: entryId },
    data: {
      voters: {
        connect: {
          username,
        },
      },
    },
  });

  await sendUpdateMessage(entryId);
};

export const retractVoteForEntry = async (
  entryId: string,
  username: string
) => {
  await prisma.entry.update({
    where: { id: entryId },
    data: {
      voters: {
        disconnect: {
          username,
        },
      },
    },
  });

  await sendUpdateMessage(entryId);
};
