import "server-only";
import type { Client } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { notFound } from "@/lib/errors";
import type { ClientDTO } from "@/lib/types";
import type { ClientInput } from "@/lib/validation";

/*
 * Every function takes the signed-in user's id and filters by it, so a caller
 * can never reach another user's client by guessing an id.
 */

export function toClientDTO(c: Client): ClientDTO {
  return {
    id: c.id,
    name: c.name,
    country: c.country,
    email: c.email,
    address: c.address,
    defaultCurrency: c.defaultCurrency,
    paymentTermsDays: c.paymentTermsDays,
    archived: c.archivedAt !== null,
  };
}

export async function listClients(
  userId: string,
  options: { includeArchived?: boolean } = {},
): Promise<ClientDTO[]> {
  const clients = await prisma.client.findMany({
    where: { userId, ...(options.includeArchived ? {} : { archivedAt: null }) },
    orderBy: [{ archivedAt: { sort: "asc", nulls: "first" } }, { name: "asc" }],
  });
  return clients.map(toClientDTO);
}

export async function getClient(userId: string, clientId: string): Promise<ClientDTO> {
  const client = await prisma.client.findFirst({ where: { id: clientId, userId } });
  if (!client) throw notFound("Client");
  return toClientDTO(client);
}

export async function createClient(userId: string, input: ClientInput): Promise<ClientDTO> {
  const client = await prisma.client.create({ data: { ...input, userId } });
  return toClientDTO(client);
}

export async function updateClient(
  userId: string,
  clientId: string,
  input: ClientInput,
): Promise<void> {
  const { count } = await prisma.client.updateMany({
    where: { id: clientId, userId },
    data: input,
  });
  if (count === 0) throw notFound("Client");
}

/** Archived clients keep their invoices but leave the pickers. */
export async function setClientArchived(
  userId: string,
  clientId: string,
  archived: boolean,
): Promise<void> {
  const { count } = await prisma.client.updateMany({
    where: { id: clientId, userId },
    data: { archivedAt: archived ? new Date() : null },
  });
  if (count === 0) throw notFound("Client");
}
