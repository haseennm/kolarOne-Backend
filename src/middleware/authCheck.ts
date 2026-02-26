import { FastifyReply, FastifyRequest } from "fastify";
import { query } from "../config/db";

// Extend request body types
interface ClientBody {
  client_id?: number;
}

interface ClientCreateBody extends ClientBody {
  created_by?: number;
}

interface ClientUpdateBody extends ClientBody {
  updated_by?: number;
}

// ✅ Check Client Exists
export async function checkClient(
  request: FastifyRequest<{ Body: ClientBody }>,
  reply: FastifyReply
) {
  try {
    const { client_id } = request.body;

    if (!client_id) {
      return reply.status(400).send({
        status: "Error",
        statusCode: 400,
        msg: "client_id is required.",
      });
    }

    const clientExists = await query(
      "SELECT id FROM dummy_client WHERE id = $1 LIMIT 1",
      [client_id]
    );

    if (clientExists.length === 0) {
      return reply.status(400).send({
        status: "Error",
        statusCode: 400,
        msg: "Invalid client_id. Client does not exist.",
      });
    }

    console.log(
      `📃 ${request.url} WITH BODY OF \x1b[33m${JSON.stringify(
        request.body
      )}\x1b[0m`
    );
  } catch (err) {
    request.log.error(err);
    return reply.status(500).send({
      status: "Error",
      statusCode: 500,
      msg: "Internal Server Error",
    });
  }
}

// ✅ Check Client + Created By
export async function cliCreCheck(
  request: FastifyRequest<{ Body: ClientCreateBody }>,
  reply: FastifyReply
) {
  try {
    const { client_id, created_by } = request.body;

    if (!client_id) {
      return reply.status(400).send({
        status: "Error",
        statusCode: 400,
        msg: "client_id is required.",
      });
    }

    if (!created_by) {
      return reply.status(400).send({
        status: "Error",
        statusCode: 400,
        msg: "created_by is required.",
      });
    }

    const clientExists = await query(
      "SELECT id FROM dummy_client WHERE id = ? LIMIT 1",
      [client_id]
    );

    if (clientExists.length === 0) {
      return reply.status(400).send({
        status: "Error",
        statusCode: 400,
        msg: "Invalid client_id. Client does not exist.",
      });
    }

    const staffExist = await query(
      "SELECT id FROM staff WHERE id = ? AND client_id = ? LIMIT 1",
      [created_by, client_id]
    );

    if (staffExist.length === 0) {
      return reply.status(400).send({
        status: "Error",
        statusCode: 400,
        msg: "Invalid created_by. Staff does not exist.",
      });
    }
  } catch (err) {
    request.log.error(err);
    return reply.status(500).send({
      status: "Error",
      statusCode: 500,
      msg: "Internal Server Error",
    });
  }
}

// ✅ Check Client + Updated By
export async function cliUpdCheck(
  request: FastifyRequest<{ Body: ClientUpdateBody }>,
  reply: FastifyReply
) {
  try {
    const { client_id, updated_by } = request.body;

    if (!client_id) {
      return reply.status(400).send({
        status: "Error",
        statusCode: 400,
        msg: "client_id is required.",
      });
    }

    if (!updated_by) {
      return reply.status(400).send({
        status: "Error",
        statusCode: 400,
        msg: "updated_by is required.",
      });
    }

    const clientExists = await query(
      "SELECT id FROM dummy_client WHERE id = ? LIMIT 1",
      [client_id]
    );

    if (clientExists.length === 0) {
      return reply.status(400).send({
        status: "Error",
        statusCode: 400,
        msg: "Invalid client_id. Client does not exist.",
      });
    }

    const staffExist = await query(
      "SELECT id FROM staff WHERE id = ? AND client_id = ? LIMIT 1",
      [updated_by, client_id]
    );

    if (staffExist.length === 0) {
      return reply.status(400).send({
        status: "Error",
        statusCode: 400,
        msg: "Invalid updated_by. Staff does not exist.",
      });
    }
  } catch (err) {
    request.log.error(err);
    return reply.status(500).send({
      status: "Error",
      statusCode: 500,
      msg: "Internal Server Error",
    });
  }
}